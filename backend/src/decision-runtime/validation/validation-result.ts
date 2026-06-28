/**
 * validation-result.ts — Validation Result Types
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-3.0.5: Decision Compiler Validation Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * Validation Result 是编译器语义正确性检查的输出。
 *
 * 核心指标：
 *   - isValid:        是否通过全部硬性规则
 *   - errors:         违反硬性规则的条目（必须修复）
 *   - warnings:       违反软性规则的条目（建议关注）
 *   - healthScore:    管道健康度 0-100（基于通过率）
 *
 * @phase decision-runtime
 */

import type { DecisionTrace } from '../telemetry/decision-trace.js'

// ============================================================
// 1. 校验规则定义
// ============================================================

export enum RuleSeverity {
  /** 硬性规则 — 违反即判定 invalid */
  ERROR = 'error',

  /** 软性规则 — 违反仅 warning */
  WARNING = 'warning',
}

export interface ValidationRule {
  /** 规则唯一标识 */
  id: string

  /** 规则名称 */
  name: string

  /** 规则描述 */
  description: string

  /** 严重级别 */
  severity: RuleSeverity

  /** 检查函数 (返回 null 表示通过, 返回 string 表示失败原因) */
  check: (trace: DecisionTrace) => string | null
}

// ============================================================
// 2. 校验节点
// ============================================================

export interface ValidationNode {
  ruleId: string
  passed: boolean
  message: string
  severity: RuleSeverity
}

// ============================================================
// 3. 校验结果
// ============================================================

export interface ValidationResult {
  /** 是否通过全部硬性规则 */
  isValid: boolean

  /** 校验时间 */
  validatedAt: string

  /** 校验的 Trace ID */
  traceId: string

  /** 硬性错误 */
  errors: ValidationNode[]

  /** 软性警告 */
  warnings: ValidationNode[]

  /** 轮次编号（用于多次校验） */
  round?: number

  /** 健康度评分 0-100 */
  healthScore: number

  /** 校验摘要 */
  summary: string
}

// ============================================================
// 4. 健康度计算
// ============================================================

/**
 * 计算 pipeline 健康度
 * 公式：通过节点数 / 总节点数 × 100
 */
export function calculateHealthScore(errors: ValidationNode[], warnings: ValidationNode[]): number {
  const total = errors.length + warnings.length
  if (total === 0) return 100

  const passed = total - errors.length
  return Math.round((passed / total) * 100)
}

// ============================================================
// 5. 生成摘要
// ============================================================

export function buildSummary(
  isValid: boolean,
  errors: ValidationNode[],
  warnings: ValidationNode[],
): string {
  const parts: string[] = []

  if (isValid) {
    parts.push('✅ 所有硬性规则通过')
  } else {
    parts.push(`❌ ${errors.length} 条硬性规则未通过`)
  }

  if (warnings.length > 0) {
    parts.push(`⚠️ ${warnings.length} 条警告`)
  }

  parts.push(`健康度: ${calculateHealthScore(errors, warnings)}/100`)

  return parts.join(' | ')
}
