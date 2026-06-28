/**
 * Phase D — Capability Dispatcher
 *
 * The single execution entry point for the worker layer.
 * Maps capability + userId + input → effective candidate → adapter execution.
 *
 * This replaces:
 *   - providerHandlers (5 hardcoded handlers with inline API calls)
 *   - callProvider()'s per-provider dispatch logic
 *   - All provider awareness in worker-runtime.ts
 *
 * Worker becomes a pure queue consumer + dispatcher host.
 * No provider logic, no switch/case, no API key management.
 */

import type { Capability } from '../core/provider-registry/types.js'
import { getPlaneForCapability } from '../core/stream-plane/planes.js'
// kernel import removed — code pruned per audit (2026-05-21)
// import { createKernel, getKernel } from '../kernel/kernel.js'
import { getEffectiveCandidates } from '../core/provider-registry/merged-view.js'
import { pluginRegistry } from '../core/provider-registry/plugin-registry.js'
import { policyAdapter } from '../core/policy-adapter/policy-adapter.js'
import { createPolicySignal } from '../core/policy-signal/policy-signal.types.js'
import { collectExecutionTrace } from '../control-plane/collector.js'

// ============================================================
// Structured Failure Types
// ============================================================

/**
 * Runtime Integrity Error — thrown when capability execution is structurally
 * correct (topology unified) but not yet available (no adapter).
 *
 * This is NOT a bug. It means execution has been successfully routed to
 * the capability runtime, but the adapter layer has a coverage gap.
 */
export class CapabilityAdapterMissingError extends Error {
  public readonly capability: string
  public readonly requestedProvider: string
  public readonly availableAdapters: string[]
  public readonly reason: 'no_adapter'

  constructor(opts: {
    capability: string
    requestedProvider: string
    availableAdapters: string[]
  }) {
    super(
      `Capability unavailable: "${opts.capability}" via "${opts.requestedProvider}". ` +
      `Available adapters: [${opts.availableAdapters.join(', ')}]. ` +
      `This is a capability coverage gap, not a system failure.`
    )
    this.name = 'CapabilityAdapterMissingError'
    this.capability = opts.capability
    this.requestedProvider = opts.requestedProvider
    this.availableAdapters = opts.availableAdapters
    this.reason = 'no_adapter'
  }
}

// ============================================================
// Types
// ============================================================

export interface DispatchInput {
  capability: Capability
  userId: string
  /** Raw input payload from the job */
  input: Record<string, unknown>
  /** Optional trace ID for observability linkage */
  traceId?: string
}

export interface DispatchResult {
  /** The primary output URL (image, video, audio) or text content */
  content: string | string[]
  provider: string
  model: string
  latencyMs: number
  /** Raw provider response for downstream persistence */
  raw: Record<string, unknown>
}

// ============================================================
// The Single Dispatcher
// ============================================================

/**
 * Dispatch a capability-bound execution request.
 *
 * Flow:
 *   1. getEffectiveCandidates(userId, capability) → Candidate[]
 *   2. policyAdapter.evaluate(candidates) → selected Candidate
 *   3. pluginRegistry.getAdapter(selected.provider) → ModelPluginAdapter
 *   4. adapter.execute(request, candidate) → result
 *
 * Worker knows nothing about providers. It only knows capabilities.
 */
