// ============================================================
// Subscription Route — KMKI-PLAT-012
// ============================================================

import type { FastifyInstance } from 'fastify'
import { governanceService } from '../../../services/platform/governance/governance.service.js'

export default async function subscriptionRoute(app: FastifyInstance): Promise<void> {
  // Create plan
  app.post('/api/platform/governance/plans', async (req, reply) => {
    const data = req.body as any
    const plan = await governanceService.subscription.createPlan(data)
    return reply.code(201).send({ success: true, data: plan })
  })

  // List plans
  app.get('/api/platform/governance/plans', async (req, reply) => {
    const { activeOnly } = req.query as any
    const plans = await governanceService.subscription.getPlans(activeOnly === 'true')
    return { success: true, data: plans }
  })

  // Subscribe tenant to plan
  app.post('/api/platform/governance/subscriptions', async (req, reply) => {
    const { tenantId, planId } = req.body as any
    const sub = await governanceService.subscription.subscribe(tenantId, planId, (req as any).userId)
    return reply.code(201).send({ success: true, data: sub })
  })

  // Get active subscription
  app.get('/api/platform/governance/subscriptions/active/:tenantId', async (req, reply) => {
    const { tenantId } = req.params as any
    const sub = await governanceService.subscription.getActiveSubscription(tenantId)
    return { success: true, data: sub }
  })

  // Cancel subscription
  app.post('/api/platform/governance/subscriptions/:tenantId/cancel', async (req, reply) => {
    const { tenantId } = req.params as any
    await governanceService.subscription.cancel(tenantId, (req as any).userId)
    return { success: true }
  })

  // Renew subscription
  app.post('/api/platform/governance/subscriptions/:tenantId/renew', async (req, reply) => {
    const { tenantId } = req.params as any
    const { planId } = req.body as any
    const sub = await governanceService.subscription.renew(tenantId, planId, (req as any).userId)
    return { success: true, data: sub }
  })

  // Check capability
  app.get('/api/platform/governance/capabilities/check', async (req, reply) => {
    const { tenantId, capability } = req.query as any
    const allowed = await governanceService.subscription.checkCapability(tenantId, capability)
    return { success: true, data: { tenantId, capability, allowed } }
  })

  // Get effective capabilities
  app.get('/api/platform/governance/capabilities/effective/:tenantId', async (req, reply) => {
    const { tenantId } = req.params as any
    const capabilities = await governanceService.subscription.getEffectiveCapabilities(tenantId)
    return { success: true, data: { tenantId, capabilities } }
  })
}
