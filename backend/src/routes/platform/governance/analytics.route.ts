// ============================================================
// Analytics Route — KMKI-PLAT-012
// ============================================================

import type { FastifyInstance } from 'fastify'
import { governanceService } from '../../../services/platform/governance/governance.service.js'

export default async function analyticsRoute(app: FastifyInstance): Promise<void> {
  // Get usage summary
  app.get('/api/platform/governance/analytics/summary/:tenantId', async (req, reply) => {
    const { tenantId } = req.params as any
    const { from, to } = req.query as any
    const now = new Date()
    const period = {
      from: from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1),
      to: to ? new Date(to) : now,
    }
    const summary = await governanceService.analytics.getUsageSummary(tenantId, period)
    return { success: true, data: summary }
  })

  // Get top capabilities
  app.get('/api/platform/governance/analytics/top-capabilities/:tenantId', async (req, reply) => {
    const { tenantId } = req.params as any
    const { from, to, limit } = req.query as any
    const now = new Date()
    const period = {
      from: from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1),
      to: to ? new Date(to) : now,
    }
    const top = await governanceService.analytics.getTopCapabilities(tenantId, period, limit ? parseInt(limit) : 10)
    return { success: true, data: top }
  })

  // Get cost trend
  app.get('/api/platform/governance/analytics/cost-trend/:tenantId', async (req, reply) => {
    const { tenantId } = req.params as any
    const { from, to } = req.query as any
    const now = new Date()
    const period = {
      from: from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1),
      to: to ? new Date(to) : now,
    }
    const trend = await governanceService.analytics.getCostTrend(tenantId, period)
    return { success: true, data: trend }
  })
}
