/**
 * recommendation-agent.ts — Agent Skeleton
 *
 * Phase A.2: Agent Skeleton Layer
 *
 * 职责：
 *   1. 综合 EvaluationScoreCard 排序
 *   2. 输出推荐列表 + 风险警告 + 行动建议
 *
 * 禁止：
 *   ❌ 仅做排序器（必须包含决策结构意义）
 *   ❌ 忽略 scoring 结果
 *
 * @phase decision-runtime
 */

import type { ContractCandidate, ContractRecommendation, DecisionProblem } from '../cognition/agent-contract.js'

export interface RecommendationAgent {
  recommend(candidates: ContractCandidate[], problem: DecisionProblem): Promise<ContractRecommendation>
}

export type { ContractCandidate, ContractRecommendation, DecisionProblem }
