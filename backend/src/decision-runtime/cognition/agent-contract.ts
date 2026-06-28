/**
 * agent-contract.ts — Agent 输入输出契约（强约束）
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-1.5: Decision Cognition Schema Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * 此文件定义所有 Agent 的输入输出契约。
 *
 * 强制规则：
 *   1. 所有 Agent 必须经过 Problem → Frame → Evidence → Evaluation → Score
 *   2. 禁止 Agent 直接消费 string
 *   3. 禁止 Agent 直接输出 score
 *   4. 禁止 Agent 直接排序 candidate
 *
 * 数据流：
 *   DecisionProblem → ReasoningFrame → Requirement → Evidence[] →
 *   EvaluationScoreCard[] → Recommendation → DecisionReport
 *
 * @phase decision-runtime
 */

import type { DecisionProblem } from './decision-problem.js'
import type { ReasoningFrame } from './reasoning-frame.js'
import type { EvaluationScoreCard } from './evaluation-schema.js'

// Re-export 以供 Agent 使用
export type { DecisionProblem, ReasoningFrame, EvaluationScoreCard }

// ============================================================
// 1. Requirement — 从 Problem + Frame 生成的结构化搜索需求
// ============================================================

export interface SearchRequirement {
  problem: DecisionProblem
  frame: ReasoningFrame
  searchQueries: string[]
  targetTypes: string[] // 搜索目标类型（如 "律师事务所" "楼盘" "医院"）
  cityFilter?: string
  budgetRange?: { min?: number; max?: number; unit?: string }
}

// ============================================================
// 2. Evidence — 证据（与 cognition 层一致但用于 Agent 间传递）
// ============================================================

export interface ContractEvidence {
  id: string
  source: string
  content: string
  credibility: number // 0-100
  relevantAxes: string[] // 关联的评估轴名称
  timestamp?: string
}

// ============================================================
// 3. Candidate — 候选对象
// ============================================================

export interface ContractCandidate {
  id: string
  name: string
  type: string
  description: string
  evidenceIds: string[]
  scoreCard?: EvaluationScoreCard
}

// ============================================================
// 4. Recommendation — 推荐结果
// ============================================================

export interface ContractRecommendation {
  rankedCandidateIds: string[]
  reasoning: string
  riskWarnings: string[]
  suggestedActions: string[]
  /** P1.3 Geometry 评估元数据（可选，geometry 模式才有） */
  geometry?: {
    frontierSize: number
    frontierRatio: number
    dominanceRatio: number
    scoreEntropy: number
    frontierDensity: number
    axisAverages: number[]
    axisStdDevs: number[]
  }
}

// ============================================================
// 5. DecisionReport — 最终报告
// ============================================================

export interface ContractDecisionReport {
  format: 'markdown' | 'json' | 'html'
  title: string
  summary: string
  content: string
  metadata: {
    problem: DecisionProblem
    frame: ReasoningFrame
    evaluatedCandidates: number
    scoreCards: EvaluationScoreCard[]
    recommendation: ContractRecommendation
    generatedAt: string
  }
}

// ============================================================
// 6. Agent 接口声明
// ============================================================

export interface IRequirementAgent {
  /** Problem → Requirement（含 search queries） */
  analyze(problem: DecisionProblem): Promise<SearchRequirement>
}

export interface ISearchAgent {
  /** Search Requirement → Evidence[] */
  search(requirement: SearchRequirement): Promise<ContractEvidence[]>
}

export interface IEvidenceAgent {
  /** Raw Evidence → 筛选整理后的 Evidence */
  evaluate(evidences: ContractEvidence[], frame: ReasoningFrame): Promise<ContractEvidence[]>
}

export interface IScoringAgent {
  /** Evidence + Frame → ScoreCard */
  score(candidate: ContractCandidate, evidence: ContractEvidence[], frame: ReasoningFrame): Promise<EvaluationScoreCard>
}

export interface IRecommendationAgent {
  /** ScoreCards + Problem → Recommendation */
  recommend(candidates: ContractCandidate[], problem: DecisionProblem): Promise<ContractRecommendation>
}

export interface IReportAgent {
  /** 全部数据 → Report */
  generate(params: {
    problem: DecisionProblem
    frame: ReasoningFrame
    candidates: ContractCandidate[]
    recommendation: ContractRecommendation
  }): Promise<ContractDecisionReport>
}
