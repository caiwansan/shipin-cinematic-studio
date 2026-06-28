/**
 * Policy Adapter Types — Phase 1C
 *
 * Policy Adapter is the unified decision authority.
 * render-intelligence → feature extractor (no longer decides)
 * policy-adapter → sole decision maker (governed by rules)
 */

import type { PolicySignal } from '../policy-signal/policy-signal.types.js'
import type { Candidate } from '../provider-registry/types.js'
export type { PolicySignal }

/**
 * The context in which a policy evaluation happens.
 * Carries execution environment information beyond what PolicySignal contains.
 */
export interface PolicyContext {
  sla_tier: 'fast' | 'balanced' | 'production'
  max_budget_usd?: number
  user_id?: string
  project_id?: string
  /** How many times this request has been retried */
  retry_count: number
  /** Queue depth for the target provider (if observable) */
  provider_backpressure?: Record<string, number>
}

/**
 * A single policy rule.
 *
 * Rules are evaluated in priority order (highest first).
 * First matching rule's action is applied.
 */
export interface PolicyRule {
  id: string
  name: string
  priority: number          // higher = evaluated first
  condition: (signal: any, context: PolicyContext) => boolean
  action: 'allow' | 'reroute' | 'fallback' | 'reject'
  /** For reroute action: which provider to reroute to */
  reroute_provider?: string
}

export interface AppliedRule {
  id: string
  name: string
  action: string
}

/**
 * The output of policy evaluation.
 * Appended to PolicySignal as policy_result.
 */
export interface PolicyResult {
  final_provider: string
  final_model: string
  action: 'allow' | 'reroute' | 'fallback' | 'reject'
  applied_rules: AppliedRule[]
  fallback_chain_used: Candidate[]
  confidence_adjusted: number
}

/**
 * The output of PolicyAdapter.evaluate().
 */
export interface PolicyEvaluation {
  signal: PolicySignal
  result: PolicyResult
  context: PolicyContext
}

/**
 * A handler for a specific provider.
 * Matches the shape used in worker-runtime.ts providerHandlers.
 */
export interface ProviderHandler {
  (taskType: string, providerName: string, input: any, config?: any): Promise<any>
}

/**
 * Registry lookup result.
 */
export interface RegistryCapability {
  provider: string
  model: string
  capabilities: string[]
  priority: number
}
