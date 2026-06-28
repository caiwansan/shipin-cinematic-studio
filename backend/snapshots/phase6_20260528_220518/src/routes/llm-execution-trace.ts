/**
 * routes/llm-execution-trace.ts
 *
 * LLM Execution Graph 可观测 API
 * GET /api/llm-runtime/traces — 查询执行 trace
 *
 * ❗ 直接使用 prisma 实例（跳过 trace store 的 lazy import 路径问题）
 */

import { FastifyInstance } from 'fastify'
import { queryTraces as traceQuery } from '../llm-execution-graph-v2/trace'

export default async function llmExecutionTraceRoutes(app: FastifyInstance) {
  app.get('/api/llm-runtime/traces', async (request: any, reply) => {
    const userId = (request.query as any)?.userId as string | undefined
    const limit = parseInt((request.query as any)?.limit as string) || 100
    const offset = parseInt((request.query as any)?.offset as string) || 0

    try {
      const traces = await traceQuery({ userId, limit, offset })
      return {
        count: traces.length,
        traces,
        query: { userId, limit, offset },
      }
    } catch (err: any) {
      reply.code(500)
      return { error: err.message }
    }
  })
}
