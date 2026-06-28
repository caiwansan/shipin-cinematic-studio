/**
 * cinematic-intent.ts — Cinematic Intent & Global Coherence Layer
 *
 * Phase 4 — Director OS 的语义目标函数
 *
 * 所有下层系统（drift / intervention / energy）都是"局部最优"。
 * 这一层回答：这电影最终要变成什么样？
 *
 * Intent Vector 定义了电影的"理想方向"，Global Coherence
 * 衡量当前状态与意图之间的距离，Trajectory Guard 在系统
 * 偏离轨道时覆盖局部决策。
 *
 * 核心概念：
 *   1. CinematicIntentVector — 导演意图向量的完整定义
 *   2. GlobalCoherence — 当前 constitution vs 意图的相似度
 *   3. TrajectoryGuard — 当 coherence 低于阈值时发出全局警报
 *   4. IntentEvolution — 意图本身可以随项目演化（允许多阶段目标）
 */

import type { StoryConstitution } from '../schema/story-constitution.js'
import type { AccumulationRisk } from './drift-memory.js'

// ============================================================
// Types
// ============================================================

export interface CinematicIntentVector {
  /** 项目唯一标识 */
  projectId: string
  /** 意图版本 */
  version: number
  /** 目标类型—整个电影的终极走向 */
  genreTrajectory: string[]
  /** 情绪终点（最终情绪状态） */
  emotionalDestination: string
  /** 情绪弧线类型偏好 */
  emotionalArcTarget: string
  /** 视觉演化路径—从 start→end 的视觉发展 */
  visualEvolutionPath: string[]
  /** 叙事权重分配 */
  narrativeWeighting: {
    characterDriven: number    // 0-1
    plotDriven: number         // 0-1
    atmosphereDriven: number   // 0-1
    themeDriven: number        // 0-1
  }
  /** 节奏弧线目标 */
  pacingArcTarget: string
  /** 核心主题不变项（绝对不可变） */
  thematicInvariants: string[]
  /** 关键角色不变项 */
  characterInvariants: string[]
  /** 意图置信度（可能随项目演化变化） */
  confidence: number
}

export interface GlobalCoherenceScore {
  /** 总分 0-1 */
  total: number
  /** 各维度评分 */
  dimensions: CoherenceDimension[]
  /** 评级 */
  level: 'ALIGNED' | 'DIVERGING' | 'MISALIGNED' | 'LOST'
  /** 是否低于警报线 */
  isAlert: boolean
}

export interface CoherenceDimension {
  name: string
  score: number       // 0-1
  weight: number
  detail: string
}

export interface TrajectoryAlert {
  triggered: boolean
  level: 'none' | 'warning' | 'critical'
  /** 最低分维度 */
  weakestDimension: string
  weakestScore: number
  /** 建议动作 */
  recommendedAction: 'none' | 'realign_intent' | 'recompile_intent' | 'override_intervention_policy'
  message: string
}

// ============================================================
// Intent & Coherence Engine
// ============================================================

export class CinematicIntentEngine {
  /** 全局连贯性阈值 */
  private readonly alignThreshold = 0.7
  private readonly divergingThreshold = 0.5

  /**
   * 构建初始意图向量（从 constitution 自动推断）
   */
  buildFromConstitution(
    projectId: string,
    constitution: StoryConstitution,
  ): CinematicIntentVector {
    const emotion = constitution.emotionalTrajectory || {}
    const pacing = constitution.pacingDoctrine || {}
    const world = constitution.worldPhysics || {}

    return {
      projectId,
      version: 1,
      genreTrajectory: [world.environmentType || '', world.timePeriod || ''].filter(Boolean),
      emotionalDestination: emotion.resolutionTone || emotion.dominantEmotion || '希望',
      emotionalArcTarget: emotion.arcType || 'complex',
      visualEvolutionPath: [''],
      narrativeWeighting: {
        characterDriven: 0.5,
        plotDriven: 0.3,
        atmosphereDriven: 0.1,
        themeDriven: 0.1,
      },
      pacingArcTarget: pacing.pacingCurve || 'crescendo',
      thematicInvariants: [constitution.coreTheme || ''],
      characterInvariants: (constitution.characterLaws || []).map(c => String(c.characterId || c.name)),
      confidence: 0.8,
    }
  }

