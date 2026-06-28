/**
 * p1.8-switch-decision.ts — P1.8 Production Switch Decision Model
 *
 * ═══════════════════════════════════════════════════════════════
 * P1.8 宪法
 *   这个模型不决定任何事。它只输出分数和建议。
 *   最终决策权在陛下手中。
 * ═══════════════════════════════════════════════════════════════
 *
 * 决策公式：
 *   SwitchScore = 0.35 * StructuralGain + 0.40 * PerceptualGain
 *                 + 0.15 * SystemCompatibility - 0.10 * StabilityRisk
 *
 * 决策区间：
 *   ≥ 0.75 且 PerceptualGain > 0 且 StabilityRisk < 0.3 → GO LIVE
 *   0.55 ~ 0.75                                      → HOLD
 *   < 0.55 或 StabilityRisk ≥ 0.3                    → NO GO
 */

import { generateV3HealthReport } from './v3-metrics.service.js'

// ─── 类型定义 ────────────────────────────────────────────────

export interface PerceptualScores {
  emotionStrength: number       // [-2, +2]
  shotDiversity: number         // [-2, +2]
  characterConsistency: number  // [-2, +2]
  sceneCoherence: number        // [-2, +2]
  cinematicQuality: number      // [-2, +2]
}

export interface StabilityMetrics {
  fallbackRate: number          // [0, 1]
  missingFieldRate: number      // [0, 1]
  promptFailureRate: number     // [0, 1]
  schemaDriftCount: number      // 整数
}

export interface P18Input {
  v2VideoUrl?: string
  v3VideoUrl?: string

  fillRate: Record<string, number>
  qualityRate: Record<string, number>
  semanticYield: number        // [0, 100]

  perceptualScores: PerceptualScores
  stabilityMetrics: StabilityMetrics
  systemCompatibilityRate: number  // [0, 1]
}

export interface P18DecisionReport {
  // 输入快照
  inputSummary: {
    scriptCount: number
    avgFillRate: number
    avgQualityRate: number
    semanticYield: number
  }

  // 四个维度评分
  dimensions: {
    structuralGain: number      // [0, 1]
    perceptualGain: number      // [-2, +2]
    stabilityRisk: number       // [0, 1]
    systemCompatibility: number // [0, 1]
  }

  // 最终决策
  switchScore: number           // [0, 1]
  decision: 'GO_LIVE' | 'HOLD' | 'NO_GO'
  reason: string
  warnings: string[]

  // 数据不足标记
  insufficientData: boolean
  timestamp: Date
}

// ─── 权重 ────────────────────────────────────────────────────

const WEIGHTS = {
  structuralGain: 0.35,
  perceptualGain: 0.40,
  systemCompatibility: 0.15,
  stabilityRisk: -0.10,
}

// ─── 核心函数 ────────────────────────────────────────────────

/**
 * 计算 Structural Gain（结构收益）
 *
 * SG = weighted(Fill, Quality, Yield)
 *   fillWeight = 0.3
 *   qualityWeight = 0.3
 *   yieldWeight = 0.4
 */
function computeStructuralGain(input: P18Input): number {
  const avgFill = Object.values(input.fillRate).reduce((s, v) => s + v, 0) / Math.max(Object.keys(input.fillRate).length, 1)
  const avgQuality = Object.values(input.qualityRate).reduce((s, v) => s + v, 0) / Math.max(Object.keys(input.qualityRate).length, 1)
  const yieldNorm = input.semanticYield / 100

  const sg = 0.3 * (avgFill / 100) + 0.3 * (avgQuality / 100) + 0.4 * yieldNorm

  // clamp to [0, 1]
  return Math.max(0, Math.min(1, sg))
}

/**
 * 计算 Perceptual Gain（感知收益）
 *
 * PG = avg(emotion, shotDiversity, consistency, coherence, cinematic)
 * 将 [-2, +2] 映射到 [0, 1] 用于加权计算
 *
 * PG_norm = (PG + 2) / 4   → 映射到 [0, 1]
 * PG_sign = PG              → 保留正负号用于决策条件
 */
function computePerceptualGain(scores: PerceptualScores): { raw: number; norm: number } {
  const values = [
    scores.emotionStrength,
    scores.shotDiversity,
    scores.characterConsistency,
    scores.sceneCoherence,
    scores.cinematicQuality,
  ]
  const raw = values.reduce((s, v) => s + v, 0) / values.length

  // 如果全是 0（未评分），视为无法判断
  if (values.every(v => v === 0)) return { raw: 0, norm: 0.5 }

  // 映射到 [0, 1]
  const norm = (raw + 2) / 4
  return { raw: Math.max(-2, Math.min(2, raw)), norm: Math.max(0, Math.min(1, norm)) }
}

/**
 * 计算 Stability Risk（稳定性风险）
 *
 * SR = max(fallback, missing, failure)  — 取最高风险
 * 如果任一 > 阈值，整体风险高
 */
function computeStabilityRisk(stability: StabilityMetrics): number {
  const risks = [
    stability.fallbackRate,
    stability.missingFieldRate,
    stability.promptFailureRate,
  ]
  // 取最高单项风险 + schemaDrift 惩罚
  const maxRisk = Math.max(...risks, 0)
  const driftPenalty = Math.min(stability.schemaDriftCount * 0.1, 0.5)
  return Math.max(0, Math.min(1, maxRisk + driftPenalty))
}

