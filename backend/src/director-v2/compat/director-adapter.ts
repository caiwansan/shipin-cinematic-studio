/**
 * director-adapter.ts — Legacy ↔ V2 Director Adapter Layer
 *
 * 三段式迁移的核心基础设施：
 *   Phase 1: Shadow Mode（v1 继续生产，v2 并行记录 diff）
 *   Phase 2: Switch Mode（v2 生产，v1 fallback）
 *   Phase 3: Legacy Retired（v1 删除）
 */

// ============================================================
// Types
// ============================================================

export type DirectorVersion = 'v1_legacy' | 'v2_current'
export type AdapterMode = 'shadow' | 'switch' | 'force_v2' | 'force_v1'

export interface AdapterConfig {
  mode: AdapterMode
  /** shadow run 期间 v2 是否静默（不抛出错误） */
  shadowSilent: boolean
  /** switch 模式下 v2 失败时的回退行为 */
  fallbackOnV2Error: boolean
  /** 一致性阈值（低于此值告警） */
  consistencyThreshold: number
}

export const DEFAULT_ADAPTER_CONFIG: AdapterConfig = {
  mode: 'shadow',
  shadowSilent: true,
  fallbackOnV2Error: true,
  consistencyThreshold: 0.85,
}

/** Agent 级别映射记录 */
export interface AgentMapping {
  legacyName: string
  v2Name: string
  mapped: boolean
  /** 功能等价度 (0-1) */
  functionalEquivalence: number
  notes: string
}

export interface DiffRecord {
  endpoint: string
  requestId: string
  v1Output: unknown
  v2Output: unknown | null
  diffScore: number
  durationDiff: number
  timestamp: number
  matched: boolean
  v2Error?: string
}

// ============================================================
// Agent Mapping Table
// ============================================================

export const AGENT_MAPPING: AgentMapping[] = [
  { legacyName: 'director-brain.agent', v2Name: 'constitution-compiler + cinematic-intent', mapped: true, functionalEquivalence: 0.9, notes: '语义理解 → constitution + intent lock' },
  { legacyName: 'cinematic-shot.agent', v2Name: 'CET camera grammar + execution-plan', mapped: true, functionalEquivalence: 0.85, notes: '镜头设计 → CET CameraGrammarTranslator' },
  { legacyName: 'character-director.agent', v2Name: 'story-constitution + cinematic-identity', mapped: true, functionalEquivalence: 0.8, notes: '角色导演 → schema/character-law + identity' },
  { legacyName: 'scene-atmosphere.agent', v2Name: 'real-time scene runtime + CET motion', mapped: true, functionalEquivalence: 0.85, notes: '场景氛围 → realtime-scene tick + mutation gate' },
  { legacyName: 'story-rhythm.agent', v2Name: 'temporal-guard + pacing', mapped: true, functionalEquivalence: 0.8, notes: '节奏 → TemporalConsistencyGuard' },
  { legacyName: 'prompt-compiler', v2Name: 'CET compile + prompt-de-diffusion', mapped: true, functionalEquivalence: 0.9, notes: 'prompt → CET + StructuredPrompt' },
  { legacyName: 'continuity.engine', v2Name: 'temporal-guard', mapped: true, functionalEquivalence: 0.85, notes: '连续性 → TemporalFrameGraph' },
  { legacyName: 'review.engine', v2Name: 'governance + diagnostics', mapped: true, functionalEquivalence: 0.9, notes: '审查 → StabilityGovernor + SystemDiagnostics' },
]

// ============================================================
// Diff Engine — 比较 v1 和 v2 输出
// ============================================================

export class DiffEngine {
  /**
   * 计算 v1 ↔ v2 输出的结构相似度 (0-1)
   * 基于字段级 overlap（不强求 token 完全匹配）
   */
  computeDiff(v1Output: unknown, v2Output: unknown): number {
    if (!v1Output || !v2Output) return 0

    // 简单结构比较：统计相同字段比例
    const fields1 = this.flattenKeys(v1Output)
    const fields2 = this.flattenKeys(v2Output)

    if (fields1.length === 0 && fields2.length === 0) return 1
    if (fields1.length === 0 || fields2.length === 0) return 0

    // 通用的结构化比较
    const keys1 = new Set(fields1.map(f => f.path))
    const keys2 = new Set(fields2.map(f => f.path))

    const intersection = new Set([...keys1].filter(k => keys2.has(k)))
    const union = new Set([...keys1, ...keys2])

    const structureOverlap = intersection.size / Math.max(union.size, 1)

    // 对共同字段比较值相似度
    let valueSimilarity = 0
    let comparedCount = 0

    for (const key of intersection) {
      const v1 = fields1.find(f => f.path === key)?.value
      const v2 = fields2.find(f => f.path === key)?.value

      if (typeof v1 === 'number' && typeof v2 === 'number') {
        valueSimilarity += 1 - Math.min(Math.abs(v1 - v2), 1)
        comparedCount++
      } else if (typeof v1 === 'string' && typeof v2 === 'string') {
        valueSimilarity += v1 === v2 ? 1 : 0.5
        comparedCount++
      } else {
        valueSimilarity += v1 === v2 ? 1 : 0
        comparedCount++
      }
    }

    const valueScore = comparedCount > 0 ? valueSimilarity / comparedCount : 1

    // 加权：结构重叠 40%，值相似度 60%
    return structureOverlap * 0.4 + valueScore * 0.6
  }

