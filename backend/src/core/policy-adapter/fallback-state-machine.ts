/**
 * Fallback State Machine — Phase 1D
 *
 * Single deterministic fallback policy for all failure modes.
 * Consumes fallback_chain from PolicySignal in order.
 * Replaces inline fallback heuristics scattered across the codebase.
 *
 * Design: pure function + state machine. No side effects. No implicit decisions.
 */

import type { PolicySignal } from '../policy-signal/policy-signal.types.js'
import type { PolicyContext } from './policy-adapter.types.js'

/**
 * Classification of error causes for fallback decision.
 */
export type FallbackErrorType =
  | 'retryable'    // transient: network, 5xx, rate limit
  | 'fatal'        // irrecoverable: invalid input, assertion
  | 'auth_blocked' // auth: insufficient balance, quota, 401/403
  | 'timeout'      // exceeded time budget

/**
 * A single fallback decision — what to do next.
 */
export interface FallbackDecision {
  provider: string
  reason: string
  confidence_adjusted: number
  is_terminal: boolean
}

/**
 * Internal state of the fallback machine for a single execution path.
 */
export interface FallbackState {
  provider: string
  attempt: number         // 0-based, BullMQ default max = 3
  fallback_index: number  // index into fallback_chain (0 = original provider)
  errors: Array<{ type: FallbackErrorType; message: string }>
  state: 'executing' | 'retrying' | 'blocked' | 'dead'
}

/**
 * Classify an error message into a FallbackErrorType.
 */
export function classifyError(err: Error): FallbackErrorType {
  const msg = err.message?.toLowerCase() || ''

  if (
    msg.includes('insufficient') ||
    msg.includes('balance') ||
    msg.includes('quota') ||
    msg.includes('exceeded') ||
    msg.includes('unauthorized') ||
    msg.includes('403') ||
    msg.includes('401') ||
    msg.includes('forbidden') ||
    msg.includes('rate limit')
  ) {
    return 'auth_blocked'
  }

  if (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('deadline exceeded')
  ) {
    return 'timeout'
  }

  if (
    msg.includes('invalid') ||
    msg.includes('assertion') ||
    msg.includes('bad request') ||
    msg.includes('not found') ||
    msg.includes('400') ||
    msg.includes('500') // internal, not transient
  ) {
    return 'fatal'
  }

  // Default: network/transient errors
  return 'retryable'
}

/**
 * Deterministic fallback policy.
 *
 * Consumes fallback_chain sequentially.
 * Returns FallbackDecision with provider, reason, and confidence.
 */
export class FallbackPolicy {
  /**
   * Determine the next provider to try given current state.
   *
   * @param signal - Original PolicySignal (carries fallback_chain)
   * @param context - Execution context (carries retry_count)
   * @returns FallbackDecision — next step to take
   */
  next(signal: PolicySignal, context: PolicyContext): FallbackDecision {
    const chain = signal.meta.fallback_chain
    const tried = context.retry_count

    // Original provider (index -1 in chain) + chain providers
    const totalAvailable = 1 + chain.length

    if (tried >= totalAvailable - 1) {
      // End of chain → terminal (mock)
      return {
        provider: 'mock',
        reason: 'Fallback chain exhausted — no viable provider',
        confidence_adjusted: 0.2,
        is_terminal: true,
      }
    }

    // Determine which provider to try next
    if (tried === 0) {
      // First try with original provider (tried the original once already)
      return {
        provider: chain[0] || 'mock',
        reason: `Fallback step 1: switching to ${chain[0] || 'mock'}`,
        confidence_adjusted: Math.max(0.3, signal.confidence - 0.15),
        is_terminal: false,
      }
    }

    const nextIndex = Math.min(tried, chain.length - 1)
    const nextProvider = chain[nextIndex]

    if (!nextProvider) {
      return {
        provider: 'mock',
        reason: 'Fallback chain empty — using mock',
        confidence_adjusted: 0.2,
        is_terminal: true,
      }
    }

    return {
      provider: nextProvider,
      reason: `Fallback step ${tried + 1}: switching to ${nextProvider}`,
      confidence_adjusted: Math.max(0.2, signal.confidence - tried * 0.15),
      is_terminal: tried >= chain.length - 1 && tried > 0,
    }
  }

  /**
   * Check if a given error type should cause a fallback (vs. simple retry).
   */
  shouldFallbackToNextProvider(error: FallbackErrorType): boolean {
    switch (error) {
      case 'auth_blocked':
        return true  // Auth failures skip provider
      case 'fatal':
        return true  // Fatal errors skip provider
      case 'timeout':
        return false // Timeouts retry first
      case 'retryable':
        return false // Transient errors retry on same provider
    }
  }
}

/**
 * Singleton instance.
 */
export const fallbackPolicy = new FallbackPolicy()
