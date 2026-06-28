/**
 * drift-detector.ts — Phase A-3.2 Reality Grounding Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * DriftDetector — 偏差检测器
 * ═══════════════════════════════════════════════════════════════
 *
 * 核心功能：
 *   计算"系统评分"与"现实基线"之间的偏差度
 *
 * Drift Score（偏差分数）定义：
 *   drift = |systemScore - realityBaseline| / realityBaseline
 *   范围 [0, +∞)，趋近 0 表示与现实一致
 *
 * Drift Level（偏差等级）：
 *   GREEN  (< 0.05)    安全
 *   YELLOW (< 0.15)    预警
 *   ORANGE (< 0.30)    可疑
 *   RED    (>= 0.30)   严重偏离
 *
 * 关键约束：
 *   - 此层不修改评分，只检测偏差
 *   - 偏差检测必须确定性（相同输入产出相同输出）
 *   - 偏差等级用于下游报告/路由，非引擎自身
 */

// ============================================================
// 1. 偏差等级
// ============================================================

export enum DriftLevel {
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  ORANGE = 'ORANGE',
  RED = 'RED',
}

// ============================================================
// 2. 偏差评估结果
// ============================================================

export interface DriftAssessment {
  /** 系统评分 */
  systemScore: number

  /** 现实基线值 */
  baselineValue: number

  /** 绝对偏差 = |系统评分 - 基线| */
  absoluteDrift: number

  /** 相对偏差 = 绝对偏差 / 基线 */
  relativeDrift: number

  /** 偏差等级 */
  level: DriftLevel

  /** 是否显著偏离（level >= ORANGE） */
  isSignificant: boolean

  /** 信号来源名称 */
  signalName: string

  /** 信号可信度权重 */
  signalReliability: number
}

// ============================================================
// 3. 偏差检测器
// ============================================================

export function assessDrift(params: {
  systemScore: number
  baselineValue: number
  signalName: string
  signalReliability: number
}): DriftAssessment {
  const { systemScore, baselineValue, signalName, signalReliability } = params

  const absoluteDrift = Math.abs(systemScore - baselineValue)
  const relativeDrift = baselineValue === 0
    ? absoluteDrift // 基线为 0 时退化为绝对值
    : absoluteDrift / Math.abs(baselineValue)

  const level = classifyDriftLevel(relativeDrift)

  return {
    systemScore,
    baselineValue,
    absoluteDrift,
    relativeDrift,
    level,
    isSignificant: level === DriftLevel.ORANGE || level === DriftLevel.RED,
    signalName,
    signalReliability,
  }
}

// ============================================================
// 4. 偏差等级分类（确定性函数）
// ============================================================

export function classifyDriftLevel(relativeDrift: number): DriftLevel {
  if (relativeDrift < 0.05) return DriftLevel.GREEN
  if (relativeDrift < 0.15) return DriftLevel.YELLOW
  if (relativeDrift < 0.30) return DriftLevel.ORANGE
  return DriftLevel.RED
}

// ============================================================
// 5. 多信号聚合偏差评估
// ============================================================

export interface AggregatedDrift {
  /** 参与评估的信号数量 */
  signalCount: number

  /** 平均相对偏差 */
  averageRelativeDrift: number

  /** 最高偏差 */
  maxRelativeDrift: number

  /** 加权平均偏差（按信号可信度加权） */
  weightedAverageDrift: number

  /** 全局偏差等级 */
  overallLevel: DriftLevel

  /** 各信号评估明细 */
  assessments: DriftAssessment[]
}

/**
 * 对多信号聚合评估整体偏差
 *
 * 输入：多个信号与对应的系统评分
 * 输出：聚合偏差汇总
 *
 * 约束：
 *   - 空信号列表返回 GREEN
 *   - 加权平均 = Σ(relativeDrift × reliability) / Σ(reliability)
 */
export function aggregateDrifts(assessments: DriftAssessment[]): AggregatedDrift {
  if (assessments.length === 0) {
    return {
      signalCount: 0,
      averageRelativeDrift: 0,
      maxRelativeDrift: 0,
      weightedAverageDrift: 0,
      overallLevel: DriftLevel.GREEN,
      assessments: [],
    }
  }

  const count = assessments.length
  const sumRelative = assessments.reduce((s, a) => s + a.relativeDrift, 0)
  const maxRelative = Math.max(...assessments.map(a => a.relativeDrift))
  const weightedSum = assessments.reduce((s, a) => s + a.relativeDrift * a.signalReliability, 0)
  const totalWeight = assessments.reduce((s, a) => s + a.signalReliability, 0)
  const weightedAvg = totalWeight > 0 ? weightedSum / totalWeight : 0

  return {
    signalCount: count,
    averageRelativeDrift: count > 0 ? sumRelative / count : 0,
    maxRelativeDrift: maxRelative,
    weightedAverageDrift: weightedAvg,
    overallLevel: classifyDriftLevel(weightedAvg),
    assessments,
  }
}
