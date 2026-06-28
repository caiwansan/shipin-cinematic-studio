/**
 * decision-routes.ts — Phase A-5 Runtime Exposure Layer
 *
 * 昆仑镜 Fastify 路由注册
 * 路由前缀: POST /decision/execute, GET /decision/trace/:id, POST /decision/replay, GET /decision/traces, GET /decision/stats
 *
 * 宪法约束：
 *   1. 这些路由不做任何业务逻辑
 *   2. 这些路由只把请求转发给 DecisionExposure 层
 *   3. 输入/输出格式在 exposure-contract.ts 中定义
 *
 * @phase decision-runtime
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { createDecisionExposure } from './decision-exposure.js'
import type { ExecuteRequest, ReplayRequest } from './decision-exposure.js'

const exposure = createDecisionExposure()

export async function registerDecisionRoutes(app: FastifyInstance): Promise<void> {
  // ═══════════════════════════════════════════
  // POST /decision/execute — 执行一次决策
  // ═══════════════════════════════════════════
  app.post('/decision/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as ExecuteRequest
      if (!body || !body.requirement) {
        return reply.status(400).send({
          error: '缺少 requirement 字段',
          code: 'MISSING_REQUIREMENT',
        })
      }

      const result = await exposure.execute({
        requirement: body.requirement,
        mode: body.mode ?? 'exploratory',
        source: body.source ?? 'api',
      })

      return reply.status(result.status === 'FAILED' || result.status === 'REJECTED' ? 400 : 200).send(result)
    } catch (err: any) {
      return reply.status(500).send({
        error: `执行时发生异常: ${err.message}`,
        code: 'EXECUTION_ERROR',
      })
    }
  })

  // ═══════════════════════════════════════════
  // GET /decision/trace/:id — 查询 Trace 详情
  // ═══════════════════════════════════════════
  app.get('/decision/trace/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const trace = exposure.getTrace(id)

      if (!trace) {
        return reply.status(404).send({
          error: `Trace ${id} 不存在`,
          code: 'TRACE_NOT_FOUND',
        })
      }

      return reply.status(200).send(trace)
    } catch (err: any) {
      return reply.status(500).send({
        error: `查询 Trace 时发生异常: ${err.message}`,
        code: 'TRACE_QUERY_ERROR',
      })
    }
  })

  // ═══════════════════════════════════════════
  // POST /decision/replay — 回放 Trace
  // ═══════════════════════════════════════════
  app.post('/decision/replay', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as ReplayRequest
      if (!body || !body.traceId) {
        return reply.status(400).send({
          error: '缺少 traceId 字段',
          code: 'MISSING_TRACE_ID',
        })
      }

      const result = await exposure.replay({
        traceId: body.traceId,
        mode: body.mode ?? 'exploratory',
      })

      return reply.status(result.status === 'FAILED' || result.status === 'REJECTED' ? 400 : 200).send(result)
    } catch (err: any) {
      return reply.status(500).send({
        error: `回放时发生异常: ${err.message}`,
        code: 'REPLAY_ERROR',
      })
    }
  })

  // ═══════════════════════════════════════════
  // GET /decision/traces — Trace 列表
  // ═══════════════════════════════════════════
  app.get('/decision/traces', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { limit?: string }
      const limit = query.limit ? parseInt(query.limit, 10) : undefined
      const traces = exposure.listTraces(limit)

      return reply.status(200).send({
        total: traces.length,
        traces,
      })
    } catch (err: any) {
      return reply.status(500).send({
        error: `查询 Trace 列表时发生异常: ${err.message}`,
        code: 'LIST_ERROR',
      })
    }
  })

  // ═══════════════════════════════════════════
  // GET /decision/stats — 统计信息
  // ═══════════════════════════════════════════
  app.get('/decision/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = exposure.getStats()
      return reply.status(200).send(stats)
    } catch (err: any) {
      return reply.status(500).send({
        error: `获取统计信息时发生异常: ${err.message}`,
        code: 'STATS_ERROR',
      })
    }
  })
}
