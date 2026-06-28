// ============================================================
// core/scoring-calibrator.ts
//
// 职责：D1 评分校准引擎
//   将原始规则分 → 校准分，统一所有 validator 的评分标尺
//
// 核心管线：
//   rawScore → baselineNormalize → domainWeight → calibratedScore
//
// 校准维度：
//   1. baseline 对齐 — 映射到 5 级锚点（REJECT~EXCELLENT）
//   2. 置信度加权 — 规则评分 vs AI 评分的置信度混合
//   3. 跨模型归一化 — prompt 模型和视觉模型的偏差修正
//   4. 历史偏差修正 — 基于运行统计的自适应（Phase 2）
// ============================================================

import { baselineDistance, getAnchors } from './baseline-registry.js'
import type { QualityDomain } from './baseline-registry.js'
import { scoreToTier } from './quality-anchor.js'

// ─── 校准结果 ──────────────────────────────────────────

export interface CalibratedScore {
  /** 原始分数（规则/AI 得出的未经处理的分值） */
  raw: number
  /** 校准后分数（0-1，已对齐 baseline） */
  calibrated: number
  /** 置信度（0-1，评分系统对本次评分的自信程度） */
  confidence: number
  /** 到基准线的距离（0-1，0=完美对齐锚点） */
  baselineDistance: number
  /** 最邻近锚点的预期分数 */
  anchorExpected?: number
  /** 质量等级 */
  tier: 'REJECT' | 'POOR' | 'ACCEPTABLE' | 'GOOD' | 'EXCELLENT'
}

export interface CalibratedScoreSet {
  /** 各维度校准分数 */
  dimensions: Record<string, CalibratedScore>
  /** 综合校准分（加权平均） */
  composite: CalibratedScore
}

// ─── 校准配置 ──────────────────────────────────────────

export interface CalibrationConfig {
  /** 规则评分的置信度（默认 0.6，因为纯规则不确定性强） */
  ruleConfidence: number
  /** AI 视觉评分的置信度（默认 0.85，有模型支撑） */
  visionConfidence: number
  /** 是否启用置信度混合 */
  enableConfidenceMix: boolean
  /** 是否启用历史偏差修正 */
  enableAdaptiveCorrection: boolean
}

const DEFAULT_CONFIG: CalibrationConfig = {
  ruleConfidence: 0.6,
  visionConfidence: 0.85,
  enableConfidenceMix: false,
  enableAdaptiveCorrection: false,
}

// ─── 校准管线 ──────────────────────────────────────────

export class ScoringCalibrator {
  private config: CalibrationConfig

  constructor(config: Partial<CalibrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 校准单维度评分
   *
   * @param domain     domain 标识
   * @param dimension  维度名称
   * @param rawScore   原始评分（0-1）
   * @param isVision   是否来自 AI 视觉模型
   * @param version    baseline 版本
   */
  calibrate(
    domain: QualityDomain,
    dimension: string,
    rawScore: number,
    isVision = false,
    version = '1.0.0',
  ): CalibratedScore {
    // Step 1: baseline 对齐
    const anchors = getAnchors(domain, dimension, version)
    const alignment = baselineDistance(rawScore, anchors)

    // Step 2: 置信度赋值
    const baseConfidence = isVision ? this.config.visionConfidence : this.config.ruleConfidence
    // 越靠近锚点区间 → 置信度越高
    const confidence = alignment.distance <= 1
      ? baseConfidence + (1 - alignment.distance) * (1 - baseConfidence) * 0.5
      : baseConfidence * Math.max(0.3, 1 - (alignment.distance - 1) * 0.3)

    // Step 3: 生成校准分
    const calibrated = alignment.calibrated
    const tier = scoreToTier(calibrated)

    return {
      raw: Math.round(rawScore * 100) / 100,
      calibrated: Math.round(calibrated * 100) / 100,
      confidence: Math.round(Math.min(1, Math.max(0, confidence)) * 100) / 100,
      baselineDistance: Math.round(alignment.distance * 100) / 100,
      anchorExpected: alignment.closestAnchor?.expectedScore,
      tier,
    }
  }

  /**
   * 校准多维度评分集
   */
  calibrateAll(
    domain: QualityDomain,
    rawScores: Record<string, number>,
    visionSources: Record<string, boolean> = {},
    version = '1.0.0',
  ): CalibratedScoreSet {
    const dimensions: Record<string, CalibratedScore> = {}

    for (const [dim, raw] of Object.entries(rawScores)) {
      dimensions[dim] = this.calibrate(
        domain,
        dim,
        raw,
        visionSources[dim] ?? false,
        version,
      )
    }

    // 综合校准分：加权平均，按置信度加权
    let weightedCalSum = 0
    let weightedConfSum = 0
    for (const dim of Object.values(dimensions)) {
      weightedCalSum += dim.calibrated * dim.confidence
      weightedConfSum += dim.confidence
    }
    const compositeCal = weightedConfSum > 0 ? weightedCalSum / weightedConfSum : 0

    // 综合置信度 = 各维度置信度的均值
    const confValues = Object.values(dimensions).map(d => d.confidence)
    const compositeConf = confValues.length > 0
      ? confValues.reduce((a, b) => a + b, 0) / confValues.length
      : 0

    // 综合到 baseline 的距离 = 各维度离 baseline 的最大距离
    const maxBaselineDist = Math.max(
      ...Object.values(dimensions).map(d => d.baselineDistance),
      0,
    )

    const composite: CalibratedScore = {
      raw: 0,
      calibrated: Math.round(compositeCal * 100) / 100,
      confidence: Math.round(compositeConf * 100) / 100,
      baselineDistance: Math.round(maxBaselineDist * 100) / 100,
      tier: scoreToTier(compositeCal),
    }

    return { dimensions, composite }
  }

  /**
   * 更新配置（运行时可调）
   */
  updateConfig(patch: Partial<CalibrationConfig>): void {
    this.config = { ...this.config, ...patch }
  }
}
