/**
 * recommendation-engine.ts — P1.3 Evaluation Geometry: Recommendation Layer
 *
 * 三层输出结构:
 *   recommended: Pareto Frontier 上的最平衡候选
 *   alternative: 前沿上与 recommended 差异最大的候选
 *   contrarian: 被支配但提供差异化视角的候选
 *
 * 输出格式:
 *   {
 *     recommended: { candidate, vector, reasoning },
 *     alternative: { candidate, vector, reasoning },
 *     contrarian: { candidate, vector, reasoning }
 *   }
 */

import { GeometryResult, extractRecommendations } from '../evaluation/geometry-engine.js'

export interface RecommendationOutput {
  recommended: {
    id: string
    label: string
    vector: number[]
    reasoning: string
  }
  alternative: {
    id: string
    label: string
    vector: number[]
    reasoning: string
  }
  contrarian: {
    id: string
    label: string
    vector: number[]
    reasoning: string
  }
}

/**
 * 生成推荐层输出
 */
export function generateRecommendations(
  geometryResult: GeometryResult,
  userQuery: string,
): RecommendationOutput {
  const recs = extractRecommendations(geometryResult)
  const { metrics } = geometryResult

  // 生成推理文本
  const recReasoning = recs.recommended
    ? `前沿面推荐: 候选在所有 ${metrics.axisAverages.length} 维评估轴上达到最佳平衡，最大化最小维度表现。`
    : '无前沿候选'

  const altReasoning = recs.alternative
    ? `替代推荐: 与主推荐差异最大的前沿候选，提供不同维度的优势组合。`
    : '前沿面仅一个候选，无替代选择'

  const conReasoning = recs.contrarian
    ? `反方推荐: 被支配但提供相反视角，适合需要多角度分析的决策场景。包含该候选不代表其综合评分最高。`
    : '无有效反方候选'

  return {
    recommended: {
      id: recs.recommended?.id || 'none',
      label: recs.recommended?.label || '无推荐',
      vector: recs.recommended?.vector || [],
      reasoning: recReasoning,
    },
    alternative: {
      id: recs.alternative?.id || 'none',
      label: recs.alternative?.label || '无替代',
      vector: recs.alternative?.vector || [],
      reasoning: altReasoning,
    },
    contrarian: {
      id: recs.contrarian?.id || 'none',
      label: recs.contrarian?.label || '无反方',
      vector: recs.contrarian?.vector || [],
      reasoning: conReasoning,
    },
  }
}
