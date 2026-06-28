// ============================================================
// Quota Route — KMKI-PLAT-012
// ============================================================

import type { FastifyInstance } from 'fastify'
import { governanceService } from '../../../services/platform/governance/governance.service.js'

export default async function quotaRoute(app: FastifyInstance): Promise<void> {
  // Init quota for tenant
  app.post('/api/platform/governance/quota/init', async (req, reply) => {
    const { tenantId, config } = req.body as any
    const quota = await governanceService.quota.initQuota(tenantId, config)
    return reply.code(201).send({ success: true, data: quota })
  })

  // Check quota
  app.get('/api/platform/governance/quota/check', async (req, reply) => {
    const { tenantId, resourceType, amount } = req.query as any
    const result = await governanceService.quota.checkQuota(tenantId, resourceType, amount ? parseInt(amount) : 1)
    return { success: true, data: result }
  })

  // Consume quota
  app.post('/api/platform/governance/quota/consume', async (req, reply) => {
    const { tenantId, resourceType, amount, source, sourceId, capability } = req.body as any
    const result = await governanceService.quota.consumeQuota(tenantId, resourceType, amount, source, sourceId, capability)
    return { success: true, data: result }
  })

  // Get usage
  app.get('/api/platform/governance/quota/usage/:tenantId', async (req, reply) => {
    const { tenantId } = req.params as any
    const { from, to } = req.query as any
    const usage = await governanceService.quota.getUsage(tenantId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    })
    return { success: true, data: usage }
  })

  // Get daily usage
  app.get('/api/platform/governance/quota/daily/:tenantId', async (req, reply) => {
    const { tenantId } = req.params as any
    const usage = await governanceService.quota.getDailyUsage(tenantId)
    return { success: true, data: usage }
  })
}
