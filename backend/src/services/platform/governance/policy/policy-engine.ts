// ============================================================
// Policy Engine — KMKI-PLAT-012
// All Runtime executions check policies before proceeding
// ============================================================

import { policyRepository } from '../repositories/policy.repository.js'
import { auditRepository } from '../repositories/audit.repository.js'
import { platformEventBus } from '@platform/events/event-bus.js'
import { createPolicyEvaluatedEvent, createPolicyViolatedEvent } from '../events/governance-events.js'
import type { PolicyDTO, PolicyEvaluationResult } from '../types.js'

export class PolicyEngine {
  async evaluate(policyCode: string, context: Record<string, any>): Promise<PolicyEvaluationResult> {
    const policy = await policyRepository.findByCode(policyCode)
    if (!policy || !policy.enabled) {
      return { allowed: true, policyCode, reason: 'policy_not_found_or_disabled' }
    }
    return this.evaluatePolicy(policy, context)
  }

  async checkPolicies(tenantId: string, context: Record<string, any>): Promise<PolicyEvaluationResult[]> {
    const policies = await policyRepository.findActiveByTenant(tenantId)
    const results: PolicyEvaluationResult[] = []
    for (const policy of policies) {
      const result = await this.evaluatePolicy(policy, context)
      results.push(result)
      platformEventBus.emit(createPolicyEvaluatedEvent(tenantId, { policyCode: policy.code, allowed: result.allowed }))
      if (!result.allowed) {
        await auditRepository.log({
          tenantId, action: 'policyViolated',
          resource: 'policy', resourceId: policy.code,
          details: { context, reason: result.reason },
        })
        platformEventBus.emit(createPolicyViolatedEvent(tenantId, { policyCode: policy.code, reason: result.reason }))
      }
    }
    return results
  }

  async checkAll(tenantId: string, context: Record<string, any>): Promise<boolean> {
    const results = await this.checkPolicies(tenantId, context)
    return results.every(r => r.allowed)
  }

  async createPolicy(data: {
    code: string; name: string; type: string; rules: Record<string, any>;
    tenantId?: string; enabled?: boolean; priority?: number
  }): Promise<PolicyDTO> {
    return policyRepository.create(data)
  }

  private evaluatePolicy(policy: PolicyDTO, context: Record<string, any>): PolicyEvaluationResult {
    const rules = policy.rules
    switch (policy.type) {
      case 'quota': {
        const maxAmount = rules.maxAmount
        if (maxAmount && (context.amount || 0) > maxAmount) {
          return { allowed: false, policyCode: policy.code, reason: `exceeds_max_amount_${maxAmount}` }
        }
        return { allowed: true, policyCode: policy.code }
      }
      case 'rateLimit': {
        const maxPerMin = rules.maxPerMinute
        if (maxPerMin && (context.count || 0) >= maxPerMin) {
          return { allowed: false, policyCode: policy.code, reason: 'rate_limit_exceeded' }
        }
        return { allowed: true, policyCode: policy.code }
      }
      case 'security': {
        const allowedIps = rules.allowedIps as string[] | undefined
        if (allowedIps && context.ip && !allowedIps.includes(context.ip)) {
          return { allowed: false, policyCode: policy.code, reason: 'ip_not_allowed' }
        }
        return { allowed: true, policyCode: policy.code }
      }
      case 'region': {
        const allowedRegions = rules.allowedRegions as string[] | undefined
        if (allowedRegions && context.region && !allowedRegions.includes(context.region)) {
          return { allowed: false, policyCode: policy.code, reason: 'region_not_allowed' }
        }
        return { allowed: true, policyCode: policy.code }
      }
      case 'approval': {
        const requiresApproval = rules.requiresApproval as string[] | undefined
        if (requiresApproval && context.action && requiresApproval.includes(context.action)) {
          return { allowed: false, policyCode: policy.code, reason: 'requires_approval' }
        }
        return { allowed: true, policyCode: policy.code }
      }
      default:
        return { allowed: true, policyCode: policy.code }
    }
  }
}

export const policyEngine = new PolicyEngine()
