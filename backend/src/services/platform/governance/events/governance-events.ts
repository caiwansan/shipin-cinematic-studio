// ============================================================
// Governance Events — KMKI-PLAT-012
// Uses canonical PlatformEventType from @platform/events/event-types
// ============================================================

import type { PlatformEvent } from '@platform/events/event-types.js'

export function createTenantCreatedEvent(tenantId: string, details?: Record<string, any>): PlatformEvent {
  return { type: 'governance:TenantCreated', source: 'governance', timestamp: new Date().toISOString(), entityId: tenantId, payload: details }
}

export function createTenantActivatedEvent(tenantId: string, details?: Record<string, any>): PlatformEvent {
  return { type: 'governance:TenantActivated', source: 'governance', timestamp: new Date().toISOString(), entityId: tenantId, payload: details }
}

export function createTenantDeactivatedEvent(tenantId: string, details?: Record<string, any>): PlatformEvent {
  return { type: 'governance:TenantDeactivated', source: 'governance', timestamp: new Date().toISOString(), entityId: tenantId, payload: details }
}

export function createSubscriptionChangedEvent(tenantId: string, details?: Record<string, any>): PlatformEvent {
  return { type: 'governance:SubscriptionChanged', source: 'governance', timestamp: new Date().toISOString(), entityId: tenantId, payload: details }
}

export function createSubscriptionCancelledEvent(tenantId: string, details?: Record<string, any>): PlatformEvent {
  return { type: 'governance:SubscriptionCancelled', source: 'governance', timestamp: new Date().toISOString(), entityId: tenantId, payload: details }
}

export function createQuotaExceededEvent(tenantId: string, details?: Record<string, any>): PlatformEvent {
  return { type: 'governance:QuotaExceeded', source: 'governance', timestamp: new Date().toISOString(), entityId: tenantId, payload: details }
}

export function createCapabilityAuthorizedEvent(tenantId: string, details?: Record<string, any>): PlatformEvent {
  return { type: 'governance:CapabilityAuthorized', source: 'governance', timestamp: new Date().toISOString(), entityId: tenantId, payload: details }
}

export function createCapabilityDeniedEvent(tenantId: string, details?: Record<string, any>): PlatformEvent {
  return { type: 'governance:CapabilityDenied', source: 'governance', timestamp: new Date().toISOString(), entityId: tenantId, payload: details }
}

export function createAuditLoggedEvent(tenantId: string, details?: Record<string, any>): PlatformEvent {
  return { type: 'governance:AuditLogged', source: 'governance', timestamp: new Date().toISOString(), entityId: tenantId, payload: details }
}

export function createPolicyEvaluatedEvent(tenantId: string, details?: Record<string, any>): PlatformEvent {
  return { type: 'governance:PolicyEvaluated', source: 'governance', timestamp: new Date().toISOString(), entityId: tenantId, payload: details }
}

export function createPolicyViolatedEvent(tenantId: string, details?: Record<string, any>): PlatformEvent {
  return { type: 'governance:PolicyViolated', source: 'governance', timestamp: new Date().toISOString(), entityId: tenantId, payload: details }
}

export function createBillingRecordedEvent(tenantId: string, details?: Record<string, any>): PlatformEvent {
  return { type: 'governance:BillingRecorded', source: 'governance', timestamp: new Date().toISOString(), entityId: tenantId, payload: details }
}

export function createRoleCreatedEvent(tenantId: string, details?: Record<string, any>): PlatformEvent {
  return { type: 'governance:RoleCreated', source: 'governance', timestamp: new Date().toISOString(), entityId: tenantId, payload: details }
}

export function createRoleAssignedEvent(tenantId: string, details?: Record<string, any>): PlatformEvent {
  return { type: 'governance:RoleAssigned', source: 'governance', timestamp: new Date().toISOString(), entityId: tenantId, payload: details }
}
