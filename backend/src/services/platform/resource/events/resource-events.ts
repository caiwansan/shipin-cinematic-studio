// ============================================================
// Resource Events — unified event definitions for Resource Runtime
// KMKI-PLAT-008
// ============================================================

import { platformEventBus } from '@platform/events/event-bus'
import type { PlatformContext } from '@platform/context/platform-context'

/**
 * Emit a ResourceRegistered event.
 */
export function emitResourceRegistered(resourceId: string, resourceName: string, resourceType: string, ctx?: PlatformContext): void {
  platformEventBus.emit({
    type: 'resource:Registered' as any,
    source: 'resource',
    timestamp: new Date().toISOString(),
    context: ctx,
    entityId: resourceId,
    payload: { resourceId, resourceName, resourceType },
  })
}

/**
 * Emit a ResourceUpdated event.
 */
export function emitResourceUpdated(resourceId: string, changes: Record<string, any>, ctx?: PlatformContext): void {
  platformEventBus.emit({
    type: 'resource:Updated' as any,
    source: 'resource',
    timestamp: new Date().toISOString(),
    context: ctx,
    entityId: resourceId,
    payload: { resourceId, changes },
  })
}

/**
 * Emit a ResourceDegraded event.
 */
export function emitResourceDegraded(resourceId: string, reason: string, ctx?: PlatformContext): void {
  platformEventBus.emit({
    type: 'resource:Degraded' as any,
    source: 'resource',
    timestamp: new Date().toISOString(),
    context: ctx,
    entityId: resourceId,
    payload: { resourceId, reason, status: 'degraded' },
  })
}

/**
 * Emit a ResourceDown event.
 */
export function emitResourceDown(resourceId: string, reason: string, ctx?: PlatformContext): void {
  platformEventBus.emit({
    type: 'resource:Down' as any,
    source: 'resource',
    timestamp: new Date().toISOString(),
    context: ctx,
    entityId: resourceId,
    payload: { resourceId, reason, status: 'down' },
  })
}

/**
 * Emit a ResourceRecovered event.
 */
export function emitResourceRecovered(resourceId: string, ctx?: PlatformContext): void {
  platformEventBus.emit({
    type: 'resource:Recovered' as any,
    source: 'resource',
    timestamp: new Date().toISOString(),
    context: ctx,
    entityId: resourceId,
    payload: { resourceId, status: 'healthy' },
  })
}

/**
 * Emit a CredentialExpiring event.
 */
export function emitCredentialExpiring(credentialId: string, resourceId: string, expiresAt: Date, ctx?: PlatformContext): void {
  platformEventBus.emit({
    type: 'credential:Expiring' as any,
    source: 'resource',
    timestamp: new Date().toISOString(),
    context: ctx,
    entityId: credentialId,
    payload: { credentialId, resourceId, expiresAt: expiresAt.toISOString() },
  })
}

/**
 * Emit a CostThresholdExceeded event.
 */
export function emitCostThresholdExceeded(tenantId: string, resourceId: string, cost: number, threshold: number, ctx?: PlatformContext): void {
  platformEventBus.emit({
    type: 'cost:ThresholdExceeded' as any,
    source: 'resource',
    timestamp: new Date().toISOString(),
    context: ctx,
    entityId: resourceId,
    payload: { tenantId, resourceId, cost, threshold },
  })
}

/**
 * Emit a CredentialRotated event.
 */
export function emitCredentialRotated(credentialId: string, resourceId: string, ctx?: PlatformContext): void {
  platformEventBus.emit({
    type: 'credential:Rotated' as any,
    source: 'resource',
    timestamp: new Date().toISOString(),
    context: ctx,
    entityId: credentialId,
    payload: { credentialId, resourceId },
  })
}
