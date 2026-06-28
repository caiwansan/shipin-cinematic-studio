import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/feedback.ts — Director Layer v6.7 Feedback API
 *
 * 提供用户反馈收集和 VP-IR 质量查询端点。
 */
import { FastifyInstance } from 'fastify'
import { FeedbackCollector } from '../engine/prompt-compiler/feedback-collector.js'
import { getVPIRQuality, getAllFeedback } from '../engine/prompt-compiler/vp-ir-quality-schema.js'
import { evaluateGrammarAdjustments, recordAdjustment, getAdjustmentHistory } from '../engine/prompt-compiler/grammar-adjuster.js'

export default async function feedbackRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/feedback/execution
   * 记录模型执行反馈
   */
  fastify.post('/api/v1/feedback/execution', async (request, reply) => {
    const body = request.body as any
    if (!body.promptId || !body.model) {
      return reply.status(400).send({ success: false, error: '缺少 promptId 或 model' })
    }

    FeedbackCollector.recordExecution({
      promptId: body.promptId,
      model: body.model,
      success: body.success ?? true,
      latencyMs: body.latencyMs || 0,
      userAction: body.userAction,
      userRating: body.userRating,
      visualQualityScore: body.visualQualityScore,
    })

    return { success: true } satisfies ApiResponse<unknown>;

  })

  /**
   * POST /api/v1/feedback/user-action
   * 记录用户接受/重生成/修改行为
   */
  fastify.post('/api/v1/feedback/user-action', async (request, reply) => {
    const body = request.body as any
    if (!body.promptId || !body.action) {
      return reply.status(400).send({ success: false, error: '缺少 promptId 或 action' })
    }

    FeedbackCollector.recordUserAction({
      promptId: body.promptId,
      action: body.action,
    })

    return { success: true } satisfies ApiResponse<unknown>;

  })

  /**
   * GET /api/v1/feedback/quality/:irHash
   * 查询 VP-IR 质量评分
   */
  fastify.get('/api/v1/feedback/quality/:irHash', async (request, reply) => {
    const { irHash } = request.params as any
    const score = getVPIRQuality(irHash)
    if (!score) {
      return { success: true, data: null, message: '暂无评价数据' } satisfies ApiResponse<unknown>;

    }
    return { success: true, data: score } satisfies ApiResponse<unknown>;

  })

  /**
   * GET /api/v1/feedback/adjustments
   * 查看 grammar 调整历史
   */
  fastify.get('/api/v1/feedback/adjustments', async () => {
    return { success: true, data: getAdjustmentHistory() } satisfies ApiResponse<unknown>;

  })

  /**
   * GET /api/v1/feedback/summary
   * 反馈汇总
   */
  fastify.get('/api/v1/feedback/summary', async () => {
    const all = getAllFeedback()
    const total = all.length
    const success = all.filter((f) => f.success).length
    const accepted = all.filter((f) => f.userAction === 'accepted').length

    return {
      success: true,
      data: {
        totalFeedbacks: total,
        successRate: total > 0 ? success / total : 0,
        acceptanceRate: total > 0 ? accepted / total : 0,
      },
    }
  })
}
