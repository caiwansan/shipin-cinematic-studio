/**
 * recommendation.agent.ts — A-3.0 确定性 RecommendationAgent
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-3.0: Agent Deterministic Core
 * ═══════════════════════════════════════════════════════════════
 *
 * 只做: ScoreCard[] → sorted list
 * 禁止: 写理由
 * 禁止: 写解释
 * 禁止: 写建议文学
 *
 * 排序规则：按总分降序，平局者高分轴数多胜出，再平局按ID字典序。
 *
 * @phase decision-runtime
 */

import type { ContractCandidate, ContractRecommendation } from '../../cognition/agent-contract.js'
import type { DecisionProblem } from '../../cognition/decision-problem.js'
import type { EvaluationScoreCard } from '../../cognition/evaluation-schema.js'
import { sortByScore, detectRiskWarnings } from '../core/deterministic-transform.js'
import type { GeometryResult } from '../../evaluation/geometry-engine.js'

export class RecommendationAgent {
  /**
   * 确定性排序
   * 只做 deterministic sort，不做任何推理
   */
  recommend(candidates: ContractCandidate[], problem: DecisionProblem): ContractRecommendation {
    const scored = candidates
      .filter(c => c.scoreCard)
      .map(c => ({
        id: c.id,
        score: c.scoreCard!,
      }))

    const ranked = sortByScore(scored)
    const riskWarnings = this.collectRiskWarnings(candidates)
    const suggestedActions = this.generateActions(problem)

    return {
      rankedCandidateIds: ranked,
      reasoning: '', // A-3.0 不填充推理
      riskWarnings,
      suggestedActions,
    }
  }

  /**
   * 收集所有候选的风险警告
   * 不做推理，只从 evidence 的关键词匹配
   */
  private collectRiskWarnings(candidates: ContractCandidate[]): string[] {
    const warnings: string[] = []
    for (const candidate of candidates) {
      // 通过 scoreCard 的 rationale 检查风险
      if (candidate.scoreCard) {
        for (const ax of candidate.scoreCard.axes) {
          if (ax.score < 40) {
            warnings.push(`${candidate.name} 在 "${ax.axisName}" 维度评分偏低 (${ax.score}/100)`)
          }
        }
      }
    }
    return warnings
  }

  /**
   * 生成建议行动（确定性规则）
   */
  private generateActions(problem: DecisionProblem): string[] {
    const actions: string[] = []

    if (problem.objectives.includes('购买')) {
      actions.push('建议实地考察排名靠前的候选')
    }
    if (problem.constraints.some(c => c.startsWith('预算:'))) {
      actions.push('在预算范围内优先考虑信誉度高的选项')
    }
    if (problem.domain !== 'general') {
      actions.push('建议多方核实候选信息，避免信息不对称')
    }

    return actions
  }

  /**
   * geometryRecommend: 基于 Geometry Result 生成推荐
   * P1.3 主路径 — 替代纯加权排序
   */
  geometryRecommend(
    candidates: ContractCandidate[],
    problem: DecisionProblem,
    geometry: GeometryResult,
  ): ContractRecommendation {
    const recEndpoint = geometry.recommended
    const altEndpoint = geometry.alternative
    const metrics = geometry.metrics

    if (!recEndpoint) {
      return this.recommend(candidates, problem)
    }

    const selected = candidates.find(c => c.id === recEndpoint.candidateId)
    const rankedCandidateIds = [recEndpoint.candidateId]

    // alternative 在 rank 第二
    if (altEndpoint && altEndpoint.candidateId !== recEndpoint.candidateId) {
      rankedCandidateIds.push(altEndpoint.candidateId)
    }

    // 补上剩余被支配候选
    for (const c of candidates) {
      if (!rankedCandidateIds.includes(c.id)) {
        rankedCandidateIds.push(c.id)
      }
    }

    // 风险警告：从 geometry 中提取低分轴
    const riskWarnings: string[] = []
    for (const c of candidates) {
      if (c.scoreCard) {
        for (const ax of c.scoreCard.axes) {
          if (ax.score < 40) {
            riskWarnings.push(`${c.name} 在 "${ax.axisName}" 维度评分偏低 (${ax.score}/100)`)
          }
        }
      }
    }

    const suggestedActions = this.generateActions(problem)

    return {
      rankedCandidateIds,
      reasoning: `Pareto 前沿评估: ${metrics.frontierSize}/${metrics.totalCandidates} 个候选在 ${metrics.axisAverages.length} 维评估轴上互不支配。推荐 ${selected?.name || '首选'}（max-min 平衡候选）`,
      riskWarnings,
      suggestedActions,
      geometry: {
        frontierSize: metrics.frontierSize,
        frontierRatio: metrics.frontierRatio,
        dominanceRatio: metrics.dominanceRatio,
        scoreEntropy: metrics.scoreEntropy,
        frontierDensity: metrics.frontierDensity,
        axisAverages: metrics.axisAverages,
        axisStdDevs: metrics.axisStdDevs,
      },
    }
  }
}

export const recommendationAgent = new RecommendationAgent()
