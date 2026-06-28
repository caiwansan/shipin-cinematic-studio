/**
 * Phase 1C — Execution Lifecycle State Machine
 *
 * Defines the state machine that governs all execution lifecycle transitions.
 * Enforces: created → submitted → processing → completed/failed
 *
 * This is the single source of truth for "what state is this execution in?"
 * It does NOT carry data — only state shape and transition rules.
 */

export type JobStatus = 'created' | 'submitted' | 'processing' | 'completed' | 'failed'

export const JOB_STATUS_VALUES: readonly JobStatus[] = ['created', 'submitted', 'processing', 'completed', 'failed'] as const

/**
 * Valid transitions defined as adjacency map.
 * Each status lists which statuses it can legally transition to.
 */
export const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  created:    ['submitted'],
  submitted:  ['processing', 'failed'],
  processing: ['completed', 'failed'],
  completed:  [],
  failed:     [],
}

/**
 * Transition a job from one status to the next.
 * Throws LIFECYCLE_VIOLATION error if transition is not allowed.
 * Returns a new state object (immutable semantics).
 */
export function transitionJobStatus(current: JobStatus, next: JobStatus): JobStatus {
  const allowed = VALID_TRANSITIONS[current]
  if (!allowed || !allowed.includes(next)) {
    throw new Error(
      `[LIFECYCLE_VIOLATION] Job status transition "${current}" → "${next}" is not allowed. ` +
      `Allowed transitions from "${current}": [${(allowed ?? []).join(', ')}]`
    )
  }
  return next
}

/**
 * Quick predicate checks
 */
export function isTerminal(status: JobStatus): boolean {
  return status === 'completed' || status === 'failed'
}

export function isActive(status: JobStatus): boolean {
  return !isTerminal(status) && status !== 'created'
}
