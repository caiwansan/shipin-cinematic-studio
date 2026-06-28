/**
 * requirement.agent.ts — A-3.0 确定性 RequirementAgent
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-3.0: Agent Deterministic Core
 * ═══════════════════════════════════════════════════════════════
 *
 * 只做: string → DecisionProblem
 * 禁止: 解释/理解/扩展/推理
 *
 * 所有逻辑：纯关键词匹配 + 规则映射
 * 无 LLM、无 NLP、无语义理解
 *
 * @phase decision-runtime
 */

import type { DecisionProblem } from '../../cognition/decision-problem.js'
import { parseToDecisionProblem, generateSearchQueries } from '../core/deterministic-transform.js'

export class RequirementAgent {
  /**
   * 确定性分析用户输入
   * transform(input A) → structured output B
   */
  analyze(rawInput: string): DecisionProblem {
    return parseToDecisionProblem(rawInput)
  }

  /**
   * 从 DecisionProblem 生成搜索查询
   * 纯规则驱动，支持 seed/domain bias（P0.10）
   */
  generateSearchQueries(problem: DecisionProblem, bias?: {
    seed?: string
    domain?: string
  }): string[] {
    return generateSearchQueries(problem, bias)
  }
}

export const requirementAgent = new RequirementAgent()
