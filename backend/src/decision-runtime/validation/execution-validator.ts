/**
 * execution-validator.ts — Decision Execution Validator
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-3.0.5: Decision Compiler Validation Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * ExecutionValidator 是编译器的语义正确性检查器。
 *
 * 它的角色不是测试，而是"编译器语义正确性检查"。
 * 每次 Run() 完成后，自动调用 validateTrace() 检查输出语义。
 *
 * 宪法：
 *   1. 验证必须是确定性的（相同 trace 永远相同结果）
 *   2. 验证不修改 trace（只读）
 *   3. ERROR 级规则违反 = isValid = false
 *   4. WARNING 规则违反只告警不影响 isValid
 *
 * @phase decision-runtime
 */

import type { DecisionTrace } from '../telemetry/decision-trace.js'
import type { ValidationResult, ValidationNode } from './validation-result.js'
import { DECISION_COMPILER_RULES } from './rule-set.js'
import { RuleSeverity, calculateHealthScore, buildSummary } from './validation-result.js'

// ============================================================
// 1. ExecutionValidator
// ============================================================

export class ExecutionValidator {
  /**
   * 验证一次决策执行的语义正确性
   *
   * @param trace — 待验证的执行 Trace
   * @param round — 可选轮次编号（用于多次验证的场景）
   */
  validateTrace(trace: DecisionTrace, round?: number): ValidationResult {
    const errors: ValidationNode[] = []
    const warnings: ValidationNode[] = []

    for (const rule of DECISION_COMPILER_RULES) {
      try {
        const failReason = rule.check(trace)
        const passed = failReason === null
        const node: ValidationNode = {
          ruleId: rule.id,
          passed,
          message: passed ? `✅ ${rule.name}` : `❌ ${failReason}`,
          severity: rule.severity,
        }

        if (passed) continue

        if (rule.severity === RuleSeverity.ERROR) {
          errors.push(node)
        } else {
          warnings.push(node)
        }
      } catch (err: any) {
        // 规则自身崩溃 = ERROR
        errors.push({
          ruleId: rule.id,
          passed: false,
          message: `💥 规则执行异常: ${err.message}`,
          severity: RuleSeverity.ERROR,
        })
      }
    }

    const isValid = errors.length === 0
    const healthScore = calculateHealthScore(errors, warnings)
    const summary = buildSummary(isValid, errors, warnings)

    return {
      isValid,
      validatedAt: new Date().toISOString(),
      traceId: trace.traceId,
      errors,
      warnings,
      healthScore,
      summary,
      ...(round !== undefined ? { round } : {}),
    }
  }

  /**
   * 生成可读验证报告
   */
  summarize(result: ValidationResult): string {
    const lines: string[] = [
      `━━━ Decision Compiler Validation ━━━`,
      `Trace: ${result.traceId}`,
      `结果: ${result.isValid ? '✅ 通过' : '❌ 未通过'}`,
      `健康度: ${result.healthScore}/100`,
      ``,
    ]

    if (result.errors.length > 0) {
      lines.push(`🔴 硬性错误 (${result.errors.length}):`)
      for (const err of result.errors) {
        lines.push(`   ${err.message}`)
      }
      lines.push(``)
    }

    if (result.warnings.length > 0) {
      lines.push(`🟡 软性警告 (${result.warnings.length}):`)
      for (const warn of result.warnings) {
        lines.push(`   ${warn.message}`)
      }
      lines.push(``)
    }

    lines.push(result.summary)
    return lines.join('\n')
  }
}

// ============================================================
// 2. 单例
// ============================================================

export const executionValidator = new ExecutionValidator()
