/**
 * rule-set.ts — Decision Compiler Rules（编译器规则集）
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-3.0.5: Decision Compiler Validation Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * 此文件定义"编译器规则"——决策管道必须遵守的语义正确性约束。
 *
 * 规则分类：
 *   1. STRUCTURAL — 结构完整性规则（必须有/必须有值）
 *   2. SEMANTIC    — 语义一致性规则（值必须在合理范围）
 *   3. PIPELINE    — 管道执行规则（执行顺序/覆盖度）
 *
 * 宪法：
 *   1. 规则必须确定性的（相同 trace 永远相同验证结果）
 *   2. 规则可通过配置文件扩展（未来支持外部规则加载）
 *   3. 新增规则必须在数组中注册
 *   4. ERROR 级规则违反 = isValid = false
 *
 * @phase decision-runtime
 */

import type { DecisionTrace } from '../telemetry/decision-trace.js'
import type { ValidationRule } from './validation-result.js'
import { RuleSeverity } from './validation-result.js'

// ============================================================
// 1. 规则定义
// ============================================================

// ── STRUCTURAL（结构完整性） ──

const RULE_REQUIREMENT_DOMAIN_EXISTS: ValidationRule = {
  id: 'STRUCT-001',
  name: '需求领域必须存在',
  description: 'DecisionProblem 的 domain 不能为空',
  severity: RuleSeverity.ERROR,
  check: (trace) => {
    // 查找 requirement_analysis 节点的输出摘要
    const node = trace.nodes.find(n => n.nodeType === 'requirement_analysis')
    if (!node) return '缺少 requirement_analysis 节点'
    if (!node.outputSummary || node.outputSummary === '') return '需求分析输出为空'
    return null
  },
}

const RULE_EVALUATION_AXES_EXISTS: ValidationRule = {
  id: 'STRUCT-002',
  name: '评估轴必须存在',
  description: 'ReasoningFrame 必须至少有一个评估轴',
  severity: RuleSeverity.ERROR,
  check: (trace) => {
    const node = trace.nodes.find(n => n.nodeType === 'reasoning_frame')
    if (!node) return '缺少 reasoning_frame 节点'
    if (!node.success) return 'ReasoningFrame 生成失败'
    return null
  },
}

const RULE_SEARCH_RESULTS_NOT_EMPTY: ValidationRule = {
  id: 'STRUCT-003',
  name: '搜索结果不应为空（推荐性规则）',
  description: '搜索阶段应返回至少一条证据',
  severity: RuleSeverity.WARNING,
  check: (trace) => {
    const node = trace.nodes.find(n => n.nodeType === 'search')
    if (!node) return '缺少 search 节点'
    const output = node.outputSummary || ''
    if (output.includes('0 条')) return '搜索返回 0 条证据'
    return null
  },
}

const RULE_CANDIDATES_EXIST: ValidationRule = {
  id: 'STRUCT-004',
  name: '候选列表不能为空',
  description: '至少有一个候选参与评分',
  severity: RuleSeverity.ERROR,
  check: (trace) => {
    const node = trace.nodes.find(n => n.nodeType === 'scoring')
    if (!node) return '缺少 scoring 节点'
    const output = node.outputSummary || ''
    if (output.includes('0 个') || !output.includes('候选')) return '评分阶段未生成任何候选'
    return null
  },
}

const RULE_RECOMMENDATION_HAS_RESULTS: ValidationRule = {
  id: 'STRUCT-005',
  name: '推荐列表必须非空',
  description: 'Recommendation 必须至少推荐一项',
  severity: RuleSeverity.ERROR,
  check: (trace) => {
    const node = trace.nodes.find(n => n.nodeType === 'recommendation')
    if (!node) return '缺少 recommendation 节点'
    if (!node.success) return '推荐生成失败'
    return null
  },
}

const RULE_REPORT_GENERATED: ValidationRule = {
  id: 'STRUCT-006',
  name: '报告必须生成',
  description: 'ReportAgent 必须成功生成报告',
  severity: RuleSeverity.ERROR,
  check: (trace) => {
    const node = trace.nodes.find(n => n.nodeType === 'report')
    if (!node) return '缺少 report 节点'
    if (!node.success) return '报告生成失败'
    return null
  },
}

// ── SEMANTIC（语义一致性） ──

const RULE_ALL_NODES_EXECUTED: ValidationRule = {
  id: 'SEM-001',
  name: '所有节点必须执行',
  description: '7 个 Agent 节点都必须有执行记录',
  severity: RuleSeverity.ERROR,
  check: (trace) => {
    const requiredTypes = [
      'requirement_analysis',
      'reasoning_frame',
      'search',
      'evidence',
      'scoring',
      'recommendation',
      'report',
    ]
    const executedTypes = new Set(trace.nodes.map(n => n.nodeType))
    const missing = requiredTypes.filter(t => !executedTypes.has(t))
    if (missing.length > 0) return `缺少节点: ${missing.join(', ')}`
    return null
  },
}

