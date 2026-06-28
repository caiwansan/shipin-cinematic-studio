// ============================================================
// Capability Authorization Route — KMKI-PLAT-012
// ============================================================

import type { FastifyInstance } from 'fastify'
import { governanceService } from '../../../services/platform/governance/governance.service.js'

export default async function capabilityAuthRoute(app: FastifyInstance): Promise<void> {
  // Authorize capability for tenant
  app.get('/api/platform/governance/auth/check', async (req, reply) => {
    const { tenantId, capability } = req.query as any
    const allowed = await governanceService.auth.authorize(tenantId, capability, (req as any).userId)
    return { success: true, data: { tenantId, capability, allowed } }
  })

  // Batch authorize
  app.post('/api/platform/governance/auth/check-batch', async (req, reply) => {
    const { tenantId, capabilities } = req.body as any
    const results = await governanceService.auth.authorizeBatch(tenantId, capabilities)
    return { success: true, data: results }
  })

  // Grant capability to plan
  app.post('/api/platform/governance/auth/grants', async (req, reply) => {
    const { planId, capability, limits } = req.body as any
    const grant = await governanceService.auth.grantCapability(planId, capability, limits)
    return reply.code(201).send({ success: true, data: grant })
  })

  // Revoke capability from plan
  app.delete('/api/platform/governance/auth/grants/:planId/:capability', async (req, reply) => {
    const { planId, capability } = req.params as any
    await governanceService.auth.revokeCapability(planId, capability)
    return { success: true }
  })

  // Get plan capabilities
  app.get('/api/platform/governance/auth/grants/:planId', async (req, reply) => {
    const { planId } = req.params as any
    const grants = await governanceService.auth.getPlanCapabilities(planId)
    return { success: true, data: grants }
  })
}
