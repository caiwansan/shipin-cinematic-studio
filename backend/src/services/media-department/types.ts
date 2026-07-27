// ============================================================
// Media Department Types — M1-A1
// Frozen output contract for Context Resolution
// ============================================================

/**
 * MediaDepartmentContext — 冻结输出契约
 * 这是 Media Department 产品层访问昆仑镜上下文的唯一数据结构。
 */
export interface MediaDepartmentContext {
  userId: string
  organizationId: string
  tenantId: string
  subscriptionStatus: SubscriptionStatus
  entitlement: EntitlementDTO
  capabilities: string[]
  agentAccess: AgentAccessDTO
}

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'suspended' | 'none'

export interface EntitlementDTO {
  planCode: string
  planName: string
  productType: string
  billingCycle: string
  capabilities: Record<string, any>
  grants: CapabilityGrantDTO[]
}

export interface CapabilityGrantDTO {
  capability: string
  limits?: Record<string, any>
}

export interface AgentAccessDTO {
  enabled: boolean
  maxAgents: number
  activeAgents: number
  agentProfiles: AgentProfileDTO[]
}

export interface AgentProfileDTO {
  id: string
  name: string
  role: string
  status: string
  agentType: string
}

// ─── Error Types ───

export class ContextResolutionError extends Error {
  constructor(
    public code: 'ORGANIZATION_REQUIRED' | 'SUBSCRIPTION_REQUIRED' | 'CAPABILITY_REQUIRED',
    message: string
  ) {
    super(message)
    this.name = 'ContextResolutionError'
  }
}

// ─── Audit Types ───

export interface ContextAuditEntry {
  userId: string
  organizationId: string
  tenantId: string
  timestamp: Date
  action: 'context_resolved'
  resolutionTimeMs: number
}
