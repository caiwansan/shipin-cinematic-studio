// ============================================================
// policy/policy-provider.ts
//
// 职责：D3 Production Policy Layer — 策略消费入口
//   运行时获取有效策略的函数
//   global 为基线 → domain 覆盖 → 返回最终策略
//
// 用法：
//   const policy = getEffectivePolicy('character')
//   // policy.scoring.acceptThreshold → 0.5 (from global)
//   // policy.retry.maxQualityRetries → 3 (from character override)
// ============================================================

import type { QualityDomain } from '../pipeline/validators/core/baseline-registry.js'
import { DEFAULT_GLOBAL_POLICY_V1, type GlobalPolicy, type ScoringPolicy, type RetryPolicy, type EscalationPolicy } from './global-policy.js'
import { getDomainOverride } from './domain-policy.js'

// ─── 运行时有效策略 ──────────────────────────────────

export interface EffectivePolicy {
  /** 全局策略版本 */
  version: string
  /** 生效的评分策略（已合并覆盖） */
  scoring: ScoringPolicy
  /** 生效的重试策略（已合并覆盖） */
  retry: RetryPolicy
  /** 生效的升级策略（已合并覆盖） */
  escalation: EscalationPolicy
  /** 该 domain 是否启用决策引擎 */
  enableDecision: boolean
}

// ─── 策略合并（只改这个文件可以热更新）───

let currentGlobal: GlobalPolicy = DEFAULT_GLOBAL_POLICY_V1

/**
 * 获取指定 domain 的生效策略
 *
 * 策略解析顺序：
 *   1. global-policy.ts（基线）
 *   2. domain-policy.ts（覆盖）
 *   3. 合并 → EFfectivePolicy
 */
export function getEffectivePolicy(domain: QualityDomain): EffectivePolicy {
  const override = getDomainOverride(domain)

  const scoring: ScoringPolicy = {
    ...currentGlobal.scoring,
    ...(override?.scoring ?? {}),
  }

  const retry: RetryPolicy = {
    ...currentGlobal.retry,
    ...(override?.retry ?? {}),
  }

  const escalation: EscalationPolicy = {
    ...currentGlobal.escalation,
    ...(override?.escalation ?? {}),
  }

  const enableDecision = override?.enableDecision ?? currentGlobal.enableDecision

  return {
    version: currentGlobal.version,
    scoring,
    retry,
    escalation,
    enableDecision,
  }
}

/**
 * 运行时更新全局策略（Runtime API 用）
 * 未来可以通过管理端 API 调用来热更新策略
 */
export function updateGlobalPolicy(patch: Partial<GlobalPolicy>): GlobalPolicy {
  currentGlobal = {
    ...currentGlobal,
    ...patch,
    // version 不允许降级
    version: currentGlobal.version,
  }
  console.log(`[Policy] 全局策略已更新，版本 ${currentGlobal.version}`)
  return currentGlobal
}

/**
 * 获取当前全局基线（不合并 domain）
 */
export function getGlobalBaseline(): GlobalPolicy {
  return currentGlobal
}
