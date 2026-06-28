/**
 * Policy Adapter — Phase 1C
 *
 * Unified decision authority.
 * evaluates: signal + context + rules → decision
 * Does NOT modify render-intelligence, does NOT change execution.
 *
 * Phase 1C rule set (minimal):
 * 1. allow: if confidence >= 0.6 and no SLA violation
 * 2. reroute: if SLA tier requires lower latency than chosen provider can deliver
 * 3. fallback: if confidence < 0.6 or SLA violation, try fallback chain
 * 4. reject: if no valid path
 */

import type { PolicySignal } from '../policy-signal/policy-signal.types.js'
import type { Candidate } from '../provider-registry/types.js'
import { fallbackPolicy, classifyError } from './fallback-state-machine.js'
import type {
  PolicyRule,
  PolicyContext,
  PolicyEvaluation,
  PolicyResult,
  AppliedRule,
} from './policy-adapter.types.js'

/**
 * Default policy rules for Phase 1C.
 * Rules evaluated in priority order. First matching rule's action is applied.
 */
export const DEFAULT_POLICY_RULES: PolicyRule[] = [
  {
    id: 'allow-high-confidence',
    name: 'Allow: high confidence + SLA compliant',
    priority: 100,
    condition: (signal, ctx) =>
      signal.confidence >= 0.6 &&
      !hasSlaViolation(signal, ctx),
    action: 'allow',
  },
  {
    id: 'reroute-latency-miss',
    name: 'Reroute: SLA latency exceeded',
    priority: 90,
    condition: (signal, ctx) =>
      hasLatencyViolation(signal, ctx) &&
      signal.meta.fallback_chain.length > 0,
    action: 'reroute',
    reroute_provider: undefined, // set dynamically
  },
  {
    id: 'fallback-low-confidence',
    name: 'Fallback: low confidence or SLA violated',
    priority: 80,
    condition: (signal, ctx) =>
      signal.confidence < 0.6 ||
      hasSlaViolation(signal, ctx),
    action: 'fallback',
  },
  {
    id: 'reject-no-path',
    name: 'Reject: no viable provider found',
    priority: 10,
    condition: (_signal, ctx) =>
      ctx.retry_count >= 5,
    action: 'reject',
  },
]

/**
 * Check if the signal's provider violates the requested SLA tier.
 */
function hasSlaViolation(signal: PolicySignal, ctx: PolicyContext): boolean {
  const tier = ctx.sla_tier
  const latency = signal.latency_ms

  switch (tier) {
    case 'fast':
      return latency > 20_000  // fast tier expects < 20s
    case 'balanced':
      return latency > 60_000  // balanced tier expects < 60s
    case 'production':
      return latency > 120_000 // production tier allows up to 120s
    default:
      return false
  }
}

/**
 * Check specifically if latency exceeds what the SLA tier allows.
 */
function hasLatencyViolation(signal: PolicySignal, ctx: PolicyContext): boolean {
  return hasSlaViolation(signal, ctx)
}

/**
 * Determine fallback provider for a reroute action.
 * Deprecated in Phase 1D in favor of FallbackStateMachine.next().
 * Kept as a safe fallback in case fallbackPolicy.next() panics.
 */

export class PolicyAdapter {
  private rules: PolicyRule[]

  constructor(rules: PolicyRule[] = DEFAULT_POLICY_RULES) {
    this.rules = rules.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Evaluate a signal against policy rules.
   * Returns the first matching rule's result.
   * If no rule matches, defaults to 'allow'.
   */
  evaluate(signal: PolicySignal, context: PolicyContext): PolicyEvaluation {
    const appliedRules: AppliedRule[] = []
    let action: 'allow' | 'reroute' | 'fallback' | 'reject' = 'allow'
    let finalProvider = signal.provider_id
    let finalModel = signal.meta.model
    let fallbackChainUsed: Candidate[] = signal.meta.fallback_chain
      .filter(id => id !== signal.provider_id)
      .map(id => ({
        provider: id,
        model: signal.meta.model,
        capability: signal.capability as Candidate['capability'],
        cost: 0, latency: 0, quality: 0, reliability: 0,
      }))

    for (const rule of this.rules) {
      try {
        const matches = rule.condition(signal, context)
        if (matches) {
          appliedRules.push({
            id: rule.id,
            name: rule.name,
            action: rule.action,
          })

          action = rule.action

          // Phase 1D: use deterministic fallback state machine
          if (action === 'reroute' || action === 'fallback' || action === 'reject') {
            const fbDecision = fallbackPolicy.next(signal, context)
            finalProvider = fbDecision.provider
          } else {
            finalProvider = rule.reroute_provider || signal.provider_id
          }

          finalModel = finalProvider === signal.provider_id
            ? signal.meta.model
            : 'policy-rerouted'
          fallbackChainUsed = signal.meta.fallback_chain
            .filter(p => p !== finalProvider)
            .map(id => ({
              provider: id,
              model: finalModel,
              capability: signal.capability as Candidate['capability'],
              cost: 0, latency: 0, quality: 0, reliability: 0,
            }))

          break // first match wins
        }
      } catch (err) {
        // Rule condition error → skip this rule (fail-open)
        console.warn(`[PolicyAdapter] Rule ${rule.id} error:`, err)
        continue
      }
    }

    // Confidence adjustment: reroute/fallback/reject reduce confidence
    let confidenceAdjusted = signal.confidence
    if (action === 'reroute' || action === 'fallback') {
      confidenceAdjusted = Math.max(0.3, signal.confidence - 0.3)
    } else if (action === 'reject') {
      confidenceAdjusted = 0
    }

    const result: PolicyResult = {
      final_provider: finalProvider || signal.provider_id,
      final_model: finalModel || signal.meta.model,
      action,
      applied_rules: appliedRules,
      fallback_chain_used: fallbackChainUsed,
      confidence_adjusted: confidenceAdjusted,
    }

    // Control Plane — fire-and-forget policy trace
    try {
      const { collectPolicyTrace } = require('../../control-plane/collector.js')
      collectPolicyTrace({
        traceId: (context as any).traceId || `policy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        requestId: (context as any).requestId || '',
        input: {
          signalSummary: `provider=${signal.provider_id}, capability=${signal.capability}, confidence=${signal.confidence}`,
          slaTier: context.sla_tier,
        },
        decision: {
          finalProvider: result.final_provider,
          finalModel: result.final_model,
          action: result.action,
          fallbackChain: result.fallback_chain_used,
          confidenceAdjusted: result.confidence_adjusted,
        },
        reasoning: {
          appliedRules: result.applied_rules.map(r => r.name),
          scoreWeights: { cost: signal.cost_score, latency: 1 - signal.latency_ms / 10000, reliability: signal.reliability_score },
        },
      })
    } catch { /* Control Plane failure must never affect data plane */ }

    return {
      signal,
      result,
      context,
    }
  }

  /**
   * Add a custom rule at runtime.
   */
  addRule(rule: PolicyRule): void {
    this.rules.push(rule)
    this.rules.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Remove a rule by id.
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId)
  }
}

/**
 * Singleton instance with default rules.
 */
export const policyAdapter = new PolicyAdapter()