  /**
   * 手动构建/更新意图向量
   */
  setIntent(intent: CinematicIntentVector): CinematicIntentVector {
    return { ...intent, version: intent.version + 1 }
  }

  /**
   * 计算当前 constitution 与意图的全局连贯性
   */
  scoreCoherence(
    intent: CinematicIntentVector,
    current: StoryConstitution,
  ): GlobalCoherenceScore {
    const dimensions = this.computeAllCoherence(intent, current)
    const total = this.computeWeightedTotal(dimensions)
    const level = this.classifyCoherence(total)
    const isAlert = level !== 'ALIGNED'

    return { total, dimensions, level, isAlert }
  }

  /**
   * 轨迹守卫：评估是否偏离方向
   */
  evaluateTrajectory(
    intent: CinematicIntentVector,
    current: StoryConstitution,
    risk: AccumulationRisk | null,
  ): TrajectoryAlert {
    const coherence = this.scoreCoherence(intent, current)

    if (coherence.level === 'LOST') {
      return {
        triggered: true,
        level: 'critical',
        weakestDimension: coherence.dimensions.reduce((a, b) => a.score < b.score ? a : b).name,
        weakestScore: coherence.total,
        recommendedAction: 'recompile_intent',
        message: `GLOBAL MISALIGNMENT: coherence=${coherence.total.toFixed(2)}, ${this.buildFailDetail(coherence)}`,
      }
    }

    if (coherence.level === 'MISALIGNED') {
      return {
        triggered: true,
        level: 'warning',
        weakestDimension: coherence.dimensions.reduce((a, b) => a.score < b.score ? a : b).name,
        weakestScore: coherence.total,
        recommendedAction: 'realign_intent',
        message: `SIGNIFICANT DIVERGENCE: coherence=${coherence.total.toFixed(2)}, ${this.buildFailDetail(coherence)}`,
      }
    }

    // 即使 ALIGNED，如果有 accumulation risk 且 coherence 在下降
    if (risk && risk.transitionRisk > 0.3 && coherence.total < this.alignThreshold + 0.1) {
      return {
        triggered: true,
        level: 'warning',
        weakestDimension: coherence.dimensions.reduce((a, b) => a.score < b.score ? a : b).name,
        weakestScore: coherence.total,
        recommendedAction: 'override_intervention_policy',
        message: `EARLY WARNING: coherence=${coherence.total.toFixed(2)} declining with risk=${risk.transitionRisk.toFixed(2)}`,
      }
    }

    return {
      triggered: false,
      level: 'none',
      weakestDimension: '',
      weakestScore: coherence.total,
      recommendedAction: 'none',
      message: `ALIGNED coherence=${coherence.total.toFixed(2)}`,
    }
  }

  // ============================================================
  // Coherence Scorers
  // ============================================================

  private computeAllCoherence(
    intent: CinematicIntentVector,
    current: StoryConstitution,
  ): CoherenceDimension[] {
    const world = current.worldPhysics || {}
    const emotion = current.emotionalTrajectory || {}
    const pacing = current.pacingDoctrine || {}

    return [
      this.scoreGenreCoherence(intent, world),
      this.scoreEmotionCoherence(intent, emotion),
      this.scorePacingCoherence(intent, pacing),
      this.scoreThemeCoherence(intent, current),
      this.scoreCharacterCoherence(intent, current),
    ]
  }

  private scoreGenreCoherence(
    intent: CinematicIntentVector,
    world: Record<string, unknown>,
  ): CoherenceDimension {
    const currentEnv = String(world.environmentType || '').trim()
    const currentPeriod = String(world.timePeriod || '').trim()

    let matches = 0
    if (intent.genreTrajectory.includes(currentEnv)) matches++
    if (intent.genreTrajectory.includes(currentPeriod)) matches++

    const score = intent.genreTrajectory.length > 0
      ? Math.round((matches / Math.max(intent.genreTrajectory.length, 2)) * 100) / 100
      : 0.6

    return {
      name: 'genre',
      score: Math.min(Math.max(score, 0), 1),
      weight: 0.25,
      detail: `intent=[${intent.genreTrajectory.join(',')}] current=${currentEnv}/${currentPeriod}`,
    }
  }

