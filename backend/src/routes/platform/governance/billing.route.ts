// ============================================================
// Billing Route — KMKI-PLAT-012
// ============================================================

import type { FastifyInstance } from 'fastify'
import { governanceService } from '../../../services/platform/governance/governance.service.js'

export default async function billingRoute(app: FastifyInstance): Promise<void> {
  // Record billing
  app.post('/api/platform/governance/billing/record', async (req, reply) => {
    const data = req.body as any
    const record = await governanceService.billing.recordBilling(data, (req as any).userId)
    return reply.code(201).send({ success: true, data: record })
  })

  // Get billing history
  app.get('/api/platform/governance/billing/history/:tenantId', async (req, reply) => {
    const { tenantId } = req.params as any
    const { from, to } = req.query as any
    const history = await governanceService.billing.getBillingHistory(tenantId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    })
    return { success: true, data: history }
  })

  // Estimate cost
  app.get('/api/platform/governance/billing/estimate', async (req, reply) => {
    const { capability, resourceType, usage } = req.query as any
    const estimate = await governanceService.billing.estimateCost(capability, resourceType, usage ? parseFloat(usage) : 1)
    return { success: true, data: estimate }
  })

  // Get monthly cost
  app.get('/api/platform/governance/billing/monthly/:tenantId', async (req, reply) => {
    const { tenantId } = req.params as any
    const { year, month } = req.query as any
    const cost = await governanceService.billing.getMonthlyCost(tenantId, parseInt(year || new Date().getFullYear()), parseInt(month || (new Date().getMonth() + 1)))
    return { success: true, data: { tenantId, cost } }
  })
}
