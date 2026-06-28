/**
 * report.agent.ts — A-3.0 确定性 ReportAgent
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-3.0: Agent Deterministic Core
 * ═══════════════════════════════════════════════════════════════
 *
 * 只做: structured data → markdown template
 * 禁止: 写总结
 * 禁止: 写分析
 * 禁止: 写建议
 *
 * 模板填充，纯确定性替换。
 * 数据来源是其他 Agent 的输出，不做任何额外的智能处理。
 *
 * @phase decision-runtime
 */

import type { ContractDecisionReport, ContractCandidate, ContractRecommendation } from '../../cognition/agent-contract.js'
import type { DecisionProblem } from '../../cognition/decision-problem.js'
import type { ReasoningFrame } from '../../cognition/reasoning-frame.js'
import { fillReportTemplate } from '../core/deterministic-transform.js'

export class ReportAgent {
  /**
   * 确定性报告生成
   * transform(structured data) → markdown template
   */
  generate(params: {
    problem: DecisionProblem
    frame: ReasoningFrame
    candidates: ContractCandidate[]
    recommendation: ContractRecommendation
  }): ContractDecisionReport {
    return fillReportTemplate(
      params.problem,
      params.frame,
      params.candidates.map(c => ({
        id: c.id,
        name: c.name,
        scoreCard: c.scoreCard!,
      })),
      params.recommendation,
    )
  }
}

export const reportAgent = new ReportAgent()
