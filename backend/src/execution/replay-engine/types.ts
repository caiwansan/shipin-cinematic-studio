/**
 * execution/replay-engine/types.ts — 回放引擎类型定义
 *
 * 所属层：Control Plane —— 可以重放执行，但不改变原始 trace
 */

export interface ReplayStep {
  nodeId: string
  type: string
  status: 'success' | 'failed'
  input?: any
  output?: any
  error?: string
  durationMs: number
}

export interface ReplayResult {
  traceId: string
  success: boolean
  steps: ReplayStep[]
  totalDurationMs: number
}

export interface ReplayOptions {
  skipSuccessNodes?: boolean
  timeoutMs?: number
}
