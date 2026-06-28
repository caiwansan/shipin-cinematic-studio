/**
 * Phase 1C — Job Envelope types.
 *
 * Unified envelope for all execution lifecycle tracking.
 * Used across route → dispatcher → worker → adapter chain.
 *
 * This is NOT a replacement for DispatchResult — it wraps it.
 */

import type { JobStatus } from './lifecycle-state-machine.js'

/**
 * Minimal execution context shared across all phases.
 */
export interface JobEnvelope<TParams = Record<string, unknown>, TResult = unknown> {
  /** Globally unique job ID (generated at creation) */
  jobId: string
  /** Capability this job belongs to */
  capability: 'image' | 'video' | 'tts' | 'llm'
  /** Current lifecycle state */
  status: JobStatus
  /** Provider selected by policy */
  provider: string
  /** Input parameters */
  params: TParams
  /** Execution result (populated at completed) */
  result?: TResult
  /** Error message (populated at failed) */
  error?: string
  /** Trace identifier for observability */
  traceId?: string
  /** Source of this job creation */
  source?: 'route' | 'worker' | 'queue'
}

/**
 * Create a new job envelope in 'created' state.
 */
export function createJobEnvelope<TParams = Record<string, unknown>>(
  params: Partial<JobEnvelope<TParams>>
): JobEnvelope<TParams> {
  return {
    jobId: params.jobId ?? `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    capability: params.capability ?? 'video',
    status: 'created',
    provider: params.provider ?? '',
    params: params.params ?? {} as TParams,
    result: undefined,
    error: undefined,
    traceId: params.traceId,
    source: params.source,
  }
}
