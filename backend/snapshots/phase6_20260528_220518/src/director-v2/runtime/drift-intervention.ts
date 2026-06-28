/**
 * drift-intervention.ts — Drift Intervention Engine
 *
 * Phase 3A — Semantic Actuation Layer
 * Phase 3B 集成 — Energy-Aware Intervention Gating
 *
 * 从 "predict drift" 升级到 "prevent drift"：
 * 当 accumulation risk 超过阈值时，自动选择干预策略并执行。
 *
 * Energy-Aware: 高表达力场景（emotion climax, narrative peak）会
 * gate（暂缓）低级别的干预，避免过度阻尼抹平创造力。
 *
 * 干预策略（4 级）：
 *   A. Soft Correction — 仅调整 tone/pacing/emotion 微观偏差
 *   B. Structural Re-anchor — 重置特定字段回到 skeleton 锚点
 *   C. Partial Recompile — 只重新生成受影响的子图
 *   D. Full Re-anchor — 罕见 fallback，整个 constitution 回滚到 skeleton
 *
 * 核心设计原则：
 *   - 干预后必须重新评估 drift（feedback loop）
 *   - 干预必须 preserve creative variation（只修 structural，不动 creative）
 *   - 干预优先级：最小侵入优先
 *   - Energy Gating：high energy + creative_variation → 暂缓干预
 */

import type { StoryConstitution } from '../schema/story-constitution.js'
import type { AccumulationRisk } from './drift-memory.js'
import { semanticEnergy } from './semantic-energy.js'

// ============================================================
// Types
// ============================================================

export type InterventionLevel = 'none' | 'soft_correction' | 'structural_reanchor' | 'partial_recompile' | 'full_reanchor'

export interface InterventionPolicy {
  /** 最小触发阈值 */
  threshold: number
  /** 干预级别 */
  level: InterventionLevel
  /** 策略描述 */
  description: string
  /** 优先级（数字越小越优先） */
  priority: number
}

export interface InterventionDecision {
  applied: boolean
  level: InterventionLevel
  reason: string
  /** 受影响的字段列表（空=全部） */
  affectedFields: string[]
  /** 干预前的 drift 状态 */
  preRisk: AccumulationRisk | null
  /** 时间戳 */
  timestamp: number
}

export interface InterventionResult {
  decision: InterventionDecision
  /** 修正后的 constitution（如果 applicable） */
  corrected: StoryConstitution | null
  /** 修正是否保持 creative_variation */
  preservedCreativity: boolean
}

// ============================================================
// Intervention Policies
// ============================================================

const INTERVENTION_POLICIES: InterventionPolicy[] = [
  {
    threshold: 0.2,
    level: 'soft_correction',
    description: '轻微语义偏离 → tone/pacing/emotion 微观调整',
    priority: 1,
  },
  {
    threshold: 0.4,
    level: 'structural_reanchor',
    description: '多维度偏移 → 特定字段回滚到 skeleton 锚点',
    priority: 2,
  },
  {
    threshold: 0.6,
    level: 'partial_recompile',
    description: '严重累积 → 受影响子图重新生成',
    priority: 3,
  },
  {
    threshold: 0.8,
    level: 'full_reanchor',
    description: '临界状态 → constitution 整体回滚到 skeleton',
    priority: 4,
  },
]

// 需要锚点保护的 skeleton 字段
const SKELETON_INVARIANTS: string[] = [
  'coreTheme',
  'worldPhysics',
  'characterLaws',
  'toneBoundaries',
  'emotionalTrajectory',
  'pacingDoctrine',
]

// ============================================================
// Intervention Engine
// ============================================================

export class DriftInterventionEngine {
  /**
   * Energy 感知：检查是否应该 gate 干预
   * 高表达力 + creative_variation → 暂缓干预
   */
  private energyGating: boolean = true

  /**
   * 启用/禁用 energy gating
   */
  setEnergyGating(enabled: boolean): void {
    this.energyGating = enabled
  }