  private flattenKeys(obj: unknown, prefix = ''): { path: string; value: unknown }[] {
    if (!obj || typeof obj !== 'object') return [{ path: prefix, value: obj }]
    if (Array.isArray(obj)) {
      if (obj.length === 0) return [{ path: prefix, value: '[]' }]
      return obj.flatMap((item, i) => this.flattenKeys(item, `${prefix}[${i}]`))
    }

    const result: { path: string; value: unknown }[] = []
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key
      if (value !== null && typeof value === 'object') {
        result.push(...this.flattenKeys(value, path))
      } else {
        result.push({ path, value })
      }
    }
    return result
  }
}

// ============================================================
// Director Adapter — 核心路由层
// ============================================================

export class DirectorAdapter {
  config: AdapterConfig
  diffEngine = new DiffEngine()
  private diffHistory: DiffRecord[] = []
  private maxDiffHistory: number

  constructor(config?: Partial<AdapterConfig>) {
    this.config = { ...DEFAULT_ADAPTER_CONFIG, ...config }
    this.maxDiffHistory = 10000
  }

  /**
   * 路由导演请求到对应版本
   */
  async execute<T>(
    endpoint: string,
    requestId: string,
    legacyExecutor: () => Promise<T>,
    v2Executor: () => Promise<T>,
  ): Promise<T> {
    if (this.config.mode === 'force_v1') {
      return legacyExecutor()
    }

    let v2Result: T | null = null
    let v2Error: string | undefined
    let legacyResult: T | null = null

    if (this.config.mode === 'shadow') {
      // shadow mode: run both, return legacy, record diff
      try {
        v2Result = await v2Executor()
      } catch (err: unknown) {
        v2Error = err instanceof Error ? err.message : String(err)
      }
      legacyResult = await legacyExecutor()
      this.recordDiff(endpoint, requestId, legacyResult, v2Result, v2Error)
      return legacyResult
    }

    if (this.config.mode === 'switch') {
      try {
        v2Result = await v2Executor()
        legacyResult = await legacyExecutor()
        this.recordDiff(endpoint, requestId, legacyResult, v2Result, undefined)
        return v2Result
      } catch (err: unknown) {
        v2Error = err instanceof Error ? err.message : String(err)
        legacyResult = await legacyExecutor()
        return legacyResult
      }
    }

    // force_v2
    try {
      v2Result = await v2Executor()
      return v2Result
    } catch (err: unknown) {
      if (!this.config.fallbackOnV2Error) throw err
      legacyResult = await legacyExecutor()
      return legacyResult
    }
  }

  private recordDiff(
    endpoint: string,
    requestId: string,
    legacyResult: T,
    v2Result: T | null,
    v2Error?: string,
  ): void {
    if (v2Result === null) return

    const diffScore = this.diffEngine.computeDiff(legacyResult as unknown, v2Result as unknown)
    const record: DiffRecord = {
      endpoint,
      requestId,
      v1Output: legacyResult,
      v2Output: v2Result,
      diffScore,
      durationDiff: 0,
      timestamp: Date.now(),
      matched: diffScore >= this.config.consistencyThreshold,
      v2Error,
    }
    this.diffHistory.push(record)
    if (this.diffHistory.length > this.maxDiffHistory) {
      this.diffHistory.shift()
    }
  }

  /**
   * 获取一致性统计数据
   */
  getConsistencyReport(): {
    totalShadowRuns: number
    matchedCount: number
    overallConsistency: number
    perEndpoint: Record<string, { runs: number; matches: number; avgConsistency: number }>
    recentBreaches: DiffRecord[]
  } {
    const shadowRuns = this.diffHistory.filter(r => r.v2Output !== null)
    const matchedCount = shadowRuns.filter(r => r.matched).length

    const perEndpoint: Record<string, { runs: number; matches: number; avgConsistency: number }> = {}
    for (const r of shadowRuns) {
      if (!perEndpoint[r.endpoint]) perEndpoint[r.endpoint] = { runs: 0, matches: 0, avgConsistency: 0 }
      perEndpoint[r.endpoint].runs++
      if (r.matched) perEndpoint[r.endpoint].matches++
    }
    for (const [ep, data] of Object.entries(perEndpoint)) {
      const totalConsistency = shadowRuns.filter(r => r.endpoint === ep).reduce((s, r) => s + r.diffScore, 0)
      data.avgConsistency = data.runs > 0 ? totalConsistency / data.runs : 0
    }

    const overallConsistency = shadowRuns.length > 0
      ? shadowRuns.reduce((s, r) => s + r.diffScore, 0) / shadowRuns.length
      : 0

    return {
      totalShadowRuns: shadowRuns.length,
      matchedCount,
      overallConsistency,
      perEndpoint,
      recentBreaches: shadowRuns.filter(r => !r.matched).slice(-20),
    }
  }

  /**
   * 切换运行模式
   */
  setMode(mode: AdapterMode): void {
    this.config = { ...this.config, mode }
  }
}

// ============================================================
// Singleton
// ============================================================

export const directorAdapter = new DirectorAdapter()
