/**
 * execution-safety/circuit-breaker.ts — 纯状态机
 *
 * 职责：维护 3 态熔断转换
 *   CLOSED → 连续失败 3 次 → OPEN
 *   OPEN → 冷却 60s → HALF_OPEN（由 caller 触发趋势）
 *   HALF_OPEN → 成功 → CLOSED / 失败 → OPEN
 *
 * 边界：
 *   ❌ 不碰任何 provider 选择逻辑
 *   ❌ 不碰 DB
 *   ❌ 不碰路由
 */

import type { SafetyState, CircuitState } from './types.js'

export const FAILURE_THRESHOLD = 3
export const COOLDOWN_MS = 60_000

/** 根据 SafetyState 当前算出熔断状态 */
export function getCircuitState(state: SafetyState): CircuitState {
  if (!state.enabled) return 'open'
  if (state.status === 'invalid_key' || state.status === 'billing_failed') return 'open'

  if (state.failureCount >= FAILURE_THRESHOLD) return 'open'
  if (state.failureCount > 0) return 'half_open'

  return 'closed'
}

/**
 * 在 safety gate 通过后，adapter 执行结束时调用。
 * 不是决策逻辑，是状态迁移的纯函数。
 */
export function onSuccess(state: SafetyState): SafetyState {
  return {
    ...state,
    failureCount: 0,
    circuitOpenedAt: null,
  }
}

/**
 * adapter 执行失败时调用。
 * 返回新的状态（不含 DB 操作）。
 */
export function onFailure(state: SafetyState): SafetyState {
  const newCount = state.failureCount + 1
  return {
    ...state,
    failureCount: newCount,
    circuitOpenedAt: newCount >= FAILURE_THRESHOLD
      ? (state.circuitOpenedAt ?? Date.now())
      : state.circuitOpenedAt,
  }
}
