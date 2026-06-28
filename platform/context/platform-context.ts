// ============================================================
// Platform Context — unified context for all Runtime operations
// ARCH-001-E: All Runtime method signatures must use this interface
// ============================================================

/**
 * PlatformContext carries cross-cutting metadata through all Runtime operations.
 * Inspired by OpenTelemetry baggage and HTTP request context patterns.
 */
export interface PlatformContext {
  /** Tenant identification */
  tenantId?: string
  /** Workspace / space identification */
  workspaceId?: string
  /** Project scope */
  projectId?: string
  /** Goal scope for execution */
  goalId?: string
  /** Workflow scope */
  workflowId?: string
  /** Task scope */
  taskId?: string
  /** Capability scope */
  capabilityId?: string
  /** Provider scope */
  providerId?: string

  /** User / identity */
  userId?: string
  /** User locale for i18n */
  locale?: string
  /** Permission claims */
  permissions?: string[]

  /** Observability */
  traceId?: string
  requestId?: string

  /** Arbitrary metadata for extensibility */
  metadata?: Record<string, any>
}

/**
 * Create a context with defaults.
 */
export function createContext(overrides: Partial<PlatformContext> = {}): PlatformContext {
  return {
    traceId: overrides.traceId || `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    requestId: overrides.requestId || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...overrides,
  }
}

/**
 * Merge child context into parent, child fields take precedence.
 */
export function mergeContext(parent: PlatformContext, child: Partial<PlatformContext>): PlatformContext {
  return { ...parent, ...child }
}
