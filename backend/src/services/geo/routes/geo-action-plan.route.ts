// ============================================================
// GEO Action Plan Route — P0-T007 Action Plan Engine
// GET    /api/geo/brands/:id/action-plans
// POST   /api/geo/brands/:id/action-plans/refresh
// POST   /api/geo/brands/:id/action-plans/:planId/start
// POST   /api/geo/brands/:id/action-plans/:planId/pause
// POST   /api/geo/brands/:id/action-plans/:planId/complete
// ============================================================

import { FastifyInstance } from 'fastify'
import { getActionPlanEngine } from '../action-plan/index.js'

export default async function geoActionPlanRoutes(fastify: FastifyInstance) {
  // GET /api/geo/brands/:id/action-plans — 获取 Action Plans
  fastify.get(
    '/api/geo/brands/:id/action-plans',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      try {
        const engine = getActionPlanEngine()
        const result = await engine.getPlans(id)
        return reply.send({ success: true, data: result })
      } catch (err: any) {
        return reply.status(500).send({ success: false, error: err.message })
      }
    }
  )

  // POST /api/geo/brands/:id/action-plans/refresh — 刷新（从 recommendations 重建）
  fastify.post(
    '/api/geo/brands/:id/action-plans/refresh',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      try {
        const engine = getActionPlanEngine()
        const result = await engine.refreshPlans(id)
        return reply.send({ success: true, data: result })
      } catch (err: any) {
        return reply.status(500).send({ success: false, error: err.message })
      }
    }
  )

  // POST /api/geo/brands/:id/action-plans/:planId/start — 开始
  fastify.post(
    '/api/geo/brands/:id/action-plans/:planId/start',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { planId } = request.params as { planId: string }
      try {
        const engine = getActionPlanEngine()
        const plan = await engine.startPlan(planId)
        return reply.send({ success: true, data: plan })
      } catch (err: any) {
        return reply.status(500).send({ success: false, error: err.message })
      }
    }
  )

  // POST /api/geo/brands/:id/action-plans/:planId/pause — 暂停
  fastify.post(
    '/api/geo/brands/:id/action-plans/:planId/pause',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { planId } = request.params as { planId: string }
      try {
        const engine = getActionPlanEngine()
        const plan = await engine.pausePlan(planId)
        return reply.send({ success: true, data: plan })
      } catch (err: any) {
        return reply.status(500).send({ success: false, error: err.message })
      }
    }
  )

  // POST /api/geo/brands/:id/action-plans/:planId/complete — 完成
  fastify.post(
    '/api/geo/brands/:id/action-plans/:planId/complete',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { planId } = request.params as { planId: string }
      try {
        const engine = getActionPlanEngine()
        const plan = await engine.completePlan(planId)
        return reply.send({ success: true, data: plan })
      } catch (err: any) {
        return reply.status(500).send({ success: false, error: err.message })
      }
    }
  )
}