/**
 * 生产切换决策主入口。
 */
export async function evaluateProductionSwitch(input: P18Input): Promise<P18DecisionReport> {
  // 检查数据是否充足
  const hasV3Metrics = Object.keys(input.fillRate).length > 0
  const hasPerceptualScores = Object.values(input.perceptualScores).some(v => v !== 0)
  const insufficientData = !hasV3Metrics || !hasPerceptualScores

  if (insufficientData) {
    return {
      inputSummary: {
        scriptCount: 0,
        avgFillRate: 0,
        avgQualityRate: 0,
        semanticYield: input.semanticYield || 0,
      },
      dimensions: { structuralGain: 0, perceptualGain: 0, stabilityRisk: 0, systemCompatibility: 0 },
      switchScore: 0,
      decision: 'HOLD',
      reason: '数据不足——需要 V3 指标数据和 Perceptual 评分。请等待 100 样本完成。',
      warnings: ['insufficient data'],
      insufficientData: true,
      timestamp: new Date(),
    }
  }

  // 四个维度
  const structuralGain = computeStructuralGain(input)
  const { raw: perceptualGainRaw, norm: perceptualGainNorm } = computePerceptualGain(input.perceptualScores)
  const stabilityRisk = computeStabilityRisk(input.stabilityMetrics)
  const systemCompatibility = Math.max(0, Math.min(1, input.systemCompatibilityRate))

  // 决策评分
  const switchScore =
    WEIGHTS.structuralGain * structuralGain +
    WEIGHTS.perceptualGain * perceptualGainNorm +
    WEIGHTS.systemCompatibility * systemCompatibility +
    WEIGHTS.stabilityRisk * stabilityRisk  // 负权重

  // 输入摘要
  const fillValues = Object.values(input.fillRate)
  const qualityValues = Object.values(input.qualityRate)
  const inputSummary = {
    scriptCount: fillValues.length ? Math.round(Object.keys(input.fillRate).length * 2) : 0, // approx
    avgFillRate: fillValues.length ? fillValues.reduce((s, v) => s + v, 0) / fillValues.length : 0,
    avgQualityRate: qualityValues.length ? qualityValues.reduce((s, v) => s + v, 0) / qualityValues.length : 0,
    semanticYield: input.semanticYield,
  }

  // 决策逻辑
  const goLiveConditions =
    switchScore >= 0.75 &&
    perceptualGainRaw > 0 &&
    stabilityRisk < 0.3

  const noGoConditions =
    switchScore < 0.55 || stabilityRisk >= 0.3

  const warnings: string[] = []
  if (perceptualGainRaw <= 0) warnings.push('🔶 感知收益非正——V3 视频在用户观感上未优于 V2')
  if (stabilityRisk >= 0.3) warnings.push('🔶 稳定性风险过高——生产链路可能不可靠')
  if (structuralGain < 0.5) warnings.push('🔶 结构收益偏低——V3 字段利用率不够')
  if (systemCompatibility < 0.8) warnings.push('🔶 系统兼容性不足——仍存在 V2-only pipeline')
  if (perceptualGainRaw > 0 && perceptualGainRaw < 0.5) warnings.push('ℹ️ 感知收益为正但微弱——建议再积累更多样本')

  let decision: P18DecisionReport['decision']
  let reason: string

  if (noGoConditions) {
    decision = 'NO_GO'
    reason = stabilityRisk >= 0.3
      ? `稳定性风险(${(stabilityRisk * 100).toFixed(0)}%) ≥ 30% 阈值，禁止切换生产路径。`
      : `SwitchScore(${switchScore.toFixed(3)}) < 0.55，不满足切换门槛。`
  } else if (goLiveConditions) {
    decision = 'GO_LIVE'
    reason = `V3 在所有维度上满足生产切换要求。结构收益 ${(structuralGain * 100).toFixed(0)}%，` +
      `感知收益 ${perceptualGainRaw.toFixed(2)}，稳定性风险 ${(stabilityRisk * 100).toFixed(0)}%。`
  } else {
    decision = 'HOLD'
    reason = `SwitchScore(${switchScore.toFixed(3)}) 在观测区间 [0.55, 0.75) 内。`
    if (perceptualGainRaw > 0) reason += ' 感知收益为正，但综合评分未达到切换阈值。'
    if (stabilityRisk >= 0.2) reason += ` 稳定性风险(${(stabilityRisk * 100).toFixed(0)}%) 处于中等水平。`
    reason += ' 建议继续双轨并行，积累更多样本。'
  }

  return {
    inputSummary,
    dimensions: {
      structuralGain: Math.round(structuralGain * 1000) / 1000,
      perceptualGain: Math.round(perceptualGainRaw * 1000) / 1000,
      stabilityRisk: Math.round(stabilityRisk * 1000) / 1000,
      systemCompatibility: Math.round(systemCompatibility * 1000) / 1000,
    },
    switchScore: Math.round(switchScore * 1000) / 1000,
    decision,
    reason,
    warnings,
    insufficientData: false,
    timestamp: new Date(),
  }
}
