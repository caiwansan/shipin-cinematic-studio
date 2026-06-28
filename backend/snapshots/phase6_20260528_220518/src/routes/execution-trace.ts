import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/execution-trace.ts — Trace 审计 API
 *
 * 端点：
 *   GET  /api/v1/trace/list        — 列出 trace（支持分页 + userId 过滤）
 *   GET  /api/v1/trace/:id         — 获取单条 trace
 *   GET  /api/v1/trace/:id/replay  — 回放（dry-run 日志）
 *   POST /api/v1/trace/clear       — 清除所有 trace（管理员）
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { traceService, replayService } from '../execution-trace/index.js'

export default async function executionTraceRoutes(fastify: FastifyInstance) {
  // GET /api/v1/trace/list — 列出 trace
  fastify.get('/api/v1/trace/list', async (request: FastifyRequest<{
    Querystring: { limit?: string; offset?: string; userId?: string }
  }>, reply: FastifyReply) => {
    const limit = parseInt(request.query.limit || '50', 10)
    const offset = parseInt(request.query.offset || '0', 10)

    const traces = traceService.list({
      limit: Math.min(limit, 200),
      offset,
      userId: request.query.userId,
    })

    return {
      success: true,
      data: traces.map(t => ({
        id: t.id,
        userId: t.userId,
        taskType: t.taskType,
        provider: t.provider,
        model: t.model,
        status: t.status,
        error: t.error,
        startTime: t.startTime,
        endTime: t.endTime,
        durationMs: t.endTime ? t.endTime - t.startTime : undefined,
        steps: t.steps.length,
        inputSummary: t.inputSummary.substring(0, 100),
      })),
      total: traces.length,
    }
  })

  // GET /api/v1/trace/:id — 获取单条
  fastify.get('/api/v1/trace/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const trace = traceService.get(request.params.id)
    if (!trace) {
      return reply.status(404).send({ success: false, error: 'Trace 未找到' })
    }
    return { success: true, data: trace } satisfies ApiResponse<unknown>;

  })

  // GET /api/v1/trace/:id/replay — 回放
  fastify.get('/api/v1/trace/:id/replay', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = replayService.replayDryRun(request.params.id)
    if (!result.trace) {
      return reply.status(404).send({ success: false, error: 'Trace 未找到' })
    }

    return {
      success: true,
      data: {
        trace: {
          id: result.trace.id,
          userId: result.trace.userId,
          provider: result.trace.provider,
          model: result.trace.model,
          status: result.trace.status,
        },
        steps: result.steps,
        formatted: replayService.formatTrace(request.params.id),
      },
    }
  })

  // POST /api/v1/trace/clear — 清除（需要认证管理员）
  fastify.post('/api/v1/trace/clear', async (_request: FastifyRequest, reply: FastifyReply) => {
    traceService.clear()
    return { success: true, message: '所有 trace 已清除' } satisfies ApiResponse<unknown>;

  })
}
