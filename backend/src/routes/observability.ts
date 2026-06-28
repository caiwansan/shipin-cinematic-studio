/**
 * routes/observability.ts
 *
 * Observe-only API endpoints for OGES v1 Control Tower.
 * No production impact. No pipeline changes. Read-only.
 */

import type { FastifyInstance } from 'fastify'
import { convergenceDashboard } from '../observability/dashboard/ctblConvergenceDashboard.js'
import { trendTracker } from '../observability/dashboard/ctblTrendTracker.js'
import { varianceDetector } from '../observability/dashboard/ctblVarianceDecayDetector.js'
import { OGESSafetyGuard } from '../infra/oges/ogesSafetyGuard.js'

export default async function observabilityRoutes(fastify: FastifyInstance) {
  // Safety guard — validate all observability access
  fastify.addHook('preHandler', async (request, reply) => {
    if (!OGESSafetyGuard.validateObservabilityAccess(request.url)) {
      return reply.status(403).send({ success: false, error: 'UNAUTHORIZED OBSERVABILITY ACCESS', baseline: 'v1.0_IMMUTABLE' })
    }
  })

  // GET /api/observability/ctbl/convergence
  // Returns statistical convergence snapshot for CSIP readiness
  fastify.get('/api/observability/ctbl/convergence', async (_request, reply) => {
    try {
      const snapshot = convergenceDashboard.getSnapshot()
      return reply.send({ success: true, data: snapshot })
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // GET /api/observability/ctbl/trend
  // Returns convergence trend history
  fastify.get('/api/observability/ctbl/trend', async (_request, reply) => {
    try {
      const history = trendTracker.getHistory()
      return reply.send({ success: true, data: { points: history, count: history.length } })
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // GET /api/observability/ctbl/trend/summary
  // Returns convergence summary
  fastify.get('/api/observability/ctbl/trend/summary', async (_request, reply) => {
    try {
      const summary = trendTracker.getSummary()
      return reply.send({ success: true, data: summary })
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // GET /api/observability/ctbl/variance
  // Returns variance decay prediction
  fastify.get('/api/observability/ctbl/variance', async (_request, reply) => {
    try {
      const snapshot = convergenceDashboard.getSnapshot()
      const decay = varianceDetector.evaluate(
        snapshot.sampleSize,
        snapshot.metrics.gsr,
        snapshot.metrics.csr,
      )
      return reply.send({ success: true, data: decay })
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })
}
