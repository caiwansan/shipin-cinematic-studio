// ============================================================
// Subscription Runtime — KMKI-PLAT-012
// ============================================================

import { planRepository } from '../repositories/plan.repository.js'
import { subscriptionRepository } from '../repositories/subscription.repository.js'
import { grantRepository } from '../repositories/grant.repository.js'
import { quotaRepository } from '../repositories/quota.repository.js'
import { auditRepository } from '../repositories/audit.repository.js'
import { platformEventBus } from '@platform/events/event-bus.js'
import {
  createSubscriptionChangedEvent, createSubscriptionCancelledEvent,
} from '../events/governance-events.js'
import type { SubscriptionPlanDTO, SubscriptionDTO } from '../types.js'

export class SubscriptionRuntime {
  async createPlan(input: {
    code: string; name: string; description?: string; price?: number;
    currency?: string; billingCycle: 'monthly' | 'yearly' | 'once';
    capabilities: Record<string, any>
  }): Promise<SubscriptionPlanDTO> {
    const plan = await planRepository.create(input)
    if (input.capabilities) {
      for (const [cap, limits] of Object.entries(input.capabilities)) {
        await grantRepository.create({
          planId: plan.id,
          capability: cap,
          limits: limits as Record<string, any> || undefined,
        })
      }
    }
    return plan
  }

  async subscribe(tenantId: string, planId: string, userId?: string): Promise<SubscriptionDTO> {
    await subscriptionRepository.cancel(tenantId)
    const sub = await subscriptionRepository.create({
      tenantId,
      planId,
      startDate: new Date(),
      autoRenew: true,
    })
    const plan = await planRepository.findById(planId)
    if (plan) {
      const caps = plan.capabilities as Record<string, any>
      await quotaRepository.init(tenantId, {
        dailyTokens: caps.dailyTokens ?? 1000,
        monthlyTokens: caps.monthlyTokens ?? 50000,
        imageCredits: caps.imageCredits ?? 100,
        videoMinutes: caps.videoMinutes ?? 30,
        speechMinutes: caps.speechMinutes ?? 60,
        concurrentJobs: caps.concurrentJobs ?? 1,
        workflowRuns: caps.workflowRuns ?? 10,
        agentSessions: caps.agentSessions ?? 5,
        storage: caps.storage ?? 500,
        workspaceCount: caps.workspaceCount ?? 1,
      } as any)
    }
    await auditRepository.log({
      tenantId, userId, action: 'subscriptionChanged',
      resource: 'subscription', resourceId: sub.id,
      details: { planId },
    })
    platformEventBus.emit(createSubscriptionChangedEvent(tenantId, { planId, subId: sub.id }))
    return sub
  }

  async cancel(tenantId: string, userId?: string): Promise<void> {
    await subscriptionRepository.cancel(tenantId)
    await auditRepository.log({
      tenantId, userId, action: 'subscriptionCancelled',
      resource: 'subscription', resourceId: tenantId,
    })
    platformEventBus.emit(createSubscriptionCancelledEvent(tenantId))
  }

  async renew(tenantId: string, planId: string, userId?: string): Promise<SubscriptionDTO> {
    const sub = await subscriptionRepository.renew(tenantId, planId)
    await auditRepository.log({
      tenantId, userId, action: 'subscriptionRenewed',
      resource: 'subscription', resourceId: sub.id,
    })
    return sub
  }

  async getEffectiveCapabilities(tenantId: string): Promise<string[]> {
    const sub = await subscriptionRepository.getActiveSubscription(tenantId)
    if (!sub?.planId) return []
    const plan = await planRepository.findById(sub.planId)
    if (!plan) return []
    const caps = plan.capabilities as Record<string, any>
    return Object.keys(caps)
  }

  async checkCapability(tenantId: string, capability: string): Promise<boolean> {
    const caps = await this.getEffectiveCapabilities(tenantId)
    return caps.includes(capability)
  }

  async getPlans(activeOnly = false): Promise<SubscriptionPlanDTO[]> {
    return planRepository.findAll(activeOnly)
  }

  async getActiveSubscription(tenantId: string): Promise<SubscriptionDTO | null> {
    return subscriptionRepository.getActiveSubscription(tenantId)
  }
}

export const subscriptionRuntime = new SubscriptionRuntime()
