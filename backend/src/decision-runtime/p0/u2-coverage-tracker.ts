/**
 * u2-coverage-tracker.ts — Phase U-2 Coverage Measurement & Dashboard
 *
 * ============================================================
 * 给系统装上"眼睛"——记录每个 query 的匹配结果，
 * 输出覆盖率仪表盘，为 U-3 自动演化提供数据依据。
 *
 * 核心指标：
 *   totalQueries     — 总请求量
 *   matchedQueries   — 命中 seed 的请求
 *   fallbackQueries  — 走 fallback 的请求
 *   coverageRate     = matchedQueries / totalQueries
 *   fallbackRate     = fallbackQueries / totalQueries
 *
 * 宪法：
 *   ❌ 不修改宇宙
 *   ❌ 不影响决策路径
 *   ✅ 只记录，只统计
 *   ✅ 内存态（不写 DB，可导出）
 * ============================================================
 */

// ============================================================
// 1. 查询记录
// ============================================================

export interface QueryRecord {
  query: string
  timestamp: number
  matchedSeed: string | null
  score: number
  level: 'strong' | 'acceptable' | 'weak' | 'none'
  degraded: boolean
  /** U-2.2a: 竞争空间——TOP N 候选种子及其得分 */
  topCandidates?: Array<{
    seedId: string
    score: number
    components?: Record<string, number>
  }>
}

/**
 * MatchTrace: 全量匹配追踪
 * trace ≠ response — 只记录，不返回给用户
 */
export interface MatchTrace {
  query: string
  matchedSeed: string | null
  finalScore: number
  level: QueryRecord['level']
  degraded: boolean
  topCandidates: Array<{
    seedId: string
    score: number
    components?: Record<string, number>
  }>
}

// ============================================================
// 2. Seed 覆盖统计（升级版）
// ============================================================

export interface SeedCoverageStats {
  /** seed ID */
  seedId: string
  /** 命中次数 */
  hitCount: number
  /** 强匹配次数（score >= 0.7） */
  strongCount: number
  /** 可接受匹配次数（score >= 0.4，< 0.7） */
  acceptableCount: number
  /** 弱匹配次数（score > 0，< 0.4） */
  weakCount: number
  /** 强匹配率 */
  strongRate: number
  /** 可接受匹配率 */
  acceptableRate: number
  /** 平均分 */
  avgScore: number
  /** 近失分次数：那些差一点命中的 query（该 seed 是最高分但 score < threshold） */
  nearMissCount: number
  /** 占 matched 的比例 */
  shareOfMatched: number  // 0-1
  /** 占总请求的比例 */
  shareOfTotal: number    // 0-1
  /** 种子状态（从 schema 读取） */
  state?: 'ACTIVE' | 'FROZEN' | 'CANDIDATE' | 'RETIRED'
  /** 领域 */
  domain?: string
  /** 创建时间（第一次命中的时间戳） */
  firstHitAt?: number
  /** 最后命中时间 */
  lastHitAt?: number
}

// ============================================================
// 3. Fallback 查询池
// ============================================================

export interface FallbackCluster {
  /** 聚类 key（如首位词、领域词） */
  clusterKey: string
  /** 聚集的 query 条数 */
  count: number
  /** 示例 query */
  examples: string[]
  /** 候选 seed 名（可人工批准后转正） */
  candidateSeedId: string | null
}

// ============================================================
// 4. Universe 指标仪表盘
// ============================================================

export interface UniverseMetrics {
  totalQueries: number
  matchedQueries: number
  fallbackQueries: number
  coverageRate: number          // 0-1
  fallbackRate: number          // 0-1
  strongMatchRate: number       // 0-1
  seedCoverage: SeedCoverageStats[]
  fallbackClusters: FallbackCluster[]
  topFallbackQueries: Array<{ query: string; count: number }>
  topSeeds: Array<{ seedId: string; count: number }>
}

// ============================================================
// 5. Coverage Tracker（内存态）
// ============================================================

export class CoverageTracker {
  private records: QueryRecord[] = []
  private maxRecords: number
  /** 可选的 seed schema 加载器，用于补充种子的 domain/state 等信息 */
  public loadSeedSchema?: () => Array<{ id: string; domain: string; state?: string }>

  constructor(maxRecords = 10000) {
    this.maxRecords = maxRecords
  }

  /**
   * record: 记录一次查询
   */
  record(query: string, matchedSeed: string | null, score: number, level: QueryRecord['level'], degraded: boolean, topCandidates?: QueryRecord['topCandidates']): void {
    this.records.push({
      query: query.slice(0, 200),  // 截断过长 query
      timestamp: Date.now(),
      matchedSeed,
      score,
      level,
      degraded,
      topCandidates,
    })

