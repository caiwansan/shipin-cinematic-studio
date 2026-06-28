/**
 * candidate-vector.ts — P1.3 Evaluation Geometry: Candidate Vector
 *
 * 每个候选结果 → 7维评估向量。
 * 提供从原始数据（search结果/evidence）到向量的映射。
 */

import { EVALUATION_AXES, EvaluationAxis, getDefaultVector } from './axis-definitions.js'

export interface ScoredEvidence {
  id: string
  text: string
  source: string
  score: number
  domain: string
  intent: string
  /** 可选: 来源域名/权威等级 */
  sourceDomain?: string
  /** 可选: 时间戳 */
  timestamp?: string
}

export interface CandidateInfo {
  id: string
  label: string
  score: number
  evidenceCount: number
  evidences: ScoredEvidence[]
  domain: string
  intent: string
  clusterSize: number
}

export interface CandidateVector {
  candidateId: string
  label: string
  values: number[]          // 7维向量, 与 EVALUATION_AXES 顺序一致
  raw: number               // 原始 score (标量, 保留兼容)
}

/**
 * 将候选结果映射到7维评估向量
 *
 * 映射规则:
 * - relevance: 从 search score 归一化
 * - authority: 从 evidence 来源域名判断 (gov/edu/academic > media > blog/forum)
 * - recency: 从 evidence 时间戳判断 (1年内=1, 5年内=0.5, 更早=0.2)
 * - completeness: 从 evidenceCount + clusterSize 综合
 * - consensus: 从 clusterSize（多方来源数）
 * - diversity: 从 domain/intent 分布（与其他候选比较）
 * - risk: 从 sourceDomain 判断 (peer-reviewed=低, social media=高)
 */
export function buildCandidateVector(
  candidate: CandidateInfo,
  allCandidates: CandidateInfo[],
): CandidateVector {
  const values: number[] = []
  for (const axis of EVALUATION_AXES) {
    let val = 0
    switch (axis.name) {
      case 'relevance':
        val = scoreToRelevance(candidate.score)
        break
      case 'authority':
        val = computeAuthority(candidate.evidences)
        break
      case 'recency':
        val = computeRecency(candidate.evidences)
        break
      case 'completeness':
        val = computeCompleteness(candidate)
        break
      case 'consensus':
        val = computeConsensus(candidate)
        break
      case 'diversity':
        val = computeDiversity(candidate, allCandidates)
        break
      case 'risk':
        val = computeRisk(candidate.evidences)
        break
    }
    values.push(clamp(val, axis))
  }
  return {
    candidateId: candidate.id,
    label: candidate.label,
    values,
    raw: candidate.score,
  }
}

/**
 * 批量构建所有候选的向量
 */
export function buildAllVectors(
  candidates: CandidateInfo[],
): CandidateVector[] {
  return candidates.map(c => buildCandidateVector(c, candidates))
}

// ── 内部映射函数 ──

function scoreToRelevance(score: number): number {
  // score 一般在 [0, 1] 范围，但可以更高
  const clamped = Math.min(score, 1)
  // 非线性映射: <0.3 → 0, 0.3-0.5 → sigmoid, >0.5 → 接近1
  if (clamped < 0.3) return 0
  if (clamped < 0.5) return (clamped - 0.3) / 0.2 * 0.5
  return 0.5 + (clamped - 0.5) / 0.5 * 0.5
}

function computeAuthority(evidences: ScoredEvidence[]): number {
  if (evidences.length === 0) return 0.1
  const scores = evidences.map(e => {
    const domain = e.sourceDomain || ''
    if (domain.includes('.gov') || domain.includes('.edu')) return 0.9
    if (domain.includes('wikipedia') || domain.includes('.org')) return 0.7
    if (domain.includes('news') || domain.includes('media')) return 0.5
    if (domain.includes('blog') || domain.includes('forum')) return 0.3
    return 0.4
  })
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

function computeRecency(evidences: ScoredEvidence[]): number {
  if (evidences.length === 0) return 0.3
  const now = Date.now()
  const scores = evidences.map(e => {
    if (!e.timestamp) return 0.3
    const age = now - new Date(e.timestamp).getTime()
    const years = age / (365 * 24 * 60 * 60 * 1000)
    if (years <= 1) return 1.0
    if (years <= 3) return 0.7
    if (years <= 5) return 0.5
    return 0.2
  })
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

function computeCompleteness(candidate: CandidateInfo): number {
  // evidenceCount + clusterSize 综合
  const ecFactor = Math.min(candidate.evidenceCount / 5, 1)  // 5条以上满
  const csFactor = Math.min(candidate.clusterSize / 3, 1)    // 3簇以上满
  return 0.6 * ecFactor + 0.4 * csFactor
}

function computeConsensus(candidate: CandidateInfo): number {
  // 簇越多表示越多独立来源达成一致
  return Math.min(candidate.clusterSize / 5, 1)
}

function computeDiversity(candidate: CandidateInfo, all: CandidateInfo[]): number {
  // 如果候选与主流不同，多样性高
  if (all.length <= 1) return 0.5
  const avgScore = all.reduce((a, b) => a + b.score, 0) / all.length
  const diff = Math.abs(candidate.score - avgScore)
  // 偏离均值越大 → 多样性越高
  return Math.min(diff / 0.5, 1)
}

function computeRisk(evidences: ScoredEvidence[]): number {
  if (evidences.length === 0) return 0.5
  const scores = evidences.map(e => {
    const domain = e.sourceDomain || ''
    if (domain.includes('.gov') || domain.includes('.edu') || domain.includes('.org')) return 0.1
    if (domain.includes('news') || domain.includes('media')) return 0.3
    if (domain.includes('blog') || domain.includes('forum')) return 0.6
    if (domain.includes('social') || !domain) return 0.7
    return 0.4
  })
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

function clamp(value: number, axis: EvaluationAxis): number {
  return Math.max(axis.min, Math.min(axis.max, value))
}