  private scoreEmotionCoherence(
    intent: CinematicIntentVector,
    emotion: Record<string, unknown>,
  ): CoherenceDimension {
    const currentEmotion = String(emotion.resolutionTone || emotion.dominantEmotion || '')

    // emotional destination 匹配
    const destMatch = currentEmotion.toLowerCase().includes(intent.emotionalDestination.toLowerCase()) ||
      intent.emotionalDestination.toLowerCase().includes(currentEmotion.toLowerCase()) ? 1 : 0.3

    // arc type 匹配
    const arcMatch = String(emotion.arcType || '') === intent.emotionalArcTarget ? 1 : 0.5

    const score = destMatch * 0.6 + arcMatch * 0.4

    return {
      name: 'emotion',
      score: Math.round(score * 100) / 100,
      weight: 0.25,
      detail: `dest=${intent.emotionalDestination}(${destMatch.toFixed(1)}) arc=${intent.emotionalArcTarget}(${arcMatch.toFixed(1)})`,
    }
  }

  private scorePacingCoherence(
    intent: CinematicIntentVector,
    pacing: Record<string, unknown>,
  ): CoherenceDimension {
    const currentCurve = String(pacing.pacingCurve || '')
    const curveMatch = currentCurve === intent.pacingArcTarget ? 1 : 0.4

    return {
      name: 'pacing',
      score: curveMatch,
      weight: 0.15,
      detail: `target=${intent.pacingArcTarget} current=${currentCurve}`,
    }
  }

  private scoreThemeCoherence(
    intent: CinematicIntentVector,
    current: StoryConstitution,
  ): CoherenceDimension {
    const currentTheme = String(current.coreTheme || '').toLowerCase()

    let bestMatch = 0
    for (const inv of intent.thematicInvariants) {
      const invLower = inv.toLowerCase()
      if (currentTheme.includes(invLower) || invLower.includes(currentTheme)) {
        bestMatch = Math.max(bestMatch, 1)
      } else {
        // partial match
        const invWords = invLower.split(/[\s,，。]+/).filter(Boolean)
        const currentWords = currentTheme.split(/[\s,，。]+/).filter(Boolean)
        const overlap = invWords.filter(w => currentTheme.includes(w)).length
        bestMatch = Math.max(bestMatch, overlap / Math.max(invWords.length, 1))
      }
    }

    return {
      name: 'theme',
      score: Math.round(Math.min(bestMatch, 1) * 100) / 100,
      weight: 0.2,
      detail: `invariants=${intent.thematicInvariants.length} match=${bestMatch.toFixed(2)}`,
    }
  }

  private scoreCharacterCoherence(
    intent: CinematicIntentVector,
    current: StoryConstitution,
  ): CoherenceDimension {
    const currentChars = (current.characterLaws || []).map(c => String(c.characterId || c.name))
    const currentSet = new Set(currentChars)

    let matchCount = 0
    for (const inv of intent.characterInvariants) {
      if (currentSet.has(inv)) matchCount++
    }

    const score = intent.characterInvariants.length > 0
      ? matchCount / intent.characterInvariants.length
      : 0.5

    return {
      name: 'character',
      score: Math.round(Math.min(score, 1) * 100) / 100,
      weight: 0.15,
      detail: `invariants=${intent.characterInvariants.length} matched=${matchCount}`,
    }
  }

  // ============================================================
  // Utilities
  // ============================================================

  private computeWeightedTotal(dimensions: CoherenceDimension[]): number {
    let total = 0
    let totalWeight = 0
    for (const d of dimensions) {
      total += d.score * d.weight
      totalWeight += d.weight
    }
    return totalWeight > 0
      ? Math.round((total / totalWeight) * 100) / 100
      : 0
  }

  private classifyCoherence(total: number): GlobalCoherenceScore['level'] {
    if (total >= this.alignThreshold) return 'ALIGNED'
    if (total >= this.divergingThreshold) return 'DIVERGING'
    if (total >= 0.3) return 'MISALIGNED'
    return 'LOST'
  }

  private buildFailDetail(coherence: GlobalCoherenceScore): string {
    const worst = coherence.dimensions.reduce((a, b) => a.score < b.score ? a : b)
    return `worst: ${worst.name}=${worst.score.toFixed(2)}`
  }
}

/** 全局单例 */
export const cinematicIntent = new CinematicIntentEngine()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "director-api",
  "mode": "OBSERVE"
};

