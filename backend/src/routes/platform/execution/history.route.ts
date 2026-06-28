// ============================================================
// History Route — Execution history query endpoints
// ============================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { executionService } from '../../../services/platform/execution/execution.service.js'

export default async function historyRoute(app: FastifyInstance): Promise<void> {
  /**
   * Get execution history.
   */
  app.get('/platform/execution/history', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any
      const result = await executionService.getHistory(
        {
          capabilityId: query.capabilityId,
          status: query.status,
          fromDate: query.fromDate,
          toDate: query.toDate,
        },
        query.limit ? parseInt(query.limit) : 100,
      )

      return reply.send({
        success: true,
        data: result,
      })
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: (err as Error).message,
      })
    }
  })

  /**
   * Get metrics.
   */
  app.get('/platform/execution/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any
      let result: any

      if (query.capabilityId) {
        result = await executionService.getCapabilityMetrics(query.capabilityId)
      } else if (query.type === 'strategy') {
        result = await executionService.getStrategyMetrics()
      } else {
        result = await executionService.getMetrics()
      }

      return reply.send({
        success: true,
        data: result,
      })
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: (err as Error).message,
      })
    }
  })
}
