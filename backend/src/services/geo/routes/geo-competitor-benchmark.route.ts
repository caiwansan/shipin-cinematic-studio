// ============================================================
// Competitor Benchmark Route — 竞品对标 API
// POST /api/geo/projects/:id/competitor-benchmark — 执行竞品对标
// ============================================================

import { FastifyInstance } from 'fastify'
import { runCompetitorBenchmark, isCompetitorBenchmarkAvailable } from '../services/competitor-benchmark.service.js'

export default async function geoCompetitorBenchmarkRoutes(fastify: FastifyInstance) {
  // POST /api/geo/projects/:id/competitor-benchmark — 执行竞品对标分析
  fastify.post('/api/geo/projects/:id/competitor-benchmark', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      customCompetitors?: string[]
      industryOverride?: string
    } | undefined

    try {
      if (!isCompetitorBenchmarkAvailable()) {
        return reply.status(503).send({
          success: false,
          error: '未配置 AI 引擎 API Key，请在系统设置中配置',
        })
      }

      const result = await runCompetitorBenchmark(id, {
        customCompetitors: body?.customCompetitors,
        industryOverride: body?.industryOverride,
      })

      return { success: true, data: result }
    } catch (err: any) {
      fastify.log.error(err, 'Competitor benchmark failed')
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id/competitor-benchmark/status — 检查是否可用
  fastify.get('/api/geo/projects/:id/competitor-benchmark/status', { preHandler: [] }, async (request, reply) => {
    try {
      return {
        success: true,
        data: {
          available: isCompetitorBenchmarkAvailable(),
        },
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
