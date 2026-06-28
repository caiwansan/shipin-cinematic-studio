/**
 * Phase 1C — Execution Lifecycle Integration
 *
 * Wraps dispatchByCapability with job lifecycle tracking.
 * This is a thin integration layer, NOT a replacement for the dispatcher.
 *
 * Usage:
 *   import { executeWithLifecycle } from './core/lifecycle-integration.js'
 *   const envelope = await executeWithLifecycle(dispatchInput)
 *   // envelope.status === 'completed' | 'failed'
 *   // envelope.result contains DispatchResult
 *   // envelope.jobId for traceability
 */

import type { DispatchInput, DispatchResult } from '../queue/capability-dispatcher.js'
import { dispatchByCapability } from '../queue/capability-dispatcher.js'
import { createJobEnvelope, type JobEnvelope } from './job-envelope.js'
import { transitionJobStatus, isTerminal } from './lifecycle-state-machine.js'

/**
 * Execute a capability request with full lifecycle tracking.
 *
 * State flow:
 *   created → submitted → processing → completed (success)
 *                                        → failed (error)
 *
 * Each transition is validated by lifecycle-state-machine rules.
 * An invalid transition throws LIFECYCLE_VIOLATION.
 */
export async function executeWithLifecycle(
  input: DispatchInput
): Promise<JobEnvelope<Record<string, unknown>, DispatchResult>> {
  // 1. Create job in 'created' state (type-coerced: result field populated later)
  const job = createJobEnvelope({
    jobId: `lifecycle_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    capability: input.capability,
    status: 'created',
    params: input.input,
    traceId: input.traceId,
    source: 'route',
  }) as unknown as JobEnvelope<Record<string, unknown>, DispatchResult>

  const transition = (next: typeof job.status) => {
    job.status = transitionJobStatus(job.status, next)
  }

  try {
    // 2. created → submitted
    transition('submitted')

    // 3. submitted → processing
    transition('processing')

    // 4. Actual execution via dispatcher
    const result = await dispatchByCapability(input)

    // 5. processing → completed
    job.provider = result.provider
    job.result = result
    transition('completed')

    return job
  } catch (err) {
    // Any status → failed (allowed from submitted, processing)
    const errorMsg = err instanceof Error ? err.message : String(err ?? 'UNKNOWN_ERROR')

    if (!isTerminal(job.status)) {
      try {
        transition('failed')
      } catch {
        // If transition fails (e.g. already terminal), force set
        job.status = 'failed'
      }
    }

    job.error = errorMsg
    return job
  }
}

/**
 * Convenience: extract result from a completed lifecycle envelope.
 * Throws if job is not completed.
 */
export function assertCompleted<T = DispatchResult>(
  envelope: JobEnvelope<Record<string, unknown>, T>
): T {
  if (envelope.status !== 'completed') {
    throw new Error(
      `[LIFECYCLE] Job ${envelope.jobId} is in "${envelope.status}" state, not "completed". ` +
      (envelope.error ? `Error: ${envelope.error}` : '')
    )
  }
  return envelope.result!
}
