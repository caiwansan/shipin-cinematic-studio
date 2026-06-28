// ============================================================
// Plan Route — Plan CRUD endpoints
// ============================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { executionService } from '../../../services/platform/execution/execution.service.js'

export default async function planRoute(app: FastifyInstance): Promise<void> {
  /**
   * Get a plan by ID.
   */
  app.get('/platform/execution/plans/:planId', async (request: FastifyRequest<{ Params: { planId: string } }>, reply: FastifyReply) => {
    try {
      const { planId } = request.params
      const plan = await executionService.getPlan(planId)

      if (!plan) {
        return reply.status(404).send({
          success: false,
          error: `Plan not found: ${planId}`,
        })
      }

      return reply.send({
        success: true,
        data: plan,
      })
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: (err as Error).message,
      })
    }
  })

  /**
   * List plans with optional filtering.
   */
  app.get('/platform/execution/plans', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any
      const result = await executionService.listPlans({
        capabilityId: query.capabilityId,
        version: query.version,
        status: query.status,
        fromDate: query.fromDate,
        toDate: query.toDate,
        page: query.page ? parseInt(query.page) : 1,
        pageSize: query.pageSize ? parseInt(query.pageSize) : 50,
      })

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
   * Delete a plan by ID.
   */
  app.delete('/platform/execution/plans/:planId', async (request: FastifyRequest<{ Params: { planId: string } }>, reply: FastifyReply) => {
    try {
      const { planId } = request.params
      await executionService.deletePlan(planId)

      return reply.send({
        success: true,
        message: `Plan deleted: ${planId}`,
      })
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: (err as Error).message,
      })
    }
  })
}
