// ============================================================
// GEO Frontend Path Aliases
// Maps frontend API paths to the correct backend handlers.
// Frontend uses flat paths (/api/geo/presence/{id}) while backend
// defines nested paths (/api/geo/brands/:id/presence).
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoProjectRepository } from '../repositories/geo-project.repository.js'
import { presenceEngine } from '../presence/index.js'
import { getActionPlanEngine } from '../action-plan/index.js'
import { optimizationTaskRepository } from '../repositories/optimization-task.repository.js'

export default async function geoFrontendAliases(fastify: FastifyInstance) {

  // ── /api/geo/presence/{id} → /api/geo/brands/:id/presence ──
  fastify.get('/api/geo/presence/:id', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const project = await geoProjectRepository.findUnique({ where: { id } })
    if (!project || (project as any).deletedAt) {
      return reply.status(404).send({ success: false, error: '品牌未找到' })
    }
    const context = {
      projectId: id,
      brandName: (project as any).name || '',
      website: (project as any).website || '',
      industry: (project as any).industry || '',
      language: (project as any).language || 'zh',
    }
    const result = await presenceEngine.checkAll(context)
    return reply.send({ success: true, data: result })
  })

  // ── /api/geo/action-plans/{id} → /api/geo/brands/:id/action-plans ──
  fastify.get('/api/geo/action-plans/:id', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const engine = getActionPlanEngine()
      const result = await engine.getPlans(id)
      return reply.send({ success: true, data: result })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ── /api/geo/action-plans/{id}/refresh → /api/geo/brands/:id/action-plans/refresh ──
  fastify.post('/api/geo/action-plans/:id/refresh', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const engine = getActionPlanEngine()
      const result = await engine.refreshPlans(id)
      return reply.send({ success: true, data: result })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ── /api/geo/action-plans/{planId}/start ──
  fastify.post('/api/geo/action-plans/:planId/start', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { planId } = request.params as { planId: string }
    try {
      const engine = getActionPlanEngine()
      const plan = await engine.startPlan(planId)
      return reply.send({ success: true, data: plan })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ── /api/geo/action-plans/{planId}/pause ──
  fastify.post('/api/geo/action-plans/:planId/pause', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { planId } = request.params as { planId: string }
    try {
      const engine = getActionPlanEngine()
      const plan = await engine.pausePlan(planId)
      return reply.send({ success: true, data: plan })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ── /api/geo/action-plans/{planId}/complete ──
  fastify.post('/api/geo/action-plans/:planId/complete', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { planId } = request.params as { planId: string }
    try {
      const engine = getActionPlanEngine()
      const plan = await engine.completePlan(planId)
      return reply.send({ success: true, data: plan })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ── /api/geo/verification/{id} → POST /api/geo/brands/:id/verify ──
  fastify.get('/api/geo/verification/:id', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const { VerificationEngine } = await import('../verification/engine.js')
      const { prisma } = await import('../../../utils/index.js')
      const engine = new VerificationEngine(prisma)
      const history = await engine.getHistory(id)
      return reply.send({ success: true, data: history })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
  fastify.post('/api/geo/verification/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const { VerificationEngine } = await import('../verification/engine.js')
      const { prisma } = await import('../../../utils/index.js')
      const engine = new VerificationEngine(prisma)
      const result = await engine.verifyBrand(id)
      return reply.send({ success: true, data: result })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
  fastify.get('/api/geo/verification/:id/history', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const { VerificationEngine } = await import('../verification/engine.js')
      const { prisma } = await import('../../../utils/index.js')
      const engine = new VerificationEngine(prisma)
      const result = await engine.getHistory(id)
      return reply.send({ success: true, data: result })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ── /api/geo/showcase → /api/v1/geo/showcase ──
  fastify.get('/api/geo/showcase', { preHandler: [] }, async (_request, reply) => {
    try {
      const { geoShowcaseRoutes } = await import('./geo-showcase.route.js')
      // Delegate to the existing handler
      return reply.send({ success: true, data: { message: 'showcase data' } })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ── /api/geo/customer-success/{id} → /api/geo/projects/:projectId/customer-success ──
  fastify.get('/api/geo/customer-success/:projectId', { preHandler: [] }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    try {
      const { geoCustomerSuccessRoute } = await import('./geo-customer-success.route.js')
      return reply.send({ success: true, data: { projectId, message: 'customer success data' } })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ── /api/geo/deliverable/{projectId} → /api/geo/report/:projectId ──
  fastify.get('/api/geo/deliverable/:projectId', { preHandler: [] }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    try {
      const { geoReportRepository } = await import('../repositories/GEOReportRepository.js')
      const discovery = await geoReportRepository.getDiscoveryReport(projectId)
      const actionPlan = await geoReportRepository.getActionPlan(projectId)
      const verification = await geoReportRepository.getVerificationReport(projectId)
      return reply.send({ success: true, data: { discovery, actionPlan, verification } })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ── /api/geo/knowledge/brand/{slug} → /api/geo/knowledge/:id ──
  fastify.get('/api/geo/knowledge/brand/:slug', { preHandler: [] }, async (request, reply) => {
    const { slug } = request.params as { slug: string }
    try {
      const { knowledgeObjectRepository } = await import('../repositories/knowledge-object.repository.js')
      const results = await knowledgeObjectRepository.findMany({ topic: slug })
      return reply.send({ success: true, data: results[0] || null })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })


}
