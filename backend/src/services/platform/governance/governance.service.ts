// ============================================================
// Governance Service — KMKI-PLAT-012
// Unified governance interface for all Runtime operations
// ============================================================

import { tenantRuntime } from './tenant/tenant-runtime.js'
import { subscriptionRuntime } from './subscription/subscription-runtime.js'
import { capabilityAuth } from './authorization/capability-auth.js'
import { quotaRuntime } from './quota/quota-runtime.js'
import { billingRuntime } from './billing/billing-runtime.js'
import { auditRuntime } from './audit/audit-runtime.js'
import { policyEngine } from './policy/policy-engine.js'
import { roleRuntime } from './role/role-runtime.js'
import { govOrgRuntime } from './organization/organization-runtime.js'
import { usageAnalytics } from './analytics/usage-analytics.js'
import { planRepository } from './repositories/plan.repository.js'
import { licenseRepository } from './repositories/license.repository.js'

export class GovernanceService {
  tenant = tenantRuntime
  subscription = subscriptionRuntime
  auth = capabilityAuth
  quota = quotaRuntime
  billing = billingRuntime
  audit = auditRuntime
  policy = policyEngine
  role = roleRuntime
  organization = govOrgRuntime
  analytics = usageAnalytics
  plans = planRepository
  licenses = licenseRepository

  async getOverview(tenantId: string) {
    const [tenant, sub, quota, recentAudit] = await Promise.all([
      this.tenant.getTenant(tenantId),
      this.subscription.getActiveSubscription(tenantId),
      this.quota.getUsage(tenantId),
      this.audit.getRecent(tenantId, 10),
    ])
    return { tenant, subscription: sub, quota: quota.quota, usage: quota.usage, recentAudit }
  }

  async healthCheck() {
    return { status: 'ok', service: 'governance', version: '1.0.0' }
  }
}

export const governanceService = new GovernanceService()
