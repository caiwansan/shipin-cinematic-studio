// ============================================================
// Capability Authorization — KMKI-PLAT-012
// All Runtime capability checks go through this module
// ============================================================

import { subscriptionRepository } from '../repositories/subscription.repository.js'
import { grantRepository } from '../repositories/grant.repository.js'
import { auditRepository } from '../repositories/audit.repository.js'
import { platformEventBus } from '@platform/events/event-bus.js'
import {
  createCapabilityAuthorizedEvent, createCapabilityDeniedEvent,
} from '../events/governance-events.js'
import type { CapabilityGrantDTO } from '../types.js'

export class CapabilityAuth {
  async authorize(tenantId: string, capability: string, userId?: string): Promise<boolean> {
    const sub = await subscriptionRepository.getActiveSubscription(tenantId)
    if (!sub?.planId) {
      await auditRepository.log({
        tenantId, userId, action: 'capabilityDenied',
        resource: 'capability', resourceId: capability,
        details: { reason: 'no_active_subscription' },
      })
      return false
    }
    const grant = await grantRepository.findByPlanAndCapability(sub.planId, capability)
    const allowed = !!grant
    await auditRepository.log({
      tenantId, userId, action: allowed ? 'capabilityUsed' : 'capabilityDenied',
      resource: 'capability', resourceId: capability,
    })
    platformEventBus.emit(
      allowed
        ? createCapabilityAuthorizedEvent(tenantId, { capability })
        : createCapabilityDeniedEvent(tenantId, { capability }),
    )
    return allowed
  }

  async grantCapability(planId: string, capability: string, limits?: Record<string, any>): Promise<CapabilityGrantDTO> {
    const existing = await grantRepository.findByPlanAndCapability(planId, capability)
    if (existing) {
      return grantRepository.update(existing.id, { limits })
    }
    return grantRepository.create({ planId, capability, limits })
  }

  async revokeCapability(planId: string, capability: string): Promise<void> {
    const grant = await grantRepository.findByPlanAndCapability(planId, capability)
    if (grant) {
      await grantRepository.delete(grant.id)
    }
  }

  async getPlanCapabilities(planId: string): Promise<CapabilityGrantDTO[]> {
    return grantRepository.findByPlan(planId)
  }

  async authorizeBatch(tenantId: string, capabilities: string[]): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {}
    for (const cap of capabilities) {
      results[cap] = await this.authorize(tenantId, cap)
    }
    return results
  }
}

export const capabilityAuth = new CapabilityAuth()
