// ============================================================
// policy/global-policy.ts
//
// 职责：D3 Production Policy Layer — 全局策略定义
//   系统的"唯一意志"：所有 domain 共享的全局策略基线
//
// 规则：
//   - 所有 domain 共用 global-policy 的默认值
//   - domain-policy.ts 可覆盖特定 domain 的值
//   - 任何代码路径不应直接写死阈值，应通过 PolicyProvider 获取
// ============================================================

import type { QualityDomain } from '../pipeline/validators/core/baseline-registry.js'
import type { QualityTier } from '../pipeline/validators/core/quality-anchor.js'

// ─── 评分策略 ──────────────────────────────────────────

export interface ScoringPolicy {
  /** 硬拒绝阈值（低于此值 → regenerate / escalate） */
  hardRejectThreshold: number
  /** 质量接受阈值（达到此值 → accept） */
  acceptThreshold: number
  /** 重试触发阈值（低于此值 → 概率触发 retry） */
  retryTriggerThreshold: number
  /** 重试触发概率（0-1，1=100% 触发） */
  retryTriggerProbability: number
}

// ─── 重试策略 ──────────────────────────────────────────

export interface RetryPolicy {
  /** 最大重试次数（包括质量 retry 和 infra retry） */
  maxQualityRetries: number
  /** infra 重试次数 */
  maxInfraRetries: number
  /** backoff 基时间隔（ms） */
  backoffMs: number
}

// ─── 升级策略 ──────────────────────────────────────────

export interface EscalationPolicy {
  /** 是否启用自动升级 */
  enabled: boolean
  /** 升级触发条件 */
  triggers: EscalationTrigger[]
  /** 生成 HITL 报告 */
  generateReport: boolean
  /** 报告目标（console / api / webhook） */
  reportTarget: 'console' | 'api' | 'webhook'
}

export interface EscalationTrigger {
  type: 'retry_exhausted' | 'quality_collapse' | 'domain_mismatch' | 'critical_issue'
  /** 触发该条件的评分上限 */
  scoreBelow?: number
  /** 该条件连续触发次数 */
  consecutiveCount?: number
}

// ─── 全局策略 ──────────────────────────────────────────

export interface GlobalPolicy {
  /** 策略版本 */
  version: string
  /** 评分策略（全局默认） */
  scoring: ScoringPolicy
  /** 重试策略（全局默认） */
  retry: RetryPolicy
  /** 升级策略 */
  escalation: EscalationPolicy
  /** 是否启用 D2 决策引擎 */
  enableDecision: boolean
  /** 策略描述 */
  description: string
}

// ─── 默认全局策略 V1 ──────────────────────────────────

export const DEFAULT_GLOBAL_POLICY_V1: GlobalPolicy = {
  version: '1.0.0',
  scoring: {
    hardRejectThreshold: 0.3,
    acceptThreshold: 0.5,
    retryTriggerThreshold: 0.5,
    retryTriggerProbability: 1.0,
  },
  retry: {
    maxQualityRetries: 2,
    maxInfraRetries: 2,
    backoffMs: 3000,
  },
  escalation: {
    enabled: true,
    triggers: [
      { type: 'retry_exhausted', scoreBelow: 0.5 },
      { type: 'quality_collapse', scoreBelow: 0.15, consecutiveCount: 2 },
      { type: 'critical_issue', consecutiveCount: 1 },
    ],
    generateReport: true,
    reportTarget: 'console',
  },
  enableDecision: false,
  description: '默认全局策略 — 适用于所有 domain 的基线配置',
}
