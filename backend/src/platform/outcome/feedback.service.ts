/**
 * FeedbackService — DecisionFeedback CRUD
 * OI-01 Schema Foundation
 */

import { prisma } from '../../utils/index.js'
import type {
  CreateFeedbackInput,
  DecisionFeedback,
  FeedbackType,
} from './types.js'

export const FeedbackService = {
  /**
   * 创建 DecisionFeedback
   */
  async create(input: CreateFeedbackInput): Promise<DecisionFeedback> {
    return prisma.decisionFeedback.create({
      data: {
        organizationId: input.organizationId,
        decisionId: input.decisionId,
        actionId: input.actionId,
        outcomeId: input.outcomeId,
        feedbackType: input.feedbackType ?? 'UNKNOWN',
        feedbackData: input.feedbackData ?? {},
      },
    })
  },

  /**
   * 获取组织的 DecisionFeedback 列表
   */
  async listByOrganization(
    organizationId: string,
    options?: {
      feedbackType?: FeedbackType
      decisionId?: string
      actionId?: string
      limit?: number
      offset?: number
    },
  ): Promise<DecisionFeedback[]> {
    return prisma.decisionFeedback.findMany({
      where: {
        organizationId,
        ...(options?.feedbackType ? { feedbackType: options.feedbackType } : {}),
        ...(options?.decisionId ? { decisionId: options.decisionId } : {}),
        ...(options?.actionId ? { actionId: options.actionId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    })
  },

  /**
   * 获取 Decision 的历史反馈 (用于 Decision Engine 学习)
   */
  async getDecisionHistory(
    decisionId: string,
    organizationId: string,
  ): Promise<DecisionFeedback[]> {
    return prisma.decisionFeedback.findMany({
      where: {
        decisionId,
        organizationId,
      },
      orderBy: { createdAt: 'asc' },
    })
  },

  /**
   * 统计组织的 Feedback 分布
   */
  async countByOrganization(
    organizationId: string,
  ): Promise<Record<string, number>> {
    const records = await prisma.decisionFeedback.findMany({
      where: { organizationId },
      select: { feedbackType: true },
    })

    const counts: Record<string, number> = {}
    for (const r of records) {
      counts[r.feedbackType] = (counts[r.feedbackType] ?? 0) + 1
    }
    return counts
  },
}
