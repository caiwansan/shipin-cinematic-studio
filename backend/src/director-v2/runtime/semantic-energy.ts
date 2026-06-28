/**
 * semantic-energy.ts — Semantic Energy Model
 *
 * Phase 3B — "控制系统"升级为"自适应控制系统"
 *
 * 核心思想：不是所有 drift 都是风险。高表达力场景（情感高潮、节奏加速、
 * 视觉对比强烈）天然就是 "高能状态"，这种状态下的 drift 不应当被干预。
 *
 * 语义能量 Semantic Energy = f(
 *   emotionalIntensity,     // 情感强度
 *   pacingVelocity,          // 节奏变化速率
 *   narrativeTransition,     // 叙事转折等级
 *   visualContrast           // 视觉对比度
 * )
 *
 * 最终效果：
 *   - low energy + high drift → 干预（经典风险）
 *   - high energy + high drift → 可能是创意爆发，暂缓干预
 *   - low energy + low drift  → 稳定，不干预
 *   - high energy + low drift → 高表达但稳定，不干预
 */

import type { StoryConstitution } from '../schema/story-constitution.js'

// ============================================================
// Types
// ============================================================

export interface SemanticEnergyScore {
  /** 总能量值 0-1 */
  total: number
  /** 能量级别 */
  level: 'low' | 'moderate' | 'high' | 'very_high'
  /** 各维度分解 */
  dimensions: EnergyDimension[]
  /** 是否属于 "高表达" 状态（threshold > 0.6） */
  isExpressive: boolean
  /** 简要摘要 */
  summary: string
}

export interface EnergyDimension {
  name: string
  value: number       // 0-1
  weight: number
  detail: string
}

export interface EnergyAwareDriftResult {
  /** 原始 drift overall */
  rawDrift: number
  /** 能量值 */
  energy: number
  /** 能量感知后的有效 drift（drift * (1 - energy * dampeningFactor)） */
  effectiveDrift: number
  /** 是否应该 gate 干预（energy >= threshold） */
  shouldGateIntervention: boolean
  /** gate 强度 0-1 */
  gateStrength: number
}

// ============================================================
// Energy Model
// ============================================================

export class SemanticEnergyModel {
  /** 高能量阈值——高于此值的场景应 gate 干预 */
  private readonly highEnergyThreshold = 0.6
  /** 能量对 drift 的 dampening 系数 */
  private readonly dampeningFactor = 0.7
  /** 各维度的权重配置 */
  private readonly dimensionWeights: Record<string, number> = {
    emotionalIntensity: 0.35,
    pacingVelocity: 0.25,
    narrativeTransition: 0.25,
    visualContrast: 0.15,
  }

  /**
   * 计算 semantic energy
   */
  compute(constitution: StoryConstitution): SemanticEnergyScore {
    const dimensions = this.computeDimensions(constitution)
    const total = this.computeTotal(dimensions)
    const level = this.classifyLevel(total)
    const isExpressive = level === 'high' || level === 'very_high'
    const summary = this.buildSummary(total, level, dimensions)

    return { total, level, dimensions, isExpressive, summary }
  }

  /**
   * 将能量应用于 drift，计算 energy-aware drift
   */
  applyEnergyAwareDrift(
    rawDrift: number,
    energy: SemanticEnergyScore,
  ): EnergyAwareDriftResult {
    // 高表达状态会 dampen drift
    // 公式：effectiveDrift = rawDrift * (1 - energy * dampeningFactor * gateMultiplier)
    const gateMultiplier = energy.isExpressive ? 1.0 : 0.3
    const dampening = energy.total * this.dampeningFactor * gateMultiplier
    const effectiveDrift = Math.max(0, rawDrift * (1 - dampening))
    const shouldGateIntervention = energy.total >= this.highEnergyThreshold
    const gateStrength = Math.round(Math.min(1, energy.total * gateMultiplier) * 100) / 100

    return {
      rawDrift,
      energy: energy.total,
      effectiveDrift: Math.round(effectiveDrift * 100) / 100,
      shouldGateIntervention,
      gateStrength,
    }
  }

