/**
 * Phase 1B — Video failure normalization.
 *
 * Ensures ALL video providers return identical failure shapes,
 * making error handling at the caller level provider-agnostic.
 */

export interface VideoNormalizedFailure {
  taskId: null
  status: 'failed'
  videoUrl: null
  provider: string
  error: string
}

export function normalizeVideoFailure(provider: string, err: unknown): VideoNormalizedFailure {
  const message = err instanceof Error ? err.message : String(err ?? 'UNKNOWN_ERROR')
  return {
    taskId: null,
    status: 'failed',
    videoUrl: null,
    provider,
    error: message,
  }
}
