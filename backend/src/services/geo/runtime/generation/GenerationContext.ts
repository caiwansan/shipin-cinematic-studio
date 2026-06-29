// ============================================================
// GenerationContext — KMKI-RUNTIME-010
// 统一上下文对象，贯穿整个 Generation 流程
// 所有 Usage、Trace、Benchmark 共用
// ============================================================

export interface GenerationContext {
  projectId?: string
  userId?: string
  agent: string
  promptKey: string
  promptVersion: string
  workflowId?: string
  executionId?: string
  traceId?: string
  /** 自定义上下文数据，透传给 Provider/LLM */
  metadata?: Record<string, unknown>
}

export function createGenerationContext(agent: string, promptKey: string, promptVersion: string, overrides?: Partial<GenerationContext>): GenerationContext {
  return {
    agent,
    promptKey,
    promptVersion,
    traceId: overrides?.traceId || generateTraceId(),
    ...overrides,
  }
}

function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
