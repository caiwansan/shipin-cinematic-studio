// llm-runtime-guard/trace-store.ts
// Trace 持久层 v1 — 内存 buffer + console log
// Phase A: 只写不读，不参与决策

import type { LLMExecutionTrace } from './types'

const memoryBuffer: LLMExecutionTrace[] = []

export async function persistLLMTrace(trace: LLMExecutionTrace): Promise<void> {
  memoryBuffer.push(trace)

  // 防内存泄漏
  if (memoryBuffer.length > 5000) {
    memoryBuffer.splice(0, 1000)
  }

  // Phase A: 只 log，不落 DB
  console.log('[LLM_TRACE]', JSON.stringify({
    req: trace.requestId,
    provider: trace.provider,
    model: trace.model,
    source: trace.source,
    shadow: trace.shadowDetected,
    latencyMs: trace.latencyMs,
  }))
}

export function getTraceBuffer(): LLMExecutionTrace[] {
  return memoryBuffer
}
