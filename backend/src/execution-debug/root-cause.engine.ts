/**
 * execution-debug/root-cause.engine.ts — 根因分析引擎
 *
 * 输入：一条 trace + provider state
 * 输出：原因链（可能有多个原因）
 *
 * 规则：
 *   - 前置原因优先（safety block 优先于 provider error）
 *   - 不猜测，只根据已有数据推断
 *   - 不调用 LLM/AI
 */

import type { ExecutionTrace } from '../execution-trace/index.js'
import type { ProviderState } from '../runtime/provider-state/index.js'
import type { RootCause, RootCauseType } from './types.js'

const LATENCY_THRESHOLD_MS = 5000

/** 分析单次的失败根因 */
export function analyzeFailure(trace: ExecutionTrace, state?: ProviderState): RootCause[] {
  if (trace.status === 'success') return []

  const reasons: RootCause[] = []

  // 1. Safety Block — 阻断优先
  const safetyBlockStep = trace.steps.find(s => s.name === 'trace-finish' && s.data?.status === 'blocked')
  if (safetyBlockStep) {
    reasons.push({
      type: 'SAFETY_BLOCK',
      reason: `Execution blocked by safety layer`,
      suggestion: 'Wait for cooldown or check provider health',
      data: { step: safetyBlockStep },
    })
    return reasons // 阻断后无后续步骤，直接返回
  }
  // 也可能是 trace 被标记为 blocked
  if (trace.status === 'blocked') {
    reasons.push({
      type: 'SAFETY_BLOCK',
      reason: trace.error || 'Execution blocked by safety layer',
      suggestion: 'Wait for cooldown or check provider status',
    })
    return reasons
  }

  // 2. Provider State 级原因
  if (state) {
    if (state.status === 'invalid_key') {
      reasons.push({
        type: 'INVALID_KEY',
        reason: 'Provider API key invalid or expired',
        suggestion: 'Update your API key in Model Settings',
      })
    }
    if (state.status === 'billing_failed') {
      reasons.push({
        type: 'BILLING_FAILED',
        reason: 'Provider account has billing issues',
        suggestion: 'Check your billing status on the provider dashboard',
      })
    }
    // circuit open 但不被 safety 拦截（通常不会，但防止边缘情况）
    if (state.circuitOpenedAt && state.consecutiveFailures >= 3) {
      reasons.push({
        type: 'CIRCUIT_OPEN',
        reason: `Circuit breaker open after ${state.consecutiveFailures} consecutive failures`,
        suggestion: `Auto-recovery in ${Math.max(0, Math.ceil((60000 - (Date.now() - state.circuitOpenedAt)) / 1000))}s`,
        data: { consecutiveFailures: state.consecutiveFailures, circuitOpenedAt: state.circuitOpenedAt },
      })
    }
  }

  // 3. Provider Error — trace 里记录了完整 error
  if (trace.error && trace.status === 'failed') {
    const errLower = trace.error.toLowerCase()

    if (errLower.includes('401') || errLower.includes('unauthorized') || errLower.includes('auth')) {
      if (!reasons.find(r => r.type === 'INVALID_KEY')) {
        reasons.push({
          type: 'INVALID_KEY',
          reason: `Authentication failed: ${trace.error.substring(0, 100)}`,
          suggestion: 'Check API key validity',
        })
      }
    } else if (errLower.includes('402') || errLower.includes('payment') || errLower.includes('quota') || errLower.includes('insufficient')) {
      if (!reasons.find(r => r.type === 'BILLING_FAILED')) {
        reasons.push({
          type: 'BILLING_FAILED',
          reason: `Billing/quota error: ${trace.error.substring(0, 100)}`,
          suggestion: 'Top up your account or check quota',
        })
      }
    } else if (errLower.includes('timeout') || errLower.includes('timed out') || errLower.includes('503') || errLower.includes('unavailable')) {
      reasons.push({
        type: 'PROVIDER_ERROR',
        reason: `Provider temporarily unavailable: ${trace.error.substring(0, 100)}`,
        suggestion: 'Try again later',
      })
    } else {
      reasons.push({
        type: 'PROVIDER_ERROR',
        reason: trace.error.substring(0, 200),
        suggestion: 'Check provider status or retry',
      })
    }
  }

  // 4. 延时异常
  const duration = trace.endTime && trace.startTime ? trace.endTime - trace.startTime : 0
  if (duration > LATENCY_THRESHOLD_MS && trace.status !== 'failed') {
    reasons.push({
      type: 'LATENCY',
      reason: `Execution exceeded ${LATENCY_THRESHOLD_MS / 1000}s latency threshold (${(duration / 1000).toFixed(1)}s)`,
      suggestion: 'Consider switching to a faster provider',
      data: { actualMs: duration, thresholdMs: LATENCY_THRESHOLD_MS },
    })
  }

  // 5. Degraded — 如果 state 是 degraded
  if (state && state.status === 'degraded') {
    reasons.push({
      type: 'DEGRADED',
      reason: `Provider is in degraded state (${state.consecutiveFailures} recent failures)`,
      suggestion: 'Provider may be unstable, consider switching',
    })
  }

  // No reason found
  if (reasons.length === 0) {
    reasons.push({
      type: 'UNKNOWN',
      reason: trace.error || 'Unknown error, no root cause identified',
      suggestion: 'Check the system logs for more details',
    })
  }

  return reasons
}

/** 生成用户可读报告 */
export function generateHumanReadable(reasons: RootCause[]): string {
  if (reasons.length === 0) return 'No issues detected.'

  return reasons
    .map((r, i) => `${i + 1}. [${r.type}] ${r.reason}${r.suggestion ? `\n   💡 ${r.suggestion}` : ''}`)
    .join('\n')
}
