// ============================================================
// DLQ — Dead Letter Queue Types (RC2-3c)
// ============================================================

export type DLQStatus = 'pending' | 'replayed' | 'archived'

export type DLQReason =
  | 'retry_exhausted'
  | 'fallback_exhausted'
  | 'circuit_breaker_open'
  | 'deadlock'
  | 'unknown'

export interface DLQRecord {
  id: string
  executionId: string
  graphId: string
  nodeId: string
  provider: string
  capability: string
  reason: DLQReason
  errorMessage: string
  payload: unknown          // 失败时的上下文数据
  status: DLQStatus
  retryCount: number
  fallbackAttempts: number
  createdAt: string
  replayedAt?: string
  archivedAt?: string
  replayedExecutionId?: string   // 重放后的新 execution ID
}

export interface DLQQuery {
  status?: DLQStatus
  executionId?: string
  provider?: string
  limit?: number
  offset?: number
}
