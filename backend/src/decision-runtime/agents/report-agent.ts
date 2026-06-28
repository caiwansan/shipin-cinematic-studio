/**
 * report-agent.ts — Agent Skeleton
 *
 * Phase A.2: Agent Skeleton Layer
 *
 * 职责：
 *   1. 接收全部决策数据
 *   2. 生成结构化决策报告
 *   3. 支持 markdown / json / html 格式
 *
 * 禁止：
 *   ❌ 跳过 metadata（报告必须包含完整的决策链信息）
 *   ❌ 只返回文本（必须包含结构化 metadata）
 *
 * @phase decision-runtime
 */

import type { ContractDecisionReport, ContractCandidate, ContractRecommendation } from '../cognition/agent-contract.js'
import type { DecisionProblem } from '../cognition/decision-problem.js'
import type { ReasoningFrame } from '../cognition/reasoning-frame.js'

export interface ReportAgent {
  generate(params: {
    problem: DecisionProblem
    frame: ReasoningFrame
    candidates: ContractCandidate[]
    recommendation: ContractRecommendation
  }): Promise<ContractDecisionReport>
}

export type { ContractDecisionReport, ContractCandidate, ContractRecommendation, DecisionProblem, ReasoningFrame }
