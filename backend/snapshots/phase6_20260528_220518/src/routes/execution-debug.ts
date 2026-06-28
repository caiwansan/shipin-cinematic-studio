import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/execution-debug.ts — Debug 审计 API
 *
 * 端点：
 *   GET  /api/v1/debug/:traceId       — 单条 debug 报告（根因分析）
 *   GET  /api/v1/debug/analyze         — 整体行为分析
 *   POST /api/v1/debug/diff/:a/:b   — 对比两条 trace
 *
 * Debug Layer 是纯事后解释，不参与任何执行路径。
 * 所有端点都是只读的。
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { traceService } from '../execution-trace/index.js'
import { generateDebugReport, analyzeTracePatterns, diffTraces, formatDiff } from '../execution-debug/index.js'
import { getProviderStateService } from '../runtime/provider-state/index.js'

export default async function executionDebugRoutes(fastify: FastifyInstance) {
  // GET /api/v1/debug/:traceId — 根因分析
  fastify.get('/api/v1/debug/:traceId', async (request: FastifyRequest<{ Params: { traceId: string } }>, reply: FastifyReply) => {
    const trace = traceService.get(request.params.traceId)
    if (!trace) {
      return reply.status(404).send({ success: false, error: 'Trace 未找到' })
    }

    // 尝试拿到 provider state（不强制）
    let state: any = undefined
    try {
      state = await getProviderStateService().get(trace.userId, trace.provider)
    } catch {}

    const report = generateDebugReport(trace, state)
    return { success: true, data: report } satisfies ApiResponse<unknown>;

  })

  // GET /api/v1/debug/analyze — 整体行为分析
  fastify.get('/api/v1/debug/analyze', async (request: FastifyRequest<{
    Querystring: { userId?: string; limit?: string }
  }>, reply: FastifyReply) => {
    const limit = parseInt(request.query.limit || '200', 10)
    const traces = traceService.list({
      limit: Math.min(limit, 1000),
      userId: request.query.userId,
    })

    const analysis = analyzeTracePatterns(traces)
    return { success: true, data: analysis } satisfies ApiResponse<unknown>;

  })

  // POST /api/v1/debug/diff/:a/:b — 对比两条 trace
  fastify.get('/api/v1/debug/diff/:a/:b', async (request: FastifyRequest<{ Params: { a: string; b: string } }>, reply: FastifyReply) => {
    const traceA = traceService.get(request.params.a)
    const traceB = traceService.get(request.params.b)

    if (!traceA || !traceB) {
      return reply.status(404).send({
        success: false,
        error: !traceA && !traceB
          ? '两条 trace 都未找到'
          : !traceA ? `Trace ${request.params.a} 未找到` : `Trace ${request.params.b} 未找到`,
      })
    }

    const diff = diffTraces(traceA, traceB)
    return {
      success: true,
      data: {
        ...diff,
        formatted: formatDiff(diff),
      },
    }
  })
}
