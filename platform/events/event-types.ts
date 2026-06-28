// ============================================================
// Platform Event Types — unified event definitions for all Runtimes
// ARCH-001-D: Platform Event Review — unified event model
// ============================================================

/**
 * Standard platform event type categories.
 * All Runtimes must use these canonical event names.
 */
export enum PlatformEventCategory {
  Created   = 'Created',
  Loaded    = 'Loaded',
  Updated   = 'Updated',
  Deleted   = 'Deleted',
  Started   = 'Started',
  Completed = 'Completed',
  Failed    = 'Failed',
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

/**
 * Standard platform event payload.
 */
export interface PlatformEvent {
  type: PlatformEventType
  source: string        // runtime name e.g. 'asset', 'semantic', 'goal', 'capability'
  timestamp: string
  traceId?: string
  entityId?: string
  projectId?: string
  payload?: Record<string, unknown>
  error?: {
    code: string
    message: string
  }
}
