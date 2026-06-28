// llm-runtime-guard/execution-guard.ts
// 执行护栏 v1 — 检测 LEGACY bypass / 空 Key / 无 resolver 归因
// Phase A: 只检查不阻断（LOG_ONLY）

import type { LLMExecutionTrace, GuardResult } from './types'
import { persistLLMTrace } from './trace-store'

export function assertExecutionIntegrity(trace: LLMExecutionTrace): GuardResult {
  const errors: string[] = []

  // 1. LEGACY bypass 检测
  if (trace.source === 'V1_LEGACY') {
    errors.push('LEGACY provider execution detected')
  }

  // 2. 空 Key 检测
  if (!trace.apiKeyMasked || trace.apiKeyMasked === 'undefined') {
    errors.push('Missing API key in execution')
  }

  // 3. 无 resolver 归因
  if (!trace.resolvedBy) {
    errors.push('No resolver attribution')
  }

  const passed = errors.length === 0

  if (!passed) {
    console.warn('[LLM_GUARD] ⚠️ Integrity check failed:', errors)
    trace.shadowDetected = true
    trace.shadowConflicts = errors
  }

  return { passed, trace, errors }
}

export async function guardedPersist(trace: LLMExecutionTrace): Promise<GuardResult> {
  const result = assertExecutionIntegrity(trace)
  await persistLLMTrace(result.trace)
  return result
}
