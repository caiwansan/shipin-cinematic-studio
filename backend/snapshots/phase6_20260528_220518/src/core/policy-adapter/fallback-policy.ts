/**
 * Policy-Governed Fallback — Phase 1D
 *
 * Replaces the Phase 1C fallback behavior (policyAdapter.evaluate() → reroute)
 * with Phase 1D deterministic fallback state machine.
 *
 * Phase 1D change:
 * - fallback provider selection is now a deterministic state machine
 * - fallback_chain consumed in order
 * - Error classification drives fallback vs. retry decision
 * - Terminal state = mock
 */

import { fallbackPolicy, classifyError } from './fallback-state-machine.js'
import type { FallbackErrorType, FallbackDecision } from './fallback-state-machine.js'
import type { Candidate } from '../provider-registry/types.js'
import type { PolicySignal } from '../policy-signal/policy-signal.types.js'
import type { PolicyContext, PolicyResult } from './policy-adapter.types.js'

/**
 * Execute a deterministic fallback decision.
 *
 * @param signal - Original PolicySignal (carries fallback_chain)
 * @param context - Execution context (carries retry_count)
 * @param error - Optional error that triggered fallback (for classification)
 * @returns PolicyResult with fallback decision
 */
export function getFallbackDecision(
  signal: PolicySignal,
  context: PolicyContext,
  error?: Error,
): PolicyResult {
  const decision = fallbackPolicy.next(signal, context)

  // Build applied rules for observability
  const appliedRules = [{
    id: 'fallback-state-machine',
    name: decision.reason,
    action: decision.is_terminal ? 'reject' as const : 'fallback' as const,
  }]

  // If there was an error, classify it for observability
  let errorType: FallbackErrorType | undefined
  if (error) {
    errorType = classifyError(error)
    appliedRules.push({
      id: `error-classification-${errorType}`,
      name: `Error classified as ${errorType}: ${error.message}`,
      action: decision.is_terminal ? 'reject' as const : 'fallback' as const,
    })
  }

  return {
    final_provider: decision.provider,
    final_model: decision.provider === 'mock' ? 'mock-video-01' : signal.meta.model,
    action: decision.is_terminal ? 'reject' : 'fallback',
    applied_rules: appliedRules,
    fallback_chain_used: signal.meta.fallback_chain
      .filter(p => p !== decision.provider)
      .map(p => ({
        provider: p,
        model: signal.meta.model,
        capability: signal.capability as Candidate['capability'],
        cost: 0, latency: 0, quality: 0, reliability: 0,
      })),
    confidence_adjusted: decision.confidence_adjusted,
  }
}

/**
 * Determine if the error should trigger fallback to next provider vs retry on same provider.
 */
export function shouldFallbackToNextProvider(error: Error): boolean {
  const errorType = classifyError(error)
  return fallbackPolicy.shouldFallbackToNextProvider(errorType)
}
