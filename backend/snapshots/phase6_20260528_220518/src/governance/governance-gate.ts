/**
 * governance/governance-gate.ts — 治理层核心入口（LOG_ONLY 模式）
 *
 * Phase 5 Hotfix: governance 不得阻断 execution
 * 仅记录 warning，不抛异常
 */

import { assertTenantIsolation } from './tenant/tenant-isolation.js'
import { assertRateLimit } from './rate-limit/runtime-rate-limit.js'
import { assertBudget, estimateCost } from './cost/cost-controller.js'
import type { RuntimePayload } from '../runtime/runtime-payload.js'

/**
 * SAFE MODE: LOG_ONLY
 * Enforce=false 时 governance 仅记录 warning，不阻断执行
 */
export const GOVERNANCE_MODE = {
  ENFORCE: false,
  LOG_ONLY: true,
} as const

export interface GovernanceResult {
  /** 本次执行预估成本 */
  cost: number
  /** 是否允许执行（LOG_ONLY 模式始终为 true） */
  allowed: boolean
  /** 治理警告列表 */
  warnings: string[]
}

/**
 * 治理门禁（NON-BLOCKING MODE）
 * 记录 warning 但不阻执行
 */
export function governanceGate(
  runtime: RuntimePayload,
  payload: { taskType?: string }
): GovernanceResult {
  const warnings: string[] = []

  // Phase 5, Rule 3: 租户隔离（仅 LOG_ONLY 模式）
  try {
    assertTenantIsolation(runtime)
  } catch (err: any) {
    const msg = `[governance] ⚠️ tenant isolation: ${err.message}`
    console.warn(msg)
    warnings.push(msg)
  }

  // Phase 5, Rule 4: 频率限制（仅 LOG_ONLY 模式）
  try {
    assertRateLimit(runtime)
  } catch (err: any) {
    const msg = `[governance] ⚠️ rate limit: ${err.message}`
    console.warn(msg)
    warnings.push(msg)
  }

  // Phase 5, Rule 5: 成本估算 + 预算检查
  const cost = estimateCost(payload)
  try {
    assertBudget(runtime, cost)
  } catch (err: any) {
    const msg = `[governance] ⚠️ budget: ${err.message}`
    console.warn(msg)
    warnings.push(msg)
  }

  if (GOVERNANCE_MODE.LOG_ONLY && warnings.length > 0) {
    console.log(`[governance] ⚠️ gate warnings (${warnings.length}), execution continues`)
  }

  return { cost, allowed: true, warnings }
}
