// llm-runtime-guard/types.ts
// Execution Guard + Trace Persistence v1
// 独立于 resolver，不参与决策，只做执行护栏和观测

export type LLMExecutionSource =
  | 'REQUEST_OVERRIDE'
  | 'V2_CONFIG'
  | 'ENV_FALLBACK'
  | 'V1_LEGACY'
  | 'DEFAULT'

export interface LLMExecutionTrace {
  requestId: string
  userId?: string
  provider: string
  model: string
  apiKeyMasked: string
  source: LLMExecutionSource
  resolvedBy: 'resolver_v1'
  decisionPath: string[]
  shadowDetected: boolean
  shadowConflicts?: string[]
  latencyMs: number
  timestamp: string
}

export interface GuardResult {
  passed: boolean
  trace: LLMExecutionTrace
  errors: string[]
}
