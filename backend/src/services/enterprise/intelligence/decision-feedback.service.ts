/**
 * Decision Feedback Service — Sprint 4.2.4-A
 * 职责: Outcome → Decision Confidence 反馈 (Contract 5)
 * CTO 冻结: 非 SSOT，仅作为未来 Decision Calibration 参考
 * 原始 Decision 记录必须保留，不可修改历史 Decision
 */
import { prisma } from '../../../utils/index.js'
import { governanceAuditService } from '../governance-audit.service.js'

export interface CreateFeedbackInput {
  tenantId: string
  governanceTenantId?: string | null
  decisionId: string
  outcomeId: string
  confidenceDelta: number
  reason?: string
  feedbackType?: string
}

export class DecisionFeedbackService {
  /**
   * 创建 Decision Feedback
   * CTO: Feedback 是独立实体，不是 Outcome 属性
   */
  async createFeedback(input: CreateFeedbackInput) {
    const feedback = await prisma.enterpriseDecisionFeedback.create({
      data: {
        tenantId: input.tenantId,
        governanceTenantId: input.governanceTenantId,
        decisionId: input.decisionId,
        outcomeId: input.outcomeId,
        confidenceDelta: input.confidenceDelta,
        reason: input.reason,
        feedbackType: input.feedbackType || 'learn',
        createdAt: new Date(),
      },
    })

    await governanceAuditService.log({
      governanceTenantId: input.governanceTenantId || '',
      actorId: 'system',
      actorType: 'system',
      action: 'decision_feedback.created',
      targetType: 'enterprise_decision_feedback',
      targetId: feedback.id,
      metadata: {
        decisionId: input.decisionId,
        outcomeId: input.outcomeId,
        confidenceDelta: input.confidenceDelta,
      },
    })

    return feedback
  }

  /**
   * 通过 Outcome 自动创建 Feedback
   * CTO: Outcome 状态变更时自动推断 confidenceDelta
   */
  async createFeedbackFromOutcome(outcomeId: string) {
    const outcome = await prisma.enterpriseOutcome.findUnique({
      where: { id: outcomeId },
      include: { action: true },
    })

    if (!outcome || !outcome.action) return null

    const decision = await prisma.enterpriseRecommendation.findUnique({
      where: { id: outcome.action.decisionId },
    })

    if (!decision) return null

    // CTO: 推断 confidenceDelta
    let confidenceDelta = 0
    let feedbackType = 'learn'

    if (outcome.status === 'VERIFIED') {
      confidenceDelta = 5
      feedbackType = 'boost'
    } else if (outcome.status === 'REJECTED' || outcome.status === 'INVALID') {
      confidenceDelta = -15
      feedbackType = 'warn'
    }

    if (confidenceDelta === 0) return null

    return this.createFeedback({
      tenantId: outcome.tenantId,
      governanceTenantId: outcome.governanceTenantId,
      decisionId: decision.id,
      outcomeId,
      confidenceDelta,
      reason: `Outcome ${outcome.status}: auto-inferred`,
      feedbackType,
    })
  }

  /**
   * 查询 Decision 的所有 Feedback
   */
  async listFeedbackByDecision(decisionId: string) {
    return prisma.enterpriseDecisionFeedback.findMany({
      where: { decisionId },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * 查询 Confidence 累计调整
   */
  async getAggregateConfidenceDelta(decisionId: string): Promise<number> {
    const feedbacks = await prisma.enterpriseDecisionFeedback.findMany({
      where: { decisionId },
      select: { confidenceDelta: true },
    })
    return feedbacks.reduce((sum, f) => sum + f.confidenceDelta, 0)
  }

  /**
   * 删除 Feedback
   */
  async deleteFeedback(id: string) {
    return prisma.enterpriseDecisionFeedback.delete({
      where: { id },
    })
  }
}

export const decisionFeedbackService = new DecisionFeedbackService()
