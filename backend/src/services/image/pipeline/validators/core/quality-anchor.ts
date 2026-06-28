// ============================================================
// core/quality-anchor.ts
//
// 职责：D1 质量锚点引擎
//   将 validator 的原始分数 → 可人类理解的质量等级
//
// 核心能力：
//   1. 评分等级映射（numeric → ordinal）
//   2. 人类可读的质量描述
//   3. 多维度加权综合评级
//   4. 导演审美偏差可调（未来扩展）
// ============================================================

import { baselineDistance, getAnchors } from './baseline-registry.js'
import type { QualityDomain } from './baseline-registry.js'

// ─── 质量等级 ──────────────────────────────────────────

export type QualityTier = 'REJECT' | 'POOR' | 'ACCEPTABLE' | 'GOOD' | 'EXCELLENT'

export const TIER_THRESHOLDS: Record<QualityTier, { min: number; max: number }> = {
  REJECT:      { min: 0.00, max: 0.29 },
  POOR:        { min: 0.30, max: 0.49 },
  ACCEPTABLE:  { min: 0.50, max: 0.69 },
  GOOD:        { min: 0.70, max: 0.89 },
  EXCELLENT:   { min: 0.90, max: 1.00 },
}

export interface DimensionReport {
  dimension: string
  rawScore: number
  calibratedScore: number
  tier: QualityTier
  label: string          // 人类可读标签（如"优秀正面免冠脸"）
  distance: number       // baseline 距离
  issues: string[]       // 该维度的问题
}

export interface QualityReport {
  /** 综合评分（所有维度校准后的加权平均） */
  overallScore: number
  /** 综合等级 */
  overallTier: QualityTier
  /** 各维度报告 */
  dimensions: DimensionReport[]
  /** 综合评级描述 */
  summary: string
}

// ─── 等级判定 ──────────────────────────────────────────

export function scoreToTier(score: number): QualityTier {
  for (const [tier, range] of Object.entries(TIER_THRESHOLDS)) {
    if (score >= range.min && score <= range.max) {
      return tier as QualityTier
    }
  }
  return 'POOR'
}

export function tierDescription(tier: QualityTier): string {
  switch (tier) {
    case 'REJECT':     return '❌ 不合格 — 需重新生成'
    case 'POOR':       return '⚠️ 较差 — 建议检查参数'
    case 'ACCEPTABLE': return '✅ 可接受 — 可进入下一环节'
    case 'GOOD':       return '⭐ 良好 — 质量高于平均'
    case 'EXCELLENT':  return '🏆 优秀 — 电影级质量'
  }
}

// ─── 锚点匹配描述 ──────────────────────────────────────

/**
 * 将维度分数映射为人类可读的描述标签
 */
export function matchAnchorLabel(
  domain: QualityDomain,
  dimension: string,
  rawScore: number,
  version = '1.0.0',
): { label: string; distance: number; calibrated: number } {
  const anchors = getAnchors(domain, dimension, version)
  const result = baselineDistance(rawScore, anchors)
  const anchor = result.closestAnchor

  return {
    label: anchor?.name ?? 'unknown',
    distance: result.distance,
    calibrated: result.calibrated,
  }
}

// ─── 综合质量报告 ──────────────────────────────────────

export interface QualityAnchorOptions {
  /** 各维度的加权权重（默认为均等权重） */
  weights?: Record<string, number>
  /** 校准基线版本 */
  baselineVersion?: string
}

const DEFAULT_OPTIONS: QualityAnchorOptions = {
  baselineVersion: '1.0.0',
}

/**
 * 从 validator 的多个维度分数生成完整质量报告
 *
 * @param domain      domain 标识
 * @param rawScores   各维度原始分数 { [dimension]: number }
 * @param issues      各维度问题 { [dimension]: string[] }
 * @param options     加权配置
 */
export function generateQualityReport(
  domain: QualityDomain,
  rawScores: Record<string, number>,
  issues: Record<string, string[]>,
  options: QualityAnchorOptions = {},
): QualityReport {
  const cfg = { ...DEFAULT_OPTIONS, ...options }
  const defaultWeight = 1 / Object.keys(rawScores).length
  const weights = cfg.weights ?? {}

  const dimensions: DimensionReport[] = Object.entries(rawScores).map(([dim, rawScore]) => {
    const anchor = matchAnchorLabel(domain, dim, rawScore, cfg.baselineVersion)
    const tier = scoreToTier(anchor.calibrated)

    return {
      dimension: dim,
      rawScore,
      calibratedScore: anchor.calibrated,
      tier,
      label: anchor.label,
      distance: anchor.distance,
      issues: issues[dim] ?? [],
    }
  })

  // 加权综合评分
  let weightedSum = 0
  let weightSum = 0
  for (const dim of dimensions) {
    const w = weights[dim.dimension] ?? defaultWeight
    weightedSum += dim.calibratedScore * w
    weightSum += w
  }
  const overallScore = weightSum > 0 ? weightedSum / weightSum : 0
  const overallTier = scoreToTier(overallScore)

  // 人类可读总结
  const poorDims = dimensions.filter(d => d.tier === 'REJECT' || d.tier === 'POOR')
  const goodDims = dimensions.filter(d => d.tier === 'GOOD' || d.tier === 'EXCELLENT')
  let summary: string
  if (poorDims.length > 0) {
    summary = `${tierDescription(overallTier)}。${poorDims.length} 个维度未达标 (${poorDims.map(d => d.dimension).join(', ')})`
  } else if (goodDims.length === dimensions.length) {
    summary = `${tierDescription(overallTier)}。全部 ${dimensions.length} 个维度表现良好`
  } else {
    summary = `${tierDescription(overallTier)}。${goodDims.length}/${dimensions.length} 维度达标`
  }

  return { overallScore, overallTier, dimensions, summary }
}