    // 超出上限时丢弃最旧的 20%
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(Math.floor(this.maxRecords * 0.2))
    }
  }

  /**
   * getMetrics: 获取宇宙指标仪表盘
   */
  getMetrics(): UniverseMetrics {
    const total = this.records.length
    const matched = this.records.filter(r => !r.degraded && r.matchedSeed !== null)
    const fallback = this.records.filter(r => r.degraded || r.matchedSeed === null)
    const strong = this.records.filter(r => r.level === 'strong')

    // Seed 覆盖统计（升级版）
    const seedHitMap = new Map<string, { count: number; strong: number; acceptable: number; weak: number; scores: number[]; nearMiss: number; firstHit: number; lastHit: number }>()
    for (const r of matched) {
      if (r.matchedSeed) {
        const s = seedHitMap.get(r.matchedSeed) || { count: 0, strong: 0, acceptable: 0, weak: 0, scores: [], nearMiss: 0, firstHit: r.timestamp, lastHit: r.timestamp }
        s.count++
        if (r.score >= 0.7) s.strong++
        else if (r.score >= 0.4) s.acceptable++
        else s.weak++
        s.scores.push(r.score)
        if (r.timestamp < s.firstHit) s.firstHit = r.timestamp
        if (r.timestamp > s.lastHit) s.lastHit = r.timestamp
        seedHitMap.set(r.matchedSeed, s)
      }
    }

    // Near Miss 分析：基于 topCandidates 的竞争空间视角（U-2.2a）
    const nearMissMap = new Map<string, number>()
    const NEAR_MISS_THRESHOLD = 0.3
    for (const r of fallback) {
      if (!r.topCandidates || r.topCandidates.length === 0) continue
      const best = r.topCandidates[0]
      if (best.score >= NEAR_MISS_THRESHOLD && r.matchedSeed == null) {
        nearMissMap.set(best.seedId, (nearMissMap.get(best.seedId) || 0) + 1)
      }
    }

    const seedSchema = (this.loadSeedSchema?.() as Array<{ id: string; domain: string; state?: string }>) ?? []
    const seedCoverage: SeedCoverageStats[] = [...seedHitMap.entries()]
      .map(([seedId, stats]) => {
        const schemaEntry = seedSchema.find((s: any) => s.id === seedId)
        const totalScore = stats.scores.reduce((a, b) => a + b, 0)
        return {
          seedId,
          hitCount: stats.count,
          strongCount: stats.strong,
          acceptableCount: stats.acceptable,
          weakCount: stats.weak,
          strongRate: stats.count > 0 ? stats.strong / stats.count : 0,
          acceptableRate: stats.count > 0 ? stats.acceptable / stats.count : 0,
          avgScore: stats.count > 0 ? Math.round(totalScore / stats.count * 100) / 100 : 0,
          nearMissCount: nearMissMap.get(seedId) ?? 0,
          shareOfMatched: matched.length > 0 ? stats.count / matched.length : 0,
          shareOfTotal: total > 0 ? stats.count / total : 0,
          state: (schemaEntry?.state ?? 'ACTIVE') as SeedCoverageStats['state'],
          domain: schemaEntry?.domain ?? '',
          firstHitAt: stats.firstHit as number,
          lastHitAt: stats.lastHit as number,
        } as SeedCoverageStats
      })
      .sort((a, b) => b.hitCount - a.hitCount)

    // Fallback 聚类（按首词+关键词）
    const fallbackClusters = this.clusterFallbackQueries(fallback)

    // Top fallback queries
    const fallbackQueryMap = new Map<string, number>()
    for (const r of fallback) {
      fallbackQueryMap.set(r.query, (fallbackQueryMap.get(r.query) || 0) + 1)
    }
    const topFallbackQueries = [...fallbackQueryMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([query, count]) => ({ query, count }))

    // Top seeds
    const topSeeds = seedCoverage.slice(0, 10).map(s => ({ seedId: s.seedId, count: s.hitCount }))

    return {
      totalQueries: total,
      matchedQueries: matched.length,
      fallbackQueries: fallback.length,
      coverageRate: total > 0 ? matched.length / total : 0,
      fallbackRate: total > 0 ? fallback.length / total : 0,
      strongMatchRate: total > 0 ? strong.length / total : 0,
      seedCoverage,
      fallbackClusters,
      topFallbackQueries,
      topSeeds,
    }
  }

  /**
   * clusterFallbackQueries: 对 fallback query 做简单聚类
   *
   * 策略：提取 query 中的首位汉字词、领域词做 key
   */
  private clusterFallbackQueries(fallbackRecords: QueryRecord[]): FallbackCluster[] {
    const clusterMap = new Map<string, { count: number; examples: string[] }>()

    for (const r of fallbackRecords) {
      // 提取聚类 key
      const key = this.extractClusterKey(r.query)
      const existing = clusterMap.get(key)
      if (existing) {
        existing.count++
        if (existing.examples.length < 10 && !existing.examples.includes(r.query)) {
          existing.examples.push(r.query)
        }
      } else {
        clusterMap.set(key, { count: 1, examples: [r.query] })
      }
    }

    return [...clusterMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([clusterKey, { count, examples }]) => ({
        clusterKey,
        count,
        examples,
        candidateSeedId: this.clusterToCandidateSeed(clusterKey, examples),
      }))
  }

  /**
   * extractClusterKey: 提取聚类 key
   * 取 query 中第一个有意义的中文词（2-4 字）
   */
  private extractClusterKey(query: string): string {
    const chinese = query.match(/[\u4e00-\u9fa5]{2,4}/g)
    if (chinese && chinese.length > 0) {
      // 取前两个词组合作为 key
      const keyParts = chinese.slice(0, 2)
      return keyParts.join('·')
    }

    // 无中文则取首词
    const firstWord = query.split(/[\s,，。？]+/)[0]
    return firstWord?.slice(0, 10) || '其他'
  }

  /**
   * clusterToCandidateSeed: 从聚类自动生成候选 seed ID
   */
  private clusterToCandidateSeed(clusterKey: string, examples: string[]): string {
    // 去掉标点，转为小写英文 ID
    const clean = clusterKey.replace(/[·,，。？\s]+/g, '-').toLowerCase()
    return `candidate-${clean}`
  }

  /**
   * getTraceCount: 获取记录总数
   */
  getTraceCount(): number {
    return this.records.length
  }

  /**
   * getFallbackRate: 最近 N 条记录的退化率
   */
  getFallbackRate(lastN = 100): number {
    const recent = this.records.slice(-lastN)
    if (recent.length === 0) return 0
    return recent.filter(r => r.degraded).length / recent.length
  }

  /**
   * getSeedDetail: 获取单个 Seed 的详细统计
   */
  getSeedDetail(seedId: string): SeedCoverageStats | null {
    const metrics = this.getMetrics()
    return metrics.seedCoverage.find(s => s.seedId === seedId) ?? null
  }

  /**
   * getFallbackDetail: 获取 fallback 查询的匹配详情
   * 用于 Query Replay 页面展示各候选 seed 的得分
   */
  getFallbackDetail(fallbackQuery: string): Array<{ seedId: string; score: number }> | null {
    // 从 records 中寻找该 query 的 fallback 原记录
    const matchedRecords = this.records.filter(r => r.query === fallbackQuery && r.degraded)
    if (matchedRecords.length === 0) return null
    // 返回 topCandidates（U-2.2a 新增）
    const best = matchedRecords[0]
    return best.topCandidates ?? null
  }

  /**
   * recordMatchTrace: 直接录入 MatchTrace（U-2.2a）
   * 用于外部模块不想经过 shadow executor 但想记录匹配痕迹的场景
   */
  recordMatchTrace(trace: MatchTrace): void {
    this.record(
      trace.query,
      trace.matchedSeed,
      trace.finalScore,
      trace.level,
      trace.degraded,
      trace.topCandidates,
    )
  }

  /**
   * getAllRecords: 获取所有记录（用于分析和导出）
   */
  getAllRecords(): QueryRecord[] {
    return [...this.records]
  }

  /**
   * getTotalRecords: 获取总记录数
   */
  get totalRecords(): number {
    return this.records.length
  }

  /**
   * getAllNearMissQueries: 获取指定近失阈值的查询
   * 使用 topCandidates[0] 而非 finalScore，反映竞争空间视角
   */
  getAllNearMissQueries(threshold = 0.3): Array<{ query: string; score: number; topCandidate: string }> {
    const fallback = this.records.filter(r => r.degraded || r.matchedSeed == null)
    return fallback
      .filter(r => {
        // 使用 topCandidates 中的最高分
        const bestCandidate = r.topCandidates?.[0]
        return bestCandidate != null && bestCandidate.score >= threshold && r.matchedSeed == null
      })
      .map(r => {
        const best = r.topCandidates![0]
        return { query: r.query, score: best.score, topCandidate: best.seedId }
      })
  }

  /**
   * exportRecords: 导出记录（用于分析和持久化）
   */
  exportRecords(): QueryRecord[] {
    return [...this.records]
  }
}

/** 单例 */
export const coverageTracker = new CoverageTracker()
