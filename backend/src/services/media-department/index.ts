// ============================================================
// Media Department Module — M1-A1
// 统一导出
// ============================================================

// Types
export type {
  MediaDepartmentContext,
  SubscriptionStatus,
  EntitlementDTO,
  CapabilityGrantDTO,
  AgentAccessDTO,
  AgentProfileDTO,
  ContextAuditEntry,
} from './types.js'
export { ContextResolutionError } from './types.js'

// Adapters
export { govUserAdapter, GovUserAdapter } from './adapters/gov-user.adapter.js'
export type { GovUserAdapterResult } from './adapters/gov-user.adapter.js'

export { govOrganizationAdapter, GovOrganizationAdapter } from './adapters/gov-organization.adapter.js'
export type { GovOrganizationAdapterResult } from './adapters/gov-organization.adapter.js'

export { enterpriseSubscriptionAdapter, EnterpriseSubscriptionAdapter } from './adapters/enterprise-subscription.adapter.js'
export type { EnterpriseSubscriptionResult } from './adapters/enterprise-subscription.adapter.js'

export { enterpriseEntitlementAdapter, EnterpriseEntitlementAdapter } from './adapters/enterprise-entitlement.adapter.js'

export { agentAccessResolver, AgentAccessResolver } from './adapters/agent-access-resolver.js'
export type { AgentAccessConfig } from './adapters/agent-access-resolver.js'

// Services
export { mediaDepartmentContextService, MediaDepartmentContextService } from './context/media-department-context.service.js'
export { contextAuditService, ContextAuditService } from './context/context-audit.service.js'
