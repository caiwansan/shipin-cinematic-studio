// ============================================================
// BrandHealthAggregator — 品牌健康报告聚合器
//
// 职责：
//   1. 从多个引擎/数据源读取数据
//   2. 转换成 BrandHealthReport（产品领域模型）
//   3. 作为所有 API 的统一输出
//
// 当前阶段（Sprint W2-01）：
//   基于 geoProjectService.getProjectWithReport() 返回的数据进行转换，
//   后续迭代将从 GEOScoreSnapshot、GEOPresenceEvidence 等表获取更丰富的数据。
// ============================================================

import { geoProjectService } from '../services/geo-project.service'
import { prisma } from '../../../utils/index'
import type {
  BrandHealthReport,
  BrandHealthDimension,
  BrandHealthRisk,
  BrandHealthOpportunity,
  BrandHealthSummary,
  BrandHealthEvidence,
  BrandHealthTimeline,
} from './brand-health'

const ENGINE_VERSION = 'brand-health.1.0.0'

export class BrandHealthAggregator {
  /**
   * 聚合指定项目的品牌健康报告
   */
  async aggregate(projectId: string): Promise<BrandHealthReport> {
    // 1. 获取项目及关联报告数据
    const dashboard = await geoProjectService.getProjectWithReport(projectId)
    const project = dashboard.project
    if (!project) {
      throw new Error(`Project not found: ${projectId}`)
    }

    // 2. 获取最新评分快照
    const latestSnapshot = await this.getLatestSnapshot(projectId)
    const previousSnapshot = await this.getPreviousSnapshot(projectId)

    // 3. 获取证据覆盖数据
    const evidenceCount = await this.countEvidence(projectId)
    const providerSources = await this.getProviderSources(projectId)

    // 4. 获取扫描历史（用于时间轴）
    const scanHistory = await this.getScanHistory(projectId)

    // 5. 计算核心健康分
    const { overallScore, scoreChange, trend } = this.calculateScore(
      latestSnapshot,
      previousSnapshot,
      dashboard.discoveryReport
    )

    // 6. 构建六个健康维度
    const dimensions = this.buildDimensions(
      latestSnapshot,
      dashboard.discoveryReport,
      evidenceCount
    )

    // 7. 构建风险评估
    const topRisks = this.buildRisks(dimensions, evidenceCount)

    // 8. 构建机会列表
    const topOpportunities = this.buildOpportunities(dimensions)

    // 9. 构建摘要
    const summary = this.buildSummary(dimensions, topRisks, topOpportunities)

    // 10. 构建证据覆盖信息
    const evidence = this.buildEvidence(evidenceCount, providerSources)

    // 11. 构建时间轴
    const timeline = this.buildTimeline(
      project.createdAt,
      latestSnapshot,
      previousSnapshot,
      scanHistory
    )

    // 12. 组装最终报告
    return {
      brandId: projectId,
      brandName: project.name,
      brandWebsite: project.website || undefined,
      brandIndustry: project.industry || undefined,
      overallScore,
      scoreChange,
      trend,
      dimensions,
      topRisks,
      topOpportunities,
      summary,
      evidence,
      timeline,
      lastScanAt: latestSnapshot?.createdAt?.toISOString() || project.updatedAt,
      nextRecommendedAction: summary.nextBestAction,
      engineVersion: ENGINE_VERSION,
    }
  }

  // ──────────────────────────────────────────────
  // 私有方法 — 数据获取
  // ──────────────────────────────────────────────

