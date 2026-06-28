// ============================================================
// Platform Event Types — unified event definitions for all Runtimes
// ARCH-001-D: Platform Event Review — unified event model
// ARCH-002: All events carry PlatformContext
// ============================================================

import { PlatformContext } from '../context/platform-context.js'

/**
 * Standard platform event type categories.
 * All Runtimes must use these canonical event names.
 */
export enum PlatformEventCategory {
  Created   = 'Created',
  Loaded    = 'Loaded',
  Validated = 'Validated',
  Updated   = 'Updated',
  Deleted   = 'Deleted',
  Started   = 'Started',
  Completed = 'Completed',
  Failed    = 'Failed',
  Disposed  = 'Disposed',
  Cancelled = 'Cancelled',
  Published = 'Published',
  Archived  = 'Archived',
}

/**
 * Domain-specific event types, composed as `${domain}:${category}`
 */
export type PlatformEventType =
  // Asset Domain
  | 'asset:Created'
  | 'asset:Loaded'
  | 'asset:Updated'
  | 'asset:Deleted'
  | 'asset:Versioned'
  | 'asset:Published'
  | 'asset:Archived'
  // Semantic Domain
  | 'semantic:Created'
  | 'semantic:Loaded'
  | 'semantic:Updated'
  | 'semantic:Deleted'
  | 'semantic:ExtractionCompleted'
  | 'semantic:RebuildCompleted'
  // Goal Domain
  | 'goal:Created'
  | 'goal:Activated'
  | 'goal:Updated'
  | 'goal:Deleted'
  | 'goal:Completed'
  | 'goal:Cancelled'
  | 'goal:Closed'
  | 'strategy:Generated'
  | 'workflow:Generated'
  | 'task:Created'
  | 'task:Completed'
  | 'task:Failed'
  | 'execution:Started'
  | 'execution:Completed'
  | 'execution:Failed'
  | 'review:Created'
  | 'review:Approved'
  | 'review:Rejected'
  // Capability Domain
  | 'capability:Registered'
  | 'capability:Updated'
  | 'capability:Deprecated'
  | 'capability:Removed'
  | 'capability:Validated'
  | 'capability:Resolved'
  // Resource Domain
  | 'resource:Registered'
  | 'resource:Updated'
  | 'resource:Degraded'
  | 'resource:Down'
  | 'resource:Recovered'
  // Credential Domain
  | 'credential:Expiring'
  | 'credential:Rotated'
  // Cost Domain
  | 'cost:ThresholdExceeded'
  // Agent Domain (KMKI-PLAT-010)
  | 'agent:Registered'
  | 'agent:Unregistered'
  | 'agent:SessionCreated'
  | 'agent:Planning'
  | 'agent:Executing'
  | 'agent:Streaming'
  | 'agent:Completed'
  | 'agent:Failed'
  | 'agent:Paused'
  | 'agent:Resumed'
  | 'agent:Cancelled'
  | 'agent:ToolCalled'
  // Governance Domain (KMKI-PLAT-012)
  | 'governance:TenantCreated'
  | 'governance:TenantActivated'
  | 'governance:TenantDeactivated'
  | 'governance:SubscriptionChanged'
  | 'governance:SubscriptionCancelled'
  | 'governance:SubscriptionExpired'
  | 'governance:QuotaExceeded'
  | 'governance:QuotaWarning'
  | 'governance:CapabilityAuthorized'
  | 'governance:CapabilityDenied'
  | 'governance:AuditLogged'
  | 'governance:PolicyEvaluated'
  | 'governance:PolicyViolated'
  | 'governance:LicenseExpired'
  | 'governance:BillingThresholdExceeded'
  | 'governance:BillingRecorded'
  | 'governance:RoleCreated'
  | 'governance:RoleAssigned'

/**
 * Standard platform event payload.
 * Every event carries a context for cross-cutting concerns.
 */
export interface PlatformEvent {
  type: PlatformEventType
  source: string        // runtime name e.g. 'asset', 'semantic', 'goal', 'capability'
  timestamp: string
  /** Full PlatformContext for traceability */
  context?: PlatformContext
  /** Backwards-compatible shortcut fields */
  traceId?: string
  entityId?: string
  projectId?: string
  payload?: Record<string, unknown>
  error?: {
    code: string
    message: string
  }
}