  /**
   * 评估是否需要干预，以及什么级别的干预
   *
   * Phase 3B: 如果 energy 高且 drift 是 creative_variation，
   * 自动降级干预级别（soft_correction → none, structural_reanchor → soft_correction）
   */
  evaluate(
    risk: AccumulationRisk,
    skeleton: Record<string, unknown>,
    enriched: StoryConstitution,
  ): InterventionDecision {
    const timestamp = Date.now()

    // 根据 transition risk 选择策略
    let level = this.selectIntervention(risk)

    // Phase 3B: Energy-aware gating
    // 如果系统能量高，且 drift 大概率是 creative_variation，降级干预
    if (this.energyGating && level !== 'none' && level !== 'full_reanchor') {
      let classification = 'creative_variation'
      // 从 enriched 的 metadata 推断当前分类（如果没有明确标记，保守假设）
      if ((enriched as any)._lastClassification) {
        classification = (enriched as any)._lastClassification
      }

      // 高 energy + creative_variation → 降级干预
      if (classification === 'creative_variation') {
        const energy = this.computeEnergy(enriched)
        const shouldGate = energy.shouldGateIntervention
        if (shouldGate) {
          // 降级规则：
          //   structural_reanchor → soft_correction
          //   soft_correction → none
          //   partial_recompile → structural_reanchor
          const downgraded = this.downgradeLevel(level)
          level = downgraded
        }
      }
    }

    if (level === 'none') {
      return {
        applied: false,
        level: 'none',
        reason: `transition risk ${risk.transitionRisk.toFixed(2)} < threshold`,
        affectedFields: [],
        preRisk: risk,
        timestamp,
      }
    }

    const affectedFields = this.determineAffectedFields(level, risk, skeleton, enriched)

    return {
      applied: true,
      level,
      reason: this.buildInterventionReason(level, risk, affectedFields),
      affectedFields,
      preRisk: risk,
      timestamp,
    }
  }

  /**
   * 执行干预并生成修正后的 constitution
   */
  apply(
    skeleton: Record<string, unknown>,
    enriched: StoryConstitution,
    decision: InterventionDecision,
  ): InterventionResult {
    if (!decision.applied) {
      return {
        decision,
        corrected: null,
        preservedCreativity: true,
      }
    }

    const corrected = this.correct(skeleton, enriched, decision)
    const preservedCreativity = this.checkPreservedCreativity(enriched, corrected)

    return {
      decision,
      corrected,
      preservedCreativity,
    }
  }

  /**
   * 快速单步：evaluate + apply
   */
  intervene(
    risk: AccumulationRisk,
    skeleton: Record<string, unknown>,
    enriched: StoryConstitution,
  ): InterventionResult {
    const decision = this.evaluate(risk, skeleton, enriched)
    return this.apply(skeleton, enriched, decision)
  }

  /**
   * 能量感知降级：高表达场景暂缓干预
   */
  private computeEnergy(enriched: StoryConstitution): { shouldGateIntervention: boolean } {
    // 计算 energy（从 semantic energy model）
    const energy = semanticEnergy.compute(enriched)
    return { shouldGateIntervention: energy.shouldGateIntervention }
  }

  private downgradeLevel(level: InterventionLevel): InterventionLevel {
    const next: Record<InterventionLevel, InterventionLevel> = {
      'full_reanchor': 'partial_recompile',
      'partial_recompile': 'structural_reanchor',
      'structural_reanchor': 'soft_correction',
      'soft_correction': 'none',
      'none': 'none',
    }
    return next[level] || 'none'
  }

  // ============================================================
  // Strategy Selection
  // ============================================================

  private selectIntervention(risk: AccumulationRisk): InterventionLevel {
    // 先用 momentum alerts 修正阈值
    const effectiveRisk = risk.transitionRisk + (risk.momentumAlerts * 0.1)

    // 匹配策略（优先级从高到低）
    const matched = [...INTERVENTION_POLICIES]
      .reverse() // full_reanchor 优先
      .find(p => effectiveRisk >= p.threshold)

    if (!matched) return 'none'

    // 如果警报数量少但 transition risk 高 → partial_recompile 而不是 full_reanchor
    if (
      matched.level === 'full_reanchor' &&
      risk.momentumAlerts < 3 &&
      risk.highestRiskScore < 0.6
    ) {
      return 'partial_recompile'
    }

    return matched.level
  }

  // ============================================================
  // Field Determination
  // ============================================================

  private determineAffectedFields(
    level: InterventionLevel,
    risk: AccumulationRisk,
    skeleton: Record<string, unknown>,
    enriched: StoryConstitution,
  ): string[] {
    if (level === 'full_reanchor') {
      return [...SKELETON_INVARIANTS]
    }

    if (level === 'soft_correction') {
      // 只修 tone/pacing/emotion（不碰 theme/genre/character）
      return ['toneBoundaries', 'pacingDoctrine', 'emotionalTrajectory']
    }

    // structural_reanchor / partial_recompile
    // 找出高风险维度对应的字段
    const dimToField: Record<string, string> = {
      theme: 'coreTheme',
      tone: 'toneBoundaries',
      character: 'characterLaws',
      emotion: 'emotionalTrajectory',
      genre: 'worldPhysics',
      pacing: 'pacingDoctrine',
    }

    const fields: string[] = []
    const highRiskDims: string[] = []

    // 使用 transition risk 和 highestRiskDimension 来确定受影响的字段
    if (risk.highestRiskScore > 0.3 && risk.highestRiskDimension) {
      highRiskDims.push(risk.highestRiskDimension)
    }

    // 如果 transition risk > 0.3，加入更多维度
    if (risk.transitionRisk > 0.3) {
      highRiskDims.push('tone', 'emotion', 'pacing')
    }

    for (const dim of highRiskDims) {
      const field = dimToField[dim]
      if (field) fields.push(field)
    }

    return fields.length > 0 ? fields : ['toneBoundaries']
  }