  /**
   * 获取最新的评分快照
   */
  private async getLatestSnapshot(projectId: string): Promise<any | null> {
    try {
      const snapshots = await prisma.gEOScoreSnapshot.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 2,
      })
      return snapshots[0] || null
    } catch {
      return null
    }
  }

  /**
   * 获取上一次的评分快照（用于计算变化）
   */
  private async getPreviousSnapshot(projectId: string): Promise<any | null> {
    try {
      const snapshots = await prisma.gEOScoreSnapshot.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 2,
      })
      return snapshots[1] || null
    } catch {
      return null
    }
  }

  /**
   * 统计该项目的证据数量
   */
  private async countEvidence(projectId: string): Promise<number> {
    try {
      // 从 GEOPresenceEvidence 表统计
      const count = await prisma.gEOPresenceEvidence.count({
        where: { projectId },
      })
      return count
    } catch {
      return 0
    }
  }

  /**
   * 获取各 Provider 的证据源信息
   */
  private async getProviderSources(projectId: string): Promise<
    Array<{ provider: string; status: string; evidenceCount: number; lastCheckedAt: Date }>
  > {
    try {
      // 按 provider 分组获取最新的检查记录
      const results = await prisma.gEOPresenceEvidence.groupBy({
        by: ['provider'],
        where: { projectId },
        _count: { id: true },
        _max: { checkedAt: true },
      })

      return results.map((r: any) => ({
        provider: r.provider,
        status: 'available',
        evidenceCount: r._count?.id || 0,
        lastCheckedAt: r._max?.checkedAt || new Date(),
      }))
    } catch {
      return []
    }
  }

  /**
   * 获取扫描历史
   */
  private async getScanHistory(projectId: string): Promise<any[]> {
    try {
      const history = await prisma.gEOScoreSnapshot.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          snapshot: true,
          scores: true,
          createdAt: true,
          scanId: true,
          sourceType: true,
          engineVersion: true,
        },
      })
      return history
    } catch {
      return []
    }
  }

  // ──────────────────────────────────────────────
  // 私有方法 — 分数计算
  // ──────────────────────────────────────────────

  /**
   * 计算核心健康分及其变化趋势
   */
  private calculateScore(
    latestSnapshot: any,
    previousSnapshot: any,
    discoveryReport: any
  ): { overallScore: number; scoreChange: number; trend: 'improving' | 'stable' | 'declining' } {
    // 优先从快照获取分数
    let currentScore = 0
    let previousScore = 0

    if (latestSnapshot) {
      const snapData = latestSnapshot.snapshot || latestSnapshot.scores || {}
      currentScore = snapData.overall ?? 0
    }

    // 如果快照没有分数，尝试从 discovery report 获取
    if (currentScore === 0 && discoveryReport) {
      currentScore = discoveryReport.adi ?? 0
    }

    if (previousSnapshot) {
      const prevData = previousSnapshot.snapshot || previousSnapshot.scores || {}
      previousScore = prevData.overall ?? 0
    }

    const scoreChange = currentScore - previousScore
    let trend: 'improving' | 'stable' | 'declining' = 'stable'
    if (scoreChange > 2) trend = 'improving'
    else if (scoreChange < -2) trend = 'declining'

    return { overallScore: Math.round(currentScore), scoreChange: Math.round(scoreChange), trend }
  }

  // ──────────────────────────────────────────────
  // 私有方法 — 维度构建
  // ──────────────────────────────────────────────

  /**
   * 构建六个品牌健康维度
   *
   * 当前阶段从快照和发现报告映射数据，不足的维度用合理默认值填充。
   */
  private buildDimensions(
    snapshot: any,
    discoveryReport: any,
    evidenceCount: number
  ): BrandHealthDimension[] {
    const snapData = snapshot?.snapshot || snapshot?.scores || {}
    const dims = snapData.dimensions || {}
    const reportData = discoveryReport?.reportData || {}

    // 从 Quick Discovery 结果获取基础分数
    const adiFromDiscovery = discoveryReport?.adi ?? 0
    const coverageScore = dims.coverage ?? discoveryReport?.coverageScore ?? 0
    const shareScore = dims.share ?? discoveryReport?.shareScore ?? 0
    const positionScore = dims.position ?? discoveryReport?.positionScore ?? 0

    return [
      {
        id: 'visibility',
        name: '可见度',
        score: Math.round(coverageScore * 0.8 + adiFromDiscovery * 0.2),
        maxScore: 100,
        change: 0,
        explanation: {
          what: '品牌在 AI 模型（如 ChatGPT、文心一言等）的搜索结果中被提及的频率和准确性',
          why: `基于 ${evidenceCount} 条证据，AI 品牌提及覆盖率为 ${coverageScore}%`,
          evidence: [`共收集 ${evidenceCount} 条品牌相关证据`],
          confidence: evidenceCount > 0 ? 70 : 30,
        },
      },
      {
        id: 'authority',
        name: '权威性',
        score: Math.round(adiFromDiscovery * 0.6 + positionScore * 0.4),
        maxScore: 100,
        change: 0,
        explanation: {
          what: '品牌官网、官方信息在 AI 回复中被引用和信任的质量',
          why: `品牌在搜索结果中的位置得分为 ${positionScore}，反映出 AI 对品牌权威性的认可程度`,
          evidence: ['品牌官网信息可信度评估'],
          confidence: adiFromDiscovery > 0 ? 65 : 25,
        },
      },
      {
        id: 'awareness',
        name: '认知度',
        score: Math.round(adiFromDiscovery * 0.5 + coverageScore * 0.3 + shareScore * 0.2),
        maxScore: 100,
        change: 0,
        explanation: {
          what: 'AI 对品牌业务范围、核心产品、市场定位的理解深度',
          why: `AI 品牌发现覆盖率为 ${coverageScore}%，推荐份额为 ${shareScore}%`,
          evidence: ['AI 对品牌知识问答的准确性评估'],
          confidence: adiFromDiscovery > 0 ? 60 : 20,
        },
      },
      {
        id: 'seo',
        name: '网站表现',
        score: Math.round(positionScore * 0.7 + coverageScore * 0.3),
        maxScore: 100,
        change: 0,
        explanation: {
          what: '品牌网站在搜索引擎和 AI 模型中的友好度与可检索性',
          why: `品牌搜索位置得分为 ${positionScore}，反映了品牌网站的 AI 可见性`,
          evidence: ['品牌搜索引擎排名', '网站结构化数据检测'],
          confidence: positionScore > 0 ? 60 : 20,
        },
      },
      {
        id: 'competition',
        name: '竞争定位',
        score: Math.round(Math.max(0, 100 - shareScore * 2 + coverageScore * 0.3)),
        maxScore: 100,
        change: 0,
        explanation: {
          what: '品牌相对于同行业竞品在 AI 生态系统中的表现和影响力',
          why: `品牌在 AI 推荐中的份额为 ${shareScore}%，市场份额表现反映了竞争地位`,
          evidence: ['竞品 AI 提及率对比'],
          confidence: shareScore > 0 ? 55 : 15,
        },
      },
      {
        id: 'freshness',
        name: '新鲜度',
        score: Math.round(snapshot ? 60 : 30),
        maxScore: 100,
        change: 0,
        explanation: {
          what: '品牌信息在 AI 知识库中的更新频率和时效性',
          why: snapshot
            ? `最近一次评分快照记录于 ${snapshot.createdAt?.toISOString?.()?.slice(0, 10) || '近期'}`
            : '尚未进行完整的品牌评估扫描',
          evidence: ['扫描历史记录', '品牌信息变更追踪'],
          confidence: snapshot ? 50 : 10,
        },
      },
    ]
  }

  // ──────────────────────────────────────────────
  // 私有方法 — 风险与机会
  // ──────────────────────────────────────────────

  /**
   * 基于维度分数构建风险评估
   */
  private buildRisks(
    dimensions: BrandHealthDimension[],
    evidenceCount: number
  ): BrandHealthRisk[] {
    const risks: BrandHealthRisk[] = []

    for (const dim of dimensions) {
      if (dim.score < 40) {
        risks.push({
          id: `risk-${dim.id}`,
          label: `${dim.name}评分偏低`,
          severity: dim.score < 20 ? 'high' : 'medium',
          affectedDimension: dim.id,
          description: `品牌「${dim.name}」维度得分为 ${dim.score}/100，处于较低水平`,
          impact: dim.score < 20
            ? '可能导致目标用户通过 AI 搜索时完全无法获取品牌信息'
            : '品牌在 AI 生态系统中的存在感正在被竞品超越',
        })
      }
    }

    // 证据覆盖不足风险
    if (evidenceCount === 0) {
      risks.push({
        id: 'risk-no-evidence',
        label: '品牌信息未被 AI 收录',
        severity: 'high',
        affectedDimension: 'visibility',
        description: '当前未检测到任何品牌在 AI 平台中的存在证据',
        impact: '品牌可能完全暴露在 AI 搜索之外，错失重要流量和认知度',
      })
    }

    return risks.slice(0, 5)
  }

  /**
   * 基于维度分数构建机会列表
   */
  private buildOpportunities(dimensions: BrandHealthDimension[]): BrandHealthOpportunity[] {
    const opportunities: BrandHealthOpportunity[] = []

    for (const dim of dimensions) {
      if (dim.score < 60) {
        const gain = Math.round((100 - dim.score) * 0.4)
        opportunities.push({
          id: `opp-${dim.id}`,
          label: `提升品牌${dim.name}至良好水平`,
          estimatedScoreGain: gain,
          affectedDimensions: [dim.id],
          effort: dim.score < 30 ? 'high' : dim.score < 50 ? 'medium' : 'low',
          description: `通过优化品牌信息在各个 AI 平台中的表现，将${dim.name}维度得分从 ${dim.score} 提升至 60+`,
        })
      }
    }

    // 如果所有维度都很好，提供一个整体提升机会
    if (opportunities.length === 0) {
      const lowestDim = dimensions.reduce((min, d) => (d.score < min.score ? d : min), dimensions[0])
      if (lowestDim) {
        opportunities.push({
          id: `opp-${lowestDim.id}-boost`,
          label: `持续提升${lowestDim.name}至优秀`,
          estimatedScoreGain: Math.round((100 - lowestDim.score) * 0.3),
          affectedDimensions: [lowestDim.id],
          effort: 'low',
          description: `品牌整体表现良好，建议持续关注${lowestDim.name}维度，保持竞争优势`,
        })
      }
    }

    return opportunities.slice(0, 5)
  }

  // ──────────────────────────────────────────────
  // 私有方法 — 摘要、证据、时间轴
  // ──────────────────────────────────────────────

  /**
   * 构建自然语言摘要
   */
  private buildSummary(
    dimensions: BrandHealthDimension[],
    risks: BrandHealthRisk[],
    opportunities: BrandHealthOpportunity[]
  ): BrandHealthSummary {
    const overallScore = Math.round(
      dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length
    )

    const whatIsWorking = dimensions
      .filter(d => d.score >= 60)
      .map(d => `${d.name}表现良好（${d.score}/100）`)

    const whatNeedsAttention = dimensions
      .filter(d => d.score < 60)
      .map(d => `${d.name}需要提升（${d.score}/100）- ${d.explanation.why}`)

    let overall = ''
    if (overallScore >= 80) overall = '品牌在 AI 生态系统中表现优秀，各项指标健康'
    else if (overallScore >= 60) overall = '品牌整体健康度良好，仍有提升空间'
    else if (overallScore >= 40) overall = '品牌在 AI 中的存在感一般，需要针对性改善'
    else overall = '品牌在 AI 生态中的可见性严重不足，建议立即采取行动'

    const nextBestAction = risks.length > 0
      ? `优先解决「${risks[0].label}」问题`
      : opportunities.length > 0
        ? `执行「${opportunities[0].label}」可预期提升 ${opportunities[0].estimatedScoreGain} 分`
        : '品牌表现优秀，持续监控即可'

    return {
      overall,
      whatIsWorking: whatIsWorking.length > 0 ? whatIsWorking : ['暂无足够数据评估优势领域'],
      whatNeedsAttention: whatNeedsAttention.length > 0 ? whatNeedsAttention : ['所有维度表现良好'],
      nextBestAction,
    }
  }

  /**
   * 构建证据覆盖信息
   */
  private buildEvidence(
    evidenceCount: number,
    sources: Array<{ provider: string; status: string; evidenceCount: number; lastCheckedAt: Date }>
  ): BrandHealthEvidence {
    const totalProviders = sources.length
    const availableProviders = sources.filter(s => s.status === 'available').length

    return {
      totalEvidenceCount: evidenceCount,
      providerCoverage: totalProviders > 0 ? Math.round((availableProviders / totalProviders) * 100) : 0,
      totalProviders,
      lastScanDate: sources.length > 0
        ? new Date(Math.max(...sources.map(s => s.lastCheckedAt.getTime()))).toISOString()
        : new Date().toISOString(),
      sources: sources.map(s => ({
        provider: s.provider,
        status: (s.status === 'available' ? 'available' : 'unavailable') as 'available' | 'unavailable' | 'error',
        evidenceCount: s.evidenceCount,
        lastCheckedAt: s.lastCheckedAt.toISOString(),
      })),
    }
  }

  /**
   * 构建时间轴
   */
  private buildTimeline(
    projectCreatedAt: string,
    latestSnapshot: any,
    previousSnapshot: any,
    scanHistory: any[]
  ): BrandHealthTimeline[] {
    const timeline: BrandHealthTimeline[] = []

    // 项目创建作为第一个里程碑
    timeline.push({
      date: projectCreatedAt,
      event: '品牌项目创建',
      type: 'milestone',
      detail: '品牌健康监控项目初始化',
    })

    // 从扫描历史生成事件
    for (const snap of scanHistory) {
      const snapData = snap.snapshot || snap.scores || {}
      const score = snapData.overall ?? 0

      timeline.push({
        date: (snap.createdAt as Date).toISOString(),
        event: `品牌健康扫描 — 总分 ${score}`,
        type: 'scan',
        score: Math.round(score),
        detail: snap.scanId
          ? `扫描记录 ID: ${snap.scanId}`
          : '自动评分快照',
      })
    }

    // 标记变化
    if (latestSnapshot && previousSnapshot) {
      const latestData = latestSnapshot.snapshot || latestSnapshot.scores || {}
      const prevData = previousSnapshot.snapshot || previousSnapshot.scores || {}
      const latestOverall = latestData.overall ?? 0
      const prevOverall = prevData.overall ?? 0
      const diff = Math.round(latestOverall - prevOverall)

      if (Math.abs(diff) > 5) {
        const type: 'improvement' | 'alert' = diff > 0 ? 'improvement' : 'alert'
        timeline.push({
          date: (latestSnapshot.createdAt as Date).toISOString(),
          event: diff > 0
            ? `品牌健康度提升 ${diff} 分`
            : `品牌健康度下降 ${Math.abs(diff)} 分`,
          type,
          score: Math.round(latestOverall),
          change: diff,
        })
      }
    }

    // 按日期排序（最新的在前）
    return timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }
}

// ── 单例导出 ──
export const brandHealthAggregator = new BrandHealthAggregator()
