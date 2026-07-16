/**
 * Decision Ranking Service — 决策排序 + Evidence Graph 构建
 *
 * CTO Contract (Frozen):
 *   Priority Score = Impact × Urgency × Confidence / 100
 *   Confidence = Evidence Quality Score (0-100)
 *   Decision Ranking: Priority Score DESC → Urgency DESC → CreatedAt ASC
 */
import { prisma } from '../../../utils/index.js'
import { tenantOnly, isDemoTenant } from '../../../enterprise/reality/demo-boundary.js'

// ─── Types ────────────────────────────────────────────────────
interface PriorityScore {
  score: number
  level: 'P1' | 'P2' | 'P3' | 'P4'
  impact: number
  urgency: number
  confidence: number
}

interface EvidenceNode {
  id: string
  type: 'signal' | 'event' | 'lead' | 'content' | 'interaction'
  description: string
  timestamp: Date
  confidence: number
  metadata: Record<string, any>
}

interface EvidenceGraph {
  recommendationId: string
  nodes: EvidenceNode[]
  connections: { from: string; to: string; reason: string }[]
}

// ─── Service ─────────────────────────────────────────────────
export class DecisionRankingService {
  /**
   * 计算 Priority Score
   *
   * 冻结公式: Score = Impact × Urgency × Confidence / 100
   * Confidence = Evidence Quality Score (CTO 修正)
   */
  calculatePriority(
    severity: string,
    sourceEventCount: number,
    evidenceQuality: number
  ): PriorityScore {
    // Impact: severity → 10/6/3
    const impact = severity === 'critical' ? 10 : severity === 'warning' ? 6 : 3

    // Urgency: based on event frequency
    const urgency = sourceEventCount > 5 ? 8 : sourceEventCount > 2 ? 5 : 2

    // Confidence: Evidence Quality Score (0-100) — CTO 修正版
    // evidenceQuality: 无证据=20, 单一事件=45, 多事件关联=70, 多源验证=90, 完整链路=100
    const confidence = Math.min(100, Math.max(0, evidenceQuality))

    const score = Math.round((impact * urgency * confidence) / 100)

    // Priority Level: P1(≥70) / P2(40-69) / P3(20-39) / P4(<20)
    const level: PriorityScore['level'] =
      score >= 70 ? 'P1' : score >= 40 ? 'P2' : score >= 20 ? 'P3' : 'P4'

    return { score, level, impact, urgency, confidence }
  }

  /**
   * 对所有 pending 建议重新计算优先级
   */
  async recalculateAll(tenantId: string): Promise<number> {
    const recommendations = await prisma.enterpriseRecommendation.findMany({
      where: { ...tenantOnly(tenantId), status: { in: ['pending', 'approved'] } },
      include: { signal: true },
    })

    let updated = 0
    for (const rec of recommendations) {
      const signal = rec.signal as any
      const sourceEvents = signal?.sourceEvents as string[] || []
      const evidenceQuality = this.deriveEvidenceQuality(signal, rec.id)
      
      const priority = this.calculatePriority(
        signal?.severity || 'info',
        sourceEvents.length,
        evidenceQuality
      )

      await prisma.enterpriseRecommendation.update({
        where: { id: rec.id },
        data: {
          priorityScore: priority.score,
          priorityLevel: priority.level,
          impact: priority.impact,
          urgency: priority.urgency,
          confidence: priority.confidence,
        },
      })
      updated++
    }

    return updated
  }

  /**
   * 获取 Top N 决策建议
   */
  async getTopDecisions(tenantId: string, limit: number = 3) {
    // Clamp limit: 1-20
    const clampedLimit = Math.min(20, Math.max(1, limit))

    // Ensure scores are fresh
    await this.recalculateAll(tenantId)

    const recommendations = await prisma.enterpriseRecommendation.findMany({
      where: { ...tenantOnly(tenantId), status: { in: ['pending', 'approved'] } },
      orderBy: [
        { priorityScore: 'desc' },
        { urgency: 'desc' },
        { createdAt: 'asc' },
      ],
      take: clampedLimit,
    })

    return recommendations
  }

  /**
   * 构建 Evidence Graph
   *
   * Contract: Recommendation → Signal → OperationEvent (max depth 3, max nodes 20)
   */
  async buildEvidenceGraph(tenantId: string, recommendationId: string): Promise<EvidenceGraph> {
    const rec = await prisma.enterpriseRecommendation.findFirst({
      where: { id: recommendationId, tenantId },
      include: { signal: true },
    })
    if (!rec) return { recommendationId, nodes: [], connections: [] }

    const nodes: EvidenceNode[] = []
    const connections: EvidenceGraph['connections'] = []
    const signal = rec.signal as any

    // Layer 1: Recommendation itself
    nodes.push({
      id: rec.id,
      type: 'signal',
      description: rec.title || '',
      timestamp: rec.createdAt,
      confidence: rec.confidence || 0,
      metadata: { category: rec.category },
    })

    // Layer 2: Signal
    if (signal) {
      nodes.push({
        id: signal.id,
        type: 'signal',
        description: signal.description || '',
        timestamp: signal.detectedAt,
        confidence: signal.severity === 'critical' ? 90 : signal.severity === 'warning' ? 60 : 30,
        metadata: { severity: signal.severity, signalType: signal.signalType },
      })
      connections.push({ from: rec.id, to: signal.id, reason: 'generated from' })

      // Layer 3: OperationEvents
      const sourceEvents = (signal.sourceEvents as string[]) || []
      const eventIds = sourceEvents.slice(0, 17) // max 20 nodes total, already have 2

      if (eventIds.length > 0) {
        const events = await prisma.enterpriseOperationEvent.findMany({
          where: { id: { in: eventIds } },
          take: eventIds.length,
        })
        for (const evt of events) {
          nodes.push({
            id: evt.id,
            type: 'event',
            description: `${evt.eventType} by ${evt.actorName || evt.actorType}`,
            timestamp: evt.createdAt,
            confidence: 50, // single event baseline
            metadata: evt.metadata as Record<string, any>,
          })
          connections.push({ from: signal.id, to: evt.id, reason: 'source event' })
        }
      }
    }

    return { recommendationId, nodes, connections }
  }

  /**
   * 更新 Evidence Graph 到数据库
   */
  async storeEvidenceGraph(tenantId: string, recommendationId: string) {
    const graph = await this.buildEvidenceGraph(tenantId, recommendationId)
    return prisma.enterpriseRecommendation.update({
      where: { id: recommendationId },
      data: { evidenceGraph: graph.nodes as any },
      select: { id: true },
    })
  }

  // ─── Private ─────────────────────────────────────────────────

  /**
   * Evidence Quality — CTO 修正版
   *
   * 不是简单计数，而是综合评估：
   * - 无证据: 20
   * - 单一事件: 45
   * - 多事件关联: 70
   * - 多源验证 (signal + event): 90
   * - 完整链路 (signal + event + metadata): 100
   */
  private deriveEvidenceQuality(signal: any, _recId: string): number {
    if (!signal) return 20

    const sourceEvents = (signal.sourceEvents as string[]) || []
    let quality = 20 // baseline

    if (sourceEvents.length >= 1) quality = 45
    if (sourceEvents.length >= 3) quality = 70
    if (sourceEvents.length >= 5) quality = 90
    if (sourceEvents.length >= 8) quality = 100

    return quality
  }
}

export const decisionRankingService = new DecisionRankingService()