  /**
   * 确定是否 gate 干预决策
   * 如果 energy 高且 drift 主要是 creative_variation，gate 干预
   */
  shouldSuppressIntervention(
    drift: number,
    classification: string,
    energy: SemanticEnergyScore,
  ): boolean {
    const energyAware = this.applyEnergyAwareDrift(drift, energy)

    // 只在以下情况 gate：
    // 1. 高能量
    // 2. drift 分类是 creative_variation（不是 structural_break）
    // 3. effectiveDrift 被 dampen 到阈值以下
    return (
      energyAware.shouldGateIntervention &&
      classification === 'creative_variation' &&
      energyAware.effectiveDrift < 0.3
    )
  }

  // ============================================================
  // Private
  // ============================================================

  private computeDimensions(constitution: StoryConstitution): EnergyDimension[] {
    return [
      this.computeEmotionalEnergy(constitution),
      this.computePacingEnergy(constitution),
      this.computeNarrativeEnergy(constitution),
      this.computeVisualEnergy(constitution),
    ]
  }

  private computeEmotionalEnergy(constitution: StoryConstitution): EnergyDimension {
    const emotion = constitution.emotionalTrajectory
    if (!emotion) {
      return { name: 'emotionalIntensity', value: 0.3, weight: this.dimensionWeights.emotionalIntensity, detail: '无情绪数据' }
    }

    const peak = emotion.peakIntensity || 5
    // peak 0-10 → 归一化到 0-1
    const peakEnergy = peak / 10

    // arc type 能量权重
    const arcWeights: Record<string, number> = {
      complex: 0.9,      // 复杂弧线 → 高能量
      'rise_and_fall': 0.8,
      u_shape: 0.7,
      fall_and_rise: 0.7,
      linear: 0.4,
      flat: 0.2,
    }
    const arcEnergy = arcWeights[emotion.arcType || ''] || 0.4

    // 如果 arc 和 peak 不一致，可能是转折点（更高能量）
    const resolutionEnergy = emotion.resolutionTone === '希望' ? 0.6 :
      emotion.resolutionTone === '虚无' ? 0.9 :
      emotion.resolutionTone === '悲剧' ? 0.8 : 0.5

    // 加权
    const value = Math.round(
      (peakEnergy * 0.5 + arcEnergy * 0.3 + resolutionEnergy * 0.2) * 100
    ) / 100

    return {
      name: 'emotionalIntensity',
      value: Math.min(value, 1),
      weight: this.dimensionWeights.emotionalIntensity,
      detail: `peak=${peak} arc=${emotion.arcType || '?'} resolve=${emotion.resolutionTone || '?'}`,
    }
  }

  private computePacingEnergy(constitution: StoryConstitution): EnergyDimension {
    const pacing = constitution.pacingDoctrine
    if (!pacing) {
      return { name: 'pacingVelocity', value: 0.3, weight: this.dimensionWeights.pacingVelocity, detail: '无节奏数据' }
    }

    const curveWeights: Record<string, number> = {
      crescendo: 0.8,    // 渐强 → 高能量
      decrescendo: 0.3,  // 渐弱 → 低能量
      wave: 0.7,         // 波浪 → 中等偏高
      staccato: 0.9,     // 断续 → 高能量（紧张感）
      steady: 0.3,       // 稳定 → 低能量
      accelerating: 0.9, // 加速 → 高能量
    }
    const curveEnergy = curveWeights[pacing.pacingCurve || ''] || 0.5

    const structWeights: Record<string, number> = {
      'three_act': 0.5,
      'five_act': 0.7,
      'non_linear': 0.9,
      'circular': 0.8,
      'episodic': 0.4,
    }
    const structEnergy = structWeights[pacing.structureType || ''] || 0.5

    const value = Math.round((curveEnergy * 0.6 + structEnergy * 0.4) * 100) / 100

    return {
      name: 'pacingVelocity',
      value: Math.min(value, 1),
      weight: this.dimensionWeights.pacingVelocity,
      detail: `curve=${pacing.pacingCurve || '?'} structure=${pacing.structureType || '?'}`,
    }
  }

