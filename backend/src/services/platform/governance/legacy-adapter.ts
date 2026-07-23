/**
 * Governance Legacy Adapter
 * 
 * 隔离 governance_* 冻结表的前端/业务依赖。
 * 所有对 governance_* 表的读取必须经过此 adapter。
 * 当冻结表被清理后，只需修改 adapter 实现，不影响业务层。
 * 
 * @see KMKI-AUTHORITY-CONSTITUTION-v0.1
 */

import { prisma } from '../../../utils/index.js'

export type GovernanceSource = 'legacy' | 'current'

export interface GovernanceSnapshot<T = unknown> {
  source: GovernanceSource
  frozen: boolean
  message?: string
  data: T
}

export async function getGovernanceAuditLogs(params: {
  limit?: number
  offset?: number
}): Promise<GovernanceSnapshot<Array<Record<string, any>>>> {
  const { limit = 50, offset = 0 } = params
  const logs = await prisma.auditLog.findMany({
    take: Math.min(limit, 100),
    skip: offset,
    orderBy: { createdAt: 'desc' },
  })
  return { source: 'legacy', frozen: true, message: 'governance_audit_log is frozen.', data: logs }
}

export async function getGovernanceOrganization(orgId: string): Promise<GovernanceSnapshot<Record<string, any> | null>> {
  const org = await prisma.govOrganization.findUnique({ where: { id: orgId } })
  return { source: 'legacy', frozen: true, message: 'governance_organization is frozen.', data: org }
}

export async function getGovernanceUser(email: string): Promise<GovernanceSnapshot<Record<string, any> | null>> {
  const user = await prisma.govUser.findFirst({ where: { email } })
  return { source: 'legacy', frozen: true, message: 'governance_user is frozen.', data: user }
}

export async function getGovernanceCapabilityGrants(planId: string): Promise<GovernanceSnapshot<Array<Record<string, any>>>> {
  const grants = await prisma.capabilityGrant.findMany({ where: { planId } })
  return { source: 'legacy', frozen: true, message: 'governance_capability_grant is frozen.', data: grants }
}

export async function getGovernanceSubscriptionPlans(): Promise<GovernanceSnapshot<Array<Record<string, any>>>> {
  const plans = await prisma.subscriptionPlan.findMany()
  return { source: 'legacy', frozen: true, message: 'governance_subscription_plan is frozen.', data: plans }
}

export async function getGovernanceTenant(tenantId: string): Promise<GovernanceSnapshot<Record<string, any> | null>> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  return { source: 'legacy', frozen: true, message: 'governance_tenant is frozen.', data: tenant }
}

export const governanceLegacy = {
  getAuditLogs: getGovernanceAuditLogs,
  getOrganization: getGovernanceOrganization,
  getUser: getGovernanceUser,
  getCapabilityGrants: getGovernanceCapabilityGrants,
  getSubscriptionPlans: getGovernanceSubscriptionPlans,
  getTenant: getGovernanceTenant,
}
