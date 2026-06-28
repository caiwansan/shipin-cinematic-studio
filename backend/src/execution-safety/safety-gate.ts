/**
 * execution-safety/safety-gate.ts — Safety Gate 核心入口
 *
 * Safety Layer 的唯一对外接口。
 * 输入 provider 当前状态 → 输出是否允许执行。
 *
 * 职责边界：
 *   ✔ allow/block execution（仅基于健康数据）
 *   ❌ 不选 provider
 *   ❌ 不做 fallback
 *   ❌ 不计成本
 *
 * v1.1 — 语义化阻断：
 *   - INVALID_KEY / BILLING_FAILED → 永久阻断（不可恢复）
 *   - PERMISSION_DENIED           → 冷却 30s，自动恢复
 *   - degraded / MODEL_DISABLED   → 不阻断，标记失败
 *   - 连续失败 >= 阈值            → 熔断冷却 60s
 */

import type { SafetyState } from './types.js'
import { FAILURE_THRESHOLD, COOLDOWN_MS } from './circuit-breaker.js'

const MODEL_COOLDOWN_MS = 30_000 // 模型级错误（如 model_disabled）冷却 30s

/**
 * Safety Gate — 判断当前调用能否执行
 *
 * 返回 true = 允许执行，false = 阻断
 *
 * 阻断理由通过 reason 字段返回，供上游生成用户提示。
 */
export function safetyGate(state: SafetyState): { allowed: boolean; reason?: string } {
  // 1. 管理员禁用
  if (!state.enabled) {
    return { allowed: false, reason: 'disabled' }
  }

  // 2. 不可恢复错误 — 永久阻断
  if (state.status === 'invalid_key') {
    return { allowed: false, reason: 'invalid_key' }
  }
  if (state.status === 'billing_failed') {
    return { allowed: false, reason: 'billing_failed' }
  }

  // 3. permission_denied — 冷却 30s 后自动恢复
  if (state.status === 'permission_denied') {
    if (state.circuitOpenedAt) {
      const elapsed = Date.now() - state.circuitOpenedAt
      if (elapsed < MODEL_COOLDOWN_MS) {
        const remaining = Math.ceil((MODEL_COOLDOWN_MS - elapsed) / 1000)
        return { allowed: false, reason: `permission_denied: 冷却中 (剩余 ${remaining}s)` }
      }
    }
    // 冷却期到 → 放行
    return { allowed: true }
  }

  // 4. degraded — 临时问题（参数错误/模型禁用/模型不可用），不阻断
  //    允许执行但会再失败，失败由 ProviderState 记录
  if (state.status === 'degraded') {
    return { allowed: true }
  }

  // 5. 连续失败 >= 阈值 → 熔断冷却 60s
  if (state.failureCount >= FAILURE_THRESHOLD) {
    const elapsed = state.circuitOpenedAt ? Date.now() - state.circuitOpenedAt : 0

    // 冷却期内阻断
    if (elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000)
      return { allowed: false, reason: `circuit_open: 冷却中 (剩余 ${remaining}s)` }
    }

    // 冷却期到 → 允许 1 次试探（half-open）
    return { allowed: true }
  }

  // 6. 正常
  return { allowed: true }
}
