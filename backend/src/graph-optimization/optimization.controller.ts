/**
 * Optimization Decision Layer — Controller
 *
 * Single endpoint that wraps the analytics engine and translates
 * results into optimization decision format.
 *
 * POST /api/graph-optimization/analyze
 *   body: { runId: string }
 *   returns: OptimizationResult
 */

import type { FastifyRequest, FastifyReply } from 'fastify'
import { analyzeRun } from '../replay-analytics/analysis/analytics.engine.js'
import { mapAnalyticsToOptimization } from './optimization.mapper.js'

interface AnalyzeRequest {
  runId: string
}

export async function handleOptimizationAnalyze(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { runId } = req.body as AnalyzeRequest

  if (!runId) {
    return reply.status(400).send({ ok: false, error: 'runId is required' })
  }

  try {
    const analytics = await analyzeRun(runId)
    const result = mapAnalyticsToOptimization(analytics)
    return reply.send(result)
  } catch (err: any) {
    if (err.message?.includes('not found')) {
      return reply.status(404).send({ ok: false, error: `Run not found: ${runId}` })
    }
    console.error('[optimization] analyze error:', err)
    return reply.status(500).send({ ok: false, error: err.message })
  }
}