export async function dispatchByCapability(input: DispatchInput): Promise<DispatchResult> {
  const startTime = Date.now()
  const { capability, userId, input: rawInput, traceId: inputTraceId } = input

  const traceId = inputTraceId || `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  // Step 1: Get effective candidates (system + user)
  const candidates = await getEffectiveCandidates(userId, capability)

  if (candidates.length === 0) {
    const errMsg = `[Dispatcher] No candidates available for capability="${capability}", userId="${userId}"`
    console.error(errMsg)
    traceFailure(traceId, capability, 'no_candidates', 0, errMsg)
    throw new Error(errMsg)
  }

  // Step 2: Policy evaluation
  const fallbackChain = candidates.map(c => c.provider)

  // Prefer user candidates by boosting if user has registered keys
  const signal = createPolicySignal({
    provider_id: candidates[0].provider,
    capability,
    confidence: 0.85,
    quality_score: candidates[0].quality,
    latency_ms: 3000,
    cost_score: candidates[0].cost,
    reliability_score: candidates[0].reliability,
    meta: {
      source: 'registry',
      model: candidates[0].model,
      computational_model: 'job',
      decision_path: 'normal',
      is_fallback: false,
      fallback_chain: fallbackChain,
      sla_tier: capability === 'video' ? 'production' : 'fast',
      timestamp: Date.now(),
    },
    features: {
      fallback_risk: 1 - (candidates.length / 4),
      latency_variance: 0.3,
    },
  })

  const policy = policyAdapter.evaluate(signal, {
    sla_tier: capability === 'video' ? 'production' : 'fast',
    retry_count: 0,
  })

  // Step 3: Resolve adapter
  const selectedProvider = policy.result.final_provider
  const selected = candidates.find(c => c.provider === selectedProvider)

  if (!selected) {
    // Policy chose something not in candidate list — use first available
    console.warn(
      `[Dispatcher] Policy chose "${selectedProvider}" not in candidates for ${capability}, falling back to "${candidates[0].provider}"`
    )
    return executeWithAdapter(candidates[0], rawInput, traceId, startTime)
  }

  return executeWithAdapter(selected, rawInput, traceId, startTime)
}

// ============================================================
// Internal: Execute via adapter
// ============================================================

async function executeWithAdapter(
  candidate: import('../core/provider-registry/types.js').Candidate,
  rawInput: Record<string, unknown>,
  traceId: string,
  startTime: number
): Promise<DispatchResult> {
  const adapter = pluginRegistry.getAdapter(candidate.provider)

  if (!adapter) {
    const errMsg = `[Dispatcher] No adapter registered for provider="${candidate.provider}" (capability="${candidate.capability}")`
    console.error(errMsg)
    traceFailure(traceId, candidate.capability, 'no_adapter', Date.now() - startTime, errMsg)
    throw new CapabilityAdapterMissingError({
      capability: candidate.capability,
      requestedProvider: candidate.provider,
      availableAdapters: pluginRegistry.listProviders() || [],
    })
  }

  // Phase 3D: LLM capability routes through StreamPlane (deactivated — kernel pruned)
  // LLM capability dispatch is now handled directly by narrative-gateway.ts
  if (candidate.capability === 'llm') {
    throw new Error('LLM dispatch via capability dispatcher is deactivated after kernel prune (2026-05-21)')
  }

  try {
    const result = await adapter.execute(
      {
        prompt: (rawInput.prompt as string) || (rawInput.text as string) || '',
        model: candidate.model,
        params: rawInput,
      },
      candidate,
    )

    const latencyMs = Date.now() - startTime

    // Trace (fire-and-forget)
    try {
      collectExecutionTrace({
        traceId,
        requestId: traceId,
        steps: [{
          step: candidate.capability,
          provider: candidate.provider,
          latencyMs,
          success: true,
        }],
        totalLatencyMs: latencyMs,
        wrapperCalls: 1,
        retries: 0,
      })
    } catch { /* trace must never affect execution */ }

    return {
      content: result.content,
      provider: candidate.provider,
      model: result.model,
      latencyMs,
      raw: (result.raw as Record<string, unknown>) || {},
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startTime
    traceFailure(traceId, candidate.capability, 'execution_error', latencyMs, err.message)
    throw err // Let the queue DLQ handle retry
  }
}

function traceFailure(traceId: string, capability: string, reason: string, latencyMs: number, message: string): void {
  try {
    collectExecutionTrace({
      traceId,
      requestId: traceId,
      steps: [{
        step: capability,
        provider: 'unknown',
        latencyMs: Math.max(latencyMs, 0),
        success: false,
      }],
      totalLatencyMs: Math.max(latencyMs, 0),
      wrapperCalls: 0,
      retries: 0,
    })
  } catch { /* trace must never affect execution */ }

  console.error(`[Dispatcher] ❌ ${capability} failed: ${reason} — ${message}`)
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "queue-legacy",
  "mode": "SHADOW"
};

