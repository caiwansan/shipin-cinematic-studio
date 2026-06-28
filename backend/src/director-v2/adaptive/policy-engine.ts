/**
 * adaptive/policy-engine.ts — Phase 6 决策引擎（最终裁决）
 *
 * 职责：合并规则引擎输出 + LLM 建议，决定是否执行 mutation
 *
 * 决策优先级：
 *   1. 规则引擎 + LLM 建议一致 → 执行
 *   2. 规则引擎触发 critical + LLM 建议可行 → 执行
 *   3. 规则引擎触发 critical + LLM 无建议或置信度低 → 执行规则 default
 *   4. 规则引擎未触发 → 拒绝任何突变
 *   5. LLM 建议但规则引擎未触发 → 拒绝（规则层优先）
 *
 * 输出：{ approved, mutationPlan?, reason }
 *
 * 宪法：
 *   1. 最终决策是 deterministic（规则引擎权重 > LLM 权重）
 *   2. 不修改系统状态（只输出决策）
 *   3. mutationPlan 禁止包含 IR 或 StoryGraph 修改
 */

import type { RuleEngineOutput } from './rule-engine.js'
import type { AdvisorSuggestion } from './llm-advisor.js'

// ─── 类型 ─────────────────────────────────────────────────

export type MutationActionType = 'insert_rest_scene' | 'adjust_pacing' | 'adjust_intensity' | 'reorder_scene' | 'none'

export interface MutationPlan {
  action: MutationActionType
  target: 'pacing' | 'intensity' | 'shot' | 'scene'
  params: Record<string, unknown>
  confidence: number
}

export interface PolicyDecision {
  approved: boolean
  reason: string
  mutationPlan?: MutationPlan
}

// ─── 决策函数 ─────────────────────────────────────────

export function decide(
  ruleOutput: RuleEngineOutput,
  llmSuggestion: AdvisorSuggestion | null
): PolicyDecision {
  // 规则未触发 → 拒绝任何突变
  if (ruleOutput.triggers.length === 0) {
    return {
      approved: false,
      reason: '未检测到需要修复的叙事异常',
    }
  }

  // 规则引擎 + LLM 建议一致
  if (ruleOutput.hasCriticalTrigger && llmSuggestion && llmSuggestion.confidence >= 0.6) {
    const plan = buildMutationPlan(ruleOutput, llmSuggestion)
    return {
      approved: true,
      reason: `规则触发 critical [${ruleOutput.triggers.map(t => t.name).join(', ')}] + LLM 建议可信（${(llmSuggestion.confidence * 100).toFixed(0)}%）`,
      mutationPlan: plan,
    }
  }

  // 规则引擎 critical + LLM 可信度低 → 走规则默认
  if (ruleOutput.hasCriticalTrigger) {
    const plan = buildDefaultMutationPlan(ruleOutput)
    return {
      approved: true,
      reason: `规则触发 critical [${ruleOutput.triggers.map(t => t.name).join(', ')}]，走默认修复`,
      mutationPlan: plan,
    }
  }

  // 规则触发但非 critical
  if (ruleOutput.maxSeverity > 0.3 && llmSuggestion && llmSuggestion.confidence >= 0.7) {
    const plan = buildMutationPlan(ruleOutput, llmSuggestion)
    return {
      approved: true,
      reason: `规则非 critical 但 LLM 置信度高（${(llmSuggestion.confidence * 100).toFixed(0)}%）`,
      mutationPlan: plan,
    }
  }

  // 规则触发但严重度低 + LLM 未给出高置信度建议 → 不干预
  return {
    approved: false,
    reason: `规则轻微触发（max=${ruleOutput.maxSeverity.toFixed(2)}）但无需干预`,
  }
}

// ─── 内部：根据 LLM 建议构建 MutationPlan ─────────────

function buildMutationPlan(rule: RuleEngineOutput, llm: AdvisorSuggestion): MutationPlan {
  // 优先 LLM 建议
  if (llm.target === 'pacing') {
    return {
      action: 'adjust_pacing',
      target: 'pacing',
      params: { adjustment: rule.hasCriticalTrigger ? -0.3 : -0.1 },
      confidence: llm.confidence,
    }
  }
  if (llm.suggestion.toLowerCase().includes('rest') || llm.suggestion.toLowerCase().includes('slow')) {
    return {
      action: 'insert_rest_scene',
      target: 'pacing',
      params: { position: 'current', duration: 1 },
      confidence: llm.confidence,
    }
  }
  return {
    action: 'adjust_intensity',
    target: 'intensity',
    params: { delta: -0.2 },
    confidence: llm.confidence,
  }
}

// ─── 内部：默认 MutationPlan（无 LLM 时） ────────────

function buildDefaultMutationPlan(rule: RuleEngineOutput): MutationPlan {
  // 根据最高严重度的 trigger 类型确定 action
  const criticalTrigger = rule.triggers.find(t => t.severity > 0.7) ?? rule.triggers[0]

  switch (criticalTrigger.ruleId) {
    case 'pacing_too_fast':
      return {
        action: 'adjust_pacing',
        target: 'pacing',
        params: { adjustment: -0.3 },
        confidence: 0.7,
      }
    case 'pacing_too_slow':
      return {
        action: 'adjust_pacing',
        target: 'pacing',
        params: { adjustment: 0.3 },
        confidence: 0.7,
      }
    case 'scene_stagnation':
    case 'intensity_too_low':
      return {
        action: 'adjust_intensity',
        target: 'intensity',
        params: { delta: 0.2 },
        confidence: 0.6,
      }
    case 'intensity_too_high':
      return {
        action: 'insert_rest_scene',
        target: 'pacing',
        params: { position: 'next', duration: 1 },
        confidence: 0.8,
      }
    default:
      return {
        action: 'none',
        target: 'pacing',
        params: {},
        confidence: 0.5,
      }
  }
}

export default { decide }