  private computeNarrativeEnergy(constitution: StoryConstitution): EnergyDimension {
    const emotion = constitution.emotionalTrajectory

    // 从情绪转折推断叙事能量
    if (!emotion) {
      return { name: 'narrativeTransition', value: 0.3, weight: this.dimensionWeights.narrativeTransition, detail: '无数据' }
    }

    // 复杂的 arc 意味着更多转折 → 高能量
    const arcTransitionEnergy: Record<string, number> = {
      complex: 0.9,
      'rise_and_fall': 0.8,
      u_shape: 0.7,
      fall_and_rise: 0.7,
      linear: 0.3,
      flat: 0.1,
    }
    const baseEnergy = arcTransitionEnergy[emotion.arcType || ''] || 0.4

    // 如果 peak intensity 和 resolutionTone 有冲突 → high transition energy
    const hasConflict =
      (emotion.peakIntensity && emotion.peakIntensity >= 8) &&
      emotion.resolutionTone &&
      ['毁灭', '虚无', '悲剧'].includes(emotion.resolutionTone)

    const conflictBonus = hasConflict ? 0.2 : 0

    const value = Math.round(Math.min(baseEnergy + conflictBonus, 1) * 100) / 100

    return {
      name: 'narrativeTransition',
      value,
      weight: this.dimensionWeights.narrativeTransition,
      detail: `arc=${emotion.arcType || '?'} conflict=${hasConflict}`,
    }
  }

  private computeVisualEnergy(constitution: StoryConstitution): EnergyDimension {
    const visual = constitution.visualDoctrine
    if (!visual) {
      return { name: 'visualContrast', value: 0.3, weight: this.dimensionWeights.visualContrast, detail: '无数据' }
    }

    const visualObj = visual as Record<string, unknown>

    // colorPalette 对比度估计
    const palette = String(visualObj.colorPalette || '')
    const highContrastPalettes = ['teal_orange', 'red_blue', 'black_white', 'neon', 'cyan_magenta']
    const lowContrastPalettes = ['monochrome', 'sepia', 'pastel', 'muted', 'cream']
    const veryHighContrastPalettes = ['high_contrast', 'saturated', 'vivid']

    let paletteWeight = 0.5
    if (veryHighContrastPalettes.some(p => palette.includes(p))) paletteWeight = 0.9
    else if (highContrastPalettes.some(p => palette.includes(p))) paletteWeight = 0.7
    else if (lowContrastPalettes.some(p => palette.includes(p))) paletteWeight = 0.3

    // lighting 能量
    const lighting = String(visualObj.lighting || '')
    const lightingWeight =
      lighting.includes('low_key') ? 0.8 :
      lighting.includes('dramatic') ? 0.9 :
      lighting.includes('natural') ? 0.4 :
      lighting.includes('bright') ? 0.3 : 0.5

    const value = Math.round((paletteWeight * 0.5 + lightingWeight * 0.5) * 100) / 100

    return {
      name: 'visualContrast',
      value: Math.min(value, 1),
      weight: this.dimensionWeights.visualContrast,
      detail: `palette=${palette} lighting=${lighting}`,
    }
  }

  private computeTotal(dimensions: EnergyDimension[]): number {
    let total = 0
    for (const dim of dimensions) {
      total += dim.value * dim.weight
    }
    return Math.round(total * 100) / 100
  }

  private classifyLevel(total: number): SemanticEnergyScore['level'] {
    if (total >= 0.8) return 'very_high'
    if (total >= 0.6) return 'high'
    if (total >= 0.4) return 'moderate'
    return 'low'
  }

  private buildSummary(
    total: number,
    level: SemanticEnergyScore['level'],
    dimensions: EnergyDimension[],
  ): string {
    const dimStr = dimensions.map(d => `${d.name}=${d.value}`).join(', ')
    return `${level.toUpperCase()} energy=${total} [${dimStr}]`
  }
}

/** 全局单例 */
export const semanticEnergy = new SemanticEnergyModel()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "director-api",
  "mode": "OBSERVE"
};