const RULE_NO_CRITICAL_FAILURES: ValidationRule = {
  id: 'SEM-002',
  name: '无致命失败节点',
  description: 'ERROR 级节点不允许失败。WARNING 级允许失败但需记录。',
  severity: RuleSeverity.ERROR,
  check: (trace) => {
    const criticalTypes = ['requirement_analysis', 'reasoning_frame', 'scoring', 'recommendation']
    const failed = trace.nodes.filter(n =>
      criticalTypes.includes(n.nodeType) && n.finishedAt && !n.success
    )
    if (failed.length > 0) {
      return `关键节点失败: ${failed.map(n => `${n.nodeType}(${n.error || '未知错误'})`).join(', ')}`
    }
    return null
  },
}

const RULE_EXECUTION_ORDER_VALID: ValidationRule = {
  id: 'SEM-003',
  name: '执行顺序正确',
  description: '节点必须按预期顺序执行',
  severity: RuleSeverity.WARNING,
  check: (trace) => {
    const expectedOrder = [
      'requirement_analysis',
      'reasoning_frame',
      'search',
      'evidence',
      'scoring',
      'recommendation',
      'report',
    ]
    const actualOrder = trace.nodes
      .filter(n => n.finishedAt)
      .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
      .map(n => n.nodeType)

    // 检查预期顺序是否在 actual 中保持
    let i = 0
    for (const expected of expectedOrder) {
      const idx = actualOrder.indexOf(expected, i)
      if (idx === -1) return `缺少节点: ${expected}`
      i = idx + 1
    }
    return null
  },
}

const RULE_STATUS_CONSISTENT: ValidationRule = {
  id: 'SEM-004',
  name: 'Trace 最终状态与节点一致',
  description: 'Trace 状态为 completed 时所有节点应成功；failed 时应有失败节点',
  severity: RuleSeverity.ERROR,
  check: (trace) => {
    if (trace.status === 'completed') {
      const failedNodes = trace.nodes.filter(n => n.finishedAt && !n.success)
      if (failedNodes.length > 0) {
        return `Trace 标记为 completed 但 ${failedNodes.length} 个节点失败`
      }
    }
    if (trace.status === 'failed') {
      const allSucceeded = trace.nodes.every(n => !n.finishedAt || n.success)
      if (allSucceeded) {
        return 'Trace 标记为 failed 但所有节点均成功'
      }
    }
    return null
  },
}

// ── PIPELINE（管道质量） ──

const RULE_DURATION_REASONABLE: ValidationRule = {
  id: 'PIPE-001',
  name: '执行时间合理',
  description: '单次执行不应超过 30 秒',
  severity: RuleSeverity.WARNING,
  check: (trace) => {
    if (trace.durationMs && trace.durationMs > 30_000) {
      return `执行时间 ${trace.durationMs}ms 超过 30s 建议值`
    }
    return null
  },
}

const RULE_EVENT_LOGGING: ValidationRule = {
  id: 'PIPE-002',
  name: '事件日志完整性',
  description: 'completed trace 应包含 decision_completed 事件',
  severity: RuleSeverity.WARNING,
  check: (trace) => {
    if (trace.status === 'completed') {
      const hasEvent = trace.events.some(e => (e.eventType as string) === 'decision_completed')
      if (!hasEvent) return '缺少 decision_completed 事件'
    }
    return null
  },
}

// ============================================================
// 2. 规则注册表（所有规则必须在此注册）
// ============================================================

export const DECISION_COMPILER_RULES: ValidationRule[] = [
  // STRUCTURAL
  RULE_REQUIREMENT_DOMAIN_EXISTS,
  RULE_EVALUATION_AXES_EXISTS,
  RULE_SEARCH_RESULTS_NOT_EMPTY,
  RULE_CANDIDATES_EXIST,
  RULE_RECOMMENDATION_HAS_RESULTS,
  RULE_REPORT_GENERATED,

  // SEMANTIC
  RULE_ALL_NODES_EXECUTED,
  RULE_NO_CRITICAL_FAILURES,
  RULE_EXECUTION_ORDER_VALID,
  RULE_STATUS_CONSISTENT,

  // PIPELINE
  RULE_DURATION_REASONABLE,
  RULE_EVENT_LOGGING,
]

// ============================================================
// 3. 按严重级别分组
// ============================================================

export function getErrorRules(): ValidationRule[] {
  return DECISION_COMPILER_RULES.filter(r => r.severity === RuleSeverity.ERROR)
}

export function getWarningRules(): ValidationRule[] {
  return DECISION_COMPILER_RULES.filter(r => r.severity === RuleSeverity.WARNING)
}
