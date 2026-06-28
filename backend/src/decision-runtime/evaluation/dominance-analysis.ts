/**
 * dominance-analysis.ts — P1.3 Evaluation Geometry: Dominance Analysis
 *
 * Pareto 支配判定：
 *   A dominates B if: ∀axis A[i] >= B[i] AND ∃axis A[i] > B[i]
 *
 * 两层分析:
 *   1. Pairwise Dominance — 每对候选的支配关系
 *   2. Pareto Frontier — 不被任何其他候选支配的候选集合
 */

import { CandidateVector } from './candidate-vector.js'

export interface DominanceRelation {
  /** 支配者 */
  dominatorId: string
  /** 被支配者 */
  dominatedId: string
  /** 支配强度: 所有维度上超越的幅度均值 */
  margin: number
}

export interface ParetoFrontier {
  /** 前沿候选 */
  frontier: CandidateVector[]
  /** 被支配候选 */
  dominated: CandidateVector[]
  /** 全局支配关系 */
  relations: DominanceRelation[]
}

/**
 * 检查 A 是否 Pareto 支配 B
 *
 * 支配条件:
 *   A >= B on all axes
 *   A > B on at least one axis
 */
function dominates(a: CandidateVector, b: CandidateVector): boolean {
  const n = a.values.length
  let strictBetter = false
  for (let i = 0; i < n; i++) {
    if (a.values[i] < b.values[i]) return false
    if (a.values[i] > b.values[i]) strictBetter = true
  }
  return strictBetter
}

/**
 * 计算 A 支配 B 的强度 (margin)
 */
function dominanceMargin(a: CandidateVector, b: CandidateVector): number {
  const n = a.values.length
  let totalMargin = 0
  for (let i = 0; i < n; i++) {
    totalMargin += a.values[i] - b.values[i]
  }
  return totalMargin / n
}

/**
 * 构建所有候选的 pairwise 支配关系
 */
export function computeDominanceRelations(
  candidates: CandidateVector[],
): DominanceRelation[] {
  const relations: DominanceRelation[] = []
  for (let i = 0; i < candidates.length; i++) {
    for (let j = 0; j < candidates.length; j++) {
      if (i === j) continue
      if (dominates(candidates[i], candidates[j])) {
        relations.push({
          dominatorId: candidates[i].candidateId,
          dominatedId: candidates[j].candidateId,
          margin: dominanceMargin(candidates[i], candidates[j]),
        })
      }
    }
  }
  return relations
}

/**
 * 计算 Pareto Frontier
 *
 * 不被任何其他候选支配的候选集合 = 前沿面
 * 被至少一个其他候选支配的候选 = 被支配集合
 */
export function computeParetoFrontier(
  candidates: CandidateVector[],
): ParetoFrontier {
  const frontier: CandidateVector[] = []
  const dominated: CandidateVector[] = []

  for (const c of candidates) {
    let isDominated = false
    for (const other of candidates) {
      if (c.candidateId === other.candidateId) continue
      if (dominates(other, c)) {
        isDominated = true
        break
      }
    }
    if (isDominated) {
      dominated.push(c)
    } else {
      frontier.push(c)
    }
  }

  return {
    frontier,
    dominated,
    relations: computeDominanceRelations(frontier),
  }
}

/**
 * 从 Pareto Frontier 中选择最平衡的候选
 *
 * "平衡" = 在所有轴上的最小值最大的候选
 * (即最大化最小维度 — 类似 Rawlsian max-min 原则)
 */
export function selectBalancedCandidate(
  frontier: CandidateVector[],
): CandidateVector | null {
  if (frontier.length === 0) return null
  if (frontier.length === 1) return frontier[0]

  let best = frontier[0]
  let bestMin = Math.min(...best.values)

  for (const c of frontier) {
    const min = Math.min(...c.values)
    if (min > bestMin) {
      bestMin = min
      best = c
    }
  }

  return best
}

/**
 * 从 Pareto Frontier 中选择"alternative"候选
 *
 * 选择与 recommended 差异最大的候选（最大欧氏距离）
 */
export function selectMaxDistantCandidate(
  frontier: CandidateVector[],
  reference: CandidateVector,
): CandidateVector | null {
  if (frontier.length <= 1) return null

  let best: CandidateVector | null = null
  let bestDist = -1

  for (const c of frontier) {
    if (c.candidateId === reference.candidateId) continue
    let dist = 0
    for (let i = 0; i < c.values.length; i++) {
      dist += (c.values[i] - reference.values[i]) ** 2
    }
    dist = Math.sqrt(dist)
    if (dist > bestDist) {
      bestDist = dist
      best = c
    }
  }

  return best
}
