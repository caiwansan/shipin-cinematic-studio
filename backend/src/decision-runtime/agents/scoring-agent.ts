/**
 * scoring-agent.ts — Agent Skeleton
 *
 * Phase A.2: Agent Skeleton Layer
 *
 * 职责：
 *   1. 对 Candidate 进行多维度评分
 *   2. 评分维度来自 ReasoningFrame.evaluationAxes
 *   3. 输出 EvaluationScoreCard（统一评分语义）
 *
 * 禁止：
 *   ❌ 直接输出原始数字（必须使用 ScoreLevel / Confidence）
 *   ❌ 独立发明评估维度
 *   ❌ 跳过 evidence 直接评分
 *
 * @phase decision-runtime
 */

import type { ContractCandidate, ContractEvidence } from '../cognition/agent-contract.js'
import type { ReasoningFrame } from '../cognition/reasoning-frame.js'
import type { EvaluationScoreCard } from '../cognition/evaluation-schema.js'

export interface ScoringAgent {
  score(candidate: ContractCandidate, evidence: ContractEvidence[], frame: ReasoningFrame): Promise<EvaluationScoreCard>
}

export type { ContractCandidate, ContractEvidence, ReasoningFrame, EvaluationScoreCard }
