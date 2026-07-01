/**
 * benchmark/judge/dimension-scorer.ts — 维度评分器
 *
 * 将 ClaimEvaluator 的输出按 BII 维度聚合为 DimensionScore。
 * 每个维度的得分 = 该维度下所有 claim 得分的加权平均。
 */
import { BIIDimension, ClaimEvaluation, DimensionScore } from '../types'

export class DimensionScorer {
  /**
   * 按维度聚合评分
   */
  score(evaluations: Map<BIIDimension, ClaimEvaluation[]>): DimensionScore[] {
    const results: DimensionScore[] = []
    
    for (const [dimension, claims] of evaluations) {
      if (claims.length === 0) continue
      
      const totalWeight = claims.reduce((sum, c) => sum + c.score, claims.length) // weight = 1 per claim
      let totalScore = claims.reduce((sum, c) => sum + c.score, 0)
      
      // 维度分 = 平均得分 × 100
      const score = Math.round((totalScore / claims.length) * 100)
      
      // 找出关键发现
      const zeroScore = claims.filter(c => c.score < 0.5).map(c => c.reason)
      
      results.push({
        dimension,
        score,
        weight: DEFAULT_WEIGHTS[dimension] ?? 0.1,
        weightedScore: score * (DEFAULT_WEIGHTS[dimension] ?? 0.1),
        keyFindings: zeroScore.slice(0, 3),
        evaluations: claims,
      })
    }
    
    return results
  }
}

const DEFAULT_WEIGHTS: Record<BIIDimension, number> = {
  visibility: 0.10,
  understanding: 0.15,
  accuracy: 0.20,
  citation: 0.10,
  recommendation: 0.20,
  comparative_preference: 0.15,
  freshness: 0.05,
  consistency: 0.05,
}
