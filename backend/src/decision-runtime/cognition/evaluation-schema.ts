/**
 * evaluation-schema.ts — Decision Evaluation Schema（统一评分语义）
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-1.5: Decision Cognition Schema Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * 此文件定义评分语义的统一契约。
 *
 * 解决的问题：
 *   Scoring Agent 需要知道"85 分意味着什么"。
 *   不同领域、不同场景下分数的语义必须一致。
 *
 * 宪法：
 *   1. 所有评分必须在 0-100 区间
 *   2. 每个维度有明确的语义等级
 *   3. 禁止评分 Agent 自由定义新维度
 *   4. 分数必须附带 Confidence 级别
 *
 * @phase decision-runtime
 */

// ============================================================
// 1. 分数语义等级
// ============================================================

export enum ScoreLevel {
  /** 优秀（90-100）— 无显著缺陷 */
  EXCELLENT = 'excellent',

  /** 良好（75-89）— 基本满意，有小瑕疵 */
  GOOD = 'good',

  /** 及格（60-74）— 可接受，有明显不足 */
  FAIR = 'fair',

  /** 差（40-59）— 低于预期，建议谨慎 */
  POOR = 'poor',

  /** 极差（0-39）— 不推荐 */
  VERY_POOR = 'very_poor',
}

// ============================================================
// 2. 置信度
// ============================================================

export enum Confidence {
  /** 有充分证据支持 */
  HIGH = 'high',

  /** 有部分证据支持 */
  MEDIUM = 'medium',

  /** 证据不足，基于有限信息评估 */
  LOW = 'low',
}

// ============================================================
// 3. 单个评估轴评分
// ============================================================

export interface AxisScore {
  /** 评估轴名称（来自 ReasoningFrame.evaluationAxes） */
  axisName: string

  /** 分数 0-100 */
  score: number

  /** 语义等级 */
  level: ScoreLevel

  /** 置信度 */
  confidence: Confidence

  /** 得分理由（为什么给这个分数） */
  rationale: string

  /** 数据来源 */
  evidenceSources: string[]
}

// ============================================================
// 4. 完整评分卡
// ============================================================

export interface EvaluationScoreCard {
  candidateId: string
  candidateName: string

  /** 各轴评分 */
  axes: AxisScore[]

  /** 加权总分 0-100 */
  total: number

  /** 总置信度（各轴置信度的加权均值） */
  overallConfidence: Confidence

  /** 评估时间 */
  evaluatedAt: string

  /** 评估所用权重映射 */
  weightMap: Record<string, number>
}

// ============================================================
// 5. 分数等级判定
// ============================================================

export function determineScoreLevel(score: number): ScoreLevel {
  if (score >= 90) return ScoreLevel.EXCELLENT
  if (score >= 75) return ScoreLevel.GOOD
  if (score >= 60) return ScoreLevel.FAIR
  if (score >= 40) return ScoreLevel.POOR
  return ScoreLevel.VERY_POOR
}

// ============================================================
// 6. 计算加权总分
// ============================================================

export function calculateWeightedTotal(
  axes: AxisScore[],
  weightMap: Record<string, number>,
): number {
  let weightedSum = 0
  let totalWeight = 0

  for (const ax of axes) {
    const w = weightMap[ax.axisName] ?? 0
    weightedSum += ax.score * w
    totalWeight += w
  }

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0
}

// ============================================================
// 7. 分数校验
// ============================================================

export function validateScoreCard(card: EvaluationScoreCard): string[] {
  const errors: string[] = []

  if (card.total < 0 || card.total > 100) {
    errors.push(`total ${card.total} 超出 [0, 100] 范围`)
  }

  for (const ax of card.axes) {
    if (ax.score < 0 || ax.score > 100) {
      errors.push(`轴 "${ax.axisName}" 分数 ${ax.score} 超出 [0, 100] 范围`)
    }
  }

  // 检查计算的一致性
  const expected = calculateWeightedTotal(card.axes, card.weightMap)
  if (Math.abs(expected - card.total) > 0.5) {
    errors.push(`加权总分 ${card.total} 与计算结果 ${expected} 不一致（差值 > 0.5）`)
  }

  return errors
}
