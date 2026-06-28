/**
 * geometry-engine.ts — P1.3 Evaluation Geometry: 主引擎
 *
 * 将 P-0 的输出候选转换为几何评估结果。
 *
 * 流程:
 *   1. 接收候选列表和企业evidence
 *   2. 构建 CandidateVector（射入评估轴空间）
 *   3. 计算 Pareto Frontier
 *   4. 计算 Geometry Metrics
 *   5. 输出 Fronttier + Metrics
 */

import { CandidateInfo, CandidateVector, buildAllVectors } from './candidate-vector.js'
import {
  computeParetoFrontier,
  selectBalancedCandidate,
  selectMaxDistantCandidate,
  ParetoFrontier,
} from './dominance-analysis.js'
import { computeGeometryMetrics, GeometryMetrics } from './geometry-metrics.js'

export interface GeometryResult {
  vectors: CandidateVector[]
  frontier: ParetoFrontier
  recommended: CandidateVector | null
  alternative: CandidateVector | null
  metrics: GeometryMetrics
}

/**
 * 核心引擎: 将候选结果转换为几何评估
 */
export function evaluateGeometry(candidates: CandidateInfo[]): GeometryResult {
  // 1. 构建向量
  const vectors = buildAllVectors(candidates)

  // 2. 计算 Pareto Frontier
  const frontier = computeParetoFrontier(vectors)

  // 3. 选择 recommended (max-min 平衡候选)
  const recommended = selectBalancedCandidate(frontier.frontier)

  // 4. 选择 alternative (与 recommended 差异最大的前沿候选)
  const alternative = recommended
    ? selectMaxDistantCandidate(frontier.frontier, recommended)
    : null

  // 5. 计算指标
  const metrics = computeGeometryMetrics(
    frontier.frontier.map(v => v.values),
    vectors.map(v => v.values),
    frontier.relations.length,
  )

  return {
    vectors,
    frontier,
    recommended,
    alternative,
    metrics,
  }
}

/**
 * 从几何结果中提取推荐层输出
 */
export function extractRecommendations(
  result: GeometryResult,
): {
  recommended: { id: string; label: string; vector: number[] } | null
  alternative: { id: string; label: string; vector: number[] } | null
  contrarian: { id: string; label: string; vector: number[] } | null
} {
  const toOutput = (v: CandidateVector | null) =>
    v ? { id: v.candidateId, label: v.label, vector: v.values } : null

  // contrarian: 从被支配候选中选择距离 recommended 最远的
  let contrarian: CandidateVector | null = null
  if (result.recommended && result.frontier.dominated.length > 0) {
    let bestDist = -1
    for (const d of result.frontier.dominated) {
      let dist = 0
      for (let i = 0; i < d.values.length; i++) {
        dist += (d.values[i] - result.recommended.values[i]) ** 2
      }
      dist = Math.sqrt(dist)
      if (dist > bestDist) {
        bestDist = dist
        contrarian = d
      }
    }
  }

  return {
    recommended: toOutput(result.recommended),
    alternative: toOutput(result.alternative),
    contrarian: toOutput(contrarian),
  }
}