  // ============================================================
  // Correction Logic
  // ============================================================

  private correct(
    skeleton: Record<string, unknown>,
    enriched: StoryConstitution,
    decision: InterventionDecision,
  ): StoryConstitution {
    // Start from enriched, override specific fields with skeleton values
    const corrected = { ...enriched }

    for (const field of decision.affectedFields) {
      const skelValue = skeleton[field]

      if (field === 'toneBoundaries' && decision.level === 'soft_correction') {
        // 软修正：保留 enrichment 的维度创意，但限制范围不超出 skeleton
        const skelTones = (skeleton.toneBoundaries as Array<Record<string, unknown>>) || []
        const enrichTones = corrected.toneBoundaries || []
        const skelMap = new Map(skelTones.map(t => [String(t.dimension), t]))

        const clamped: Array<Record<string, unknown>> = enrichTones.map(t => {
          const skel = skelMap.get(String(t.dimension))
          if (!skel) return t

          const softMin = Math.max(Number(skel.min || 0), Number(t.min || 0))
          const softMax = Math.min(Number(skel.max || 10), Number(t.max || 10))

          return {
            ...t,
            min: Math.round(Math.max(softMin, Number(skel.min || 0))),
            max: Math.round(Math.min(softMax, Number(skel.max || 10))),
          }
        })

        corrected.toneBoundaries = clamped
        continue
      }

      if (field === 'emotionalTrajectory' && decision.level === 'soft_correction') {
        // 情绪软修正：保持 arc type，但 clamp dominant emotion 不偏离 skeleton 语义
        const skelEmotion = String((skeleton.emotionalTrajectory as Record<string, unknown>)?.dominantEmotion || '')
        const enrichEmotion = String(enriched.emotionalTrajectory?.dominantEmotion || '')
        // 如果 enrichment 的情绪完全脱离骨架语义，回退到骨架
        if (skelEmotion && enrichEmotion && !enrichEmotion.includes(skelEmotion) && !skelEmotion.includes(enrichEmotion)) {
          corrected.emotionalTrajectory = structuredClone(skeleton.emotionalTrajectory)
        }
        continue
      }

      // 对其他所有字段：直接回退到 skeleton（anchor 行为）
      if (skelValue !== undefined) {
        corrected[field as keyof StoryConstitution] = structuredClone(skelValue) as any
      }
    }

    // 标记干预
    corrected.confidence = Math.min(enriched.confidence || 0.5, 0.8)
    ;(corrected as any)._intervened = true
    ;(corrected as any)._interventionLevel = decision.level
    ;(corrected as any)._interventionTimestamp = decision.timestamp

    return corrected
  }

  // ============================================================
  // Validation
  // ============================================================

  private checkPreservedCreativity(
    original: StoryConstitution,
    corrected: StoryConstitution | null,
  ): boolean {
    if (!corrected) return true

    // 检查 correction 后是否保留了 creative 的 enrichment
    const creativeDimensions = ['visualDoctrine', 'forbiddenStyles', 'cinematicIdentity']
    let preserved = 0

    for (const dim of creativeDimensions) {
      const originalDim = original[dim as keyof StoryConstitution]
      const correctedDim = corrected[dim as keyof StoryConstitution]
      if (JSON.stringify(originalDim) === JSON.stringify(correctedDim)) {
        preserved++
      }
    }

    return preserved >= 2 // 至少保留了 2/3 的创造性
  }

  private buildInterventionReason(
    level: InterventionLevel,
    risk: AccumulationRisk,
    fields: string[],
  ): string {
    const labels: Record<InterventionLevel, string> = {
      none: '无干预',
      soft_correction: '软修正',
      structural_reanchor: '结构性锚定',
      partial_recompile: '局部重新编译',
      full_reanchor: '完全锚定重载',
    }

    return `${labels[level]} intervene on=[${fields.join(', ')}] ` +
      `transition_risk=${risk.transitionRisk.toFixed(2)} ` +
      `momentum_alerts=${risk.momentumAlerts}`
  }
}

const driftDimensions = ['theme', 'tone', 'character', 'emotion', 'genre', 'pacing']

/** 全局单例 */
export const driftIntervention = new DriftInterventionEngine()
