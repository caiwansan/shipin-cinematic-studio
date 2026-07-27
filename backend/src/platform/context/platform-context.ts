/**
 * PlatformContext carries cross-cutting metadata through all Runtime operations.
 */
export interface PlatformContext {
  tenantId?: string
  workspaceId?: string
  projectId?: string
  goalId?: string
  workflowId?: string
  taskId?: string
  capabilityId?: string
  providerId?: string
  userId?: string
  locale?: string
  permissions?: string[]
  traceId?: string
  requestId?: string
  metadata?: Record<string, any>
}

export function createContext(overrides?: Partial<PlatformContext>): PlatformContext {
  return {}
}

export function mergeContext(parent: PlatformContext, child: Partial<PlatformContext>): PlatformContext {
  return { ...parent, ...child }
}
