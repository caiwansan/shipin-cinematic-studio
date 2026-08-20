/**
 * admin-prompt-trace.ts — Phase 4-C Prompt Debug Mode API
 *
 * 提供单次 Prompt 请求的 Trace 查询接口
 * 保障原则：
 * - 纯只读
 * - 不评分、不解释、不 AI 推测
 * - 只做结构化回放
 *
 * @phase-4c
 */

import { FastifyInstance } from 'fastify'
import { requireAdmin } from '../middleware/require-admin.js'
import { buildTrace, listRecentTraces } from '../runtime/prompt/PromptTraceBuilder.js'

export default async function adminPromptTraceRoutes(app: FastifyInstance) {
  // ─── 1. 查询单条 Trace（核心） ───
  app.get('/api/admin/prompt-telemetry/trace/:requestId', { preHandler: [requireAdmin] }, async (req: any, reply: any) => {
    const { requestId } = req.params as { requestId: string }

    if (!requestId || typeof requestId !== 'string' || requestId.length < 8) {
      return reply.status(400).send({ success: false, error: 'Invalid requestId' })
    }

    const result = await buildTrace(requestId)

    if ('error' in result) {
      return reply.status(404).send({ success: false, error: result.error })
    }

    return reply.send({ success: true, data: result })
  })

  // ─── 2. 查询最近 Trace 列表（用于前端入口） ───
  app.get('/api/admin/prompt-telemetry/traces/recent', { preHandler: [requireAdmin] }, async (req: any, reply: any) => {
    const query = req.query as { limit?: string }
    const limit = Math.min(parseInt(query.limit || '20', 10) || 20, 50)

    const traces = await listRecentTraces(limit)

    return reply.send({
      success: true,
      data: traces,
    })
  })
}
