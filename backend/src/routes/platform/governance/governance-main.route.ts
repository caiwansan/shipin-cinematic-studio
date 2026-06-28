// ============================================================
// Governance Main Route — aggregates all governance routes
// ============================================================

import type { FastifyInstance } from 'fastify'
import tenantRoute from './tenant.route.js'
import organizationRoute from './organization.route.js'
import subscriptionRoute from './subscription.route.js'
import capabilityAuthRoute from './capability-auth.route.js'
import quotaRoute from './quota.route.js'
import billingRoute from './billing.route.js'
import auditRoute from './audit.route.js'
import policyRoute from './policy.route.js'
import roleRoute from './role.route.js'
import licenseRoute from './license.route.js'
import analyticsRoute from './analytics.route.js'
import { governanceService } from '../../../services/platform/governance/governance.service.js'

export default async function governanceMainRoute(app: FastifyInstance): Promise<void> {
  await Promise.all([
    app.register(tenantRoute),
    app.register(organizationRoute),
    app.register(subscriptionRoute),
    app.register(capabilityAuthRoute),
    app.register(quotaRoute),
    app.register(billingRoute),
    app.register(auditRoute),
    app.register(policyRoute),
    app.register(roleRoute),
    app.register(licenseRoute),
    app.register(analyticsRoute),
  ])

  // Governance overview
  app.get('/api/platform/governance/overview/:tenantId', async (req, reply) => {
    const { tenantId } = req.params as any
    const overview = await governanceService.getOverview(tenantId)
    return { success: true, data: overview }
  })

  // Health check
  app.get('/api/platform/governance/health', async (req, reply) => {
    const health = await governanceService.healthCheck()
    return { success: true, data: health }
  })
}
