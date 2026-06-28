/**
 * Replay Analytics API Controller
 *
 * GET  /api/replay-analytics/runs          — list analyzed runs
 * GET  /api/replay-analytics/runs/:runId   — full analysis for a run
 * GET  /api/replay-analytics/runs/:runId/bottlenecks  — bottleneck only
 * GET  /api/replay-analytics/runs/:runId/cost         — cost only
 * GET  /api/replay-analytics/runs/:runId/suggestions   — optimization suggestions
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { analyzeRun } from '../analysis/analytics.engine.js'

export async function registerReplayAnalyticsRoutes(app: FastifyInstance) {
  // List all runs (delegate to runtime service)
  app.get('/api/replay-analytics/runs', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { listAllRuns } = await import('../../api/runtime/runtime.service.js')
      const result = await listAllRuns()
      return reply.send(result)
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message })
    }
  })

  // Full analysis for a single run
  app.get('/api/replay-analytics/runs/:runId', async (req: FastifyRequest<{ Params: { runId: string } }>, reply: FastifyReply) => {
    try {
      const analysis = await analyzeRun(req.params.runId)
      return reply.send(analysis)
    } catch (err: any) {
      return reply.status(404).send({ ok: false, error: err.message })
    }
  })

  // Bottleneck only
  app.get('/api/replay-analytics/runs/:runId/bottlenecks', async (req: FastifyRequest<{ Params: { runId: string } }>, reply: FastifyReply) => {
    try {
      const analysis = await analyzeRun(req.params.runId)
      return reply.send({ bottleneck: analysis.bottleneck, metrics: analysis.metrics })
    } catch (err: any) {
      return reply.status(404).send({ ok: false, error: err.message })
    }
  })

  // Cost only
  app.get('/api/replay-analytics/runs/:runId/cost', async (req: FastifyRequest<{ Params: { runId: string } }>, reply: FastifyReply) => {
    try {
      const analysis = await analyzeRun(req.params.runId)
      return reply.send({ cost: analysis.cost, metrics: analysis.metrics })
    } catch (err: any) {
      return reply.status(404).send({ ok: false, error: err.message })
    }
  })

  // Suggestions only
  app.get('/api/replay-analytics/runs/:runId/suggestions', async (req: FastifyRequest<{ Params: { runId: string } }>, reply: FastifyReply) => {
    try {
      const analysis = await analyzeRun(req.params.runId)
      return reply.send({ optimization: analysis.optimization, bottleneck: analysis.bottleneck })
    } catch (err: any) {
      return reply.status(404).send({ ok: false, error: err.message })
    }
  })

  // Batch analysis (analyze multiple runs)
  app.post('/api/replay-analytics/analyze', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = req.body as { runIds?: string[] }
      if (!body.runIds || body.runIds.length === 0) {
        return reply.status(400).send({ ok: false, error: 'runIds required' })
      }
      const results = await Promise.allSettled(body.runIds.map(analyzeRun))
      const analyses = results
        .filter(r => r.status === 'fulfilled')
        .map((r: any) => r.value)
      return reply.send({ analyses, count: analyses.length })
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message })
    }
  })
}
