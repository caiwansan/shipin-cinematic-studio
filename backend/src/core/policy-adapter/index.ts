/**
 * Policy Adapter Barrel — Phase 1D
 */

export { PolicyAdapter, policyAdapter, DEFAULT_POLICY_RULES } from './policy-adapter.js'
export type {
  PolicyRule,
  PolicyContext,
  PolicyResult,
  PolicyEvaluation,
  AppliedRule,
  ProviderHandler,
  RegistryCapability,
} from './policy-adapter.types.js'
export { getFallbackDecision, shouldFallbackToNextProvider } from './fallback-policy.js'
export { FallbackPolicy, fallbackPolicy, classifyError } from './fallback-state-machine.js'
export type { FallbackErrorType, FallbackDecision, FallbackState } from './fallback-state-machine.js'
