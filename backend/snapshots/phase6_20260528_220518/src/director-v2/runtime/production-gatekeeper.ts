/**
 * production-gatekeeper.ts — Phase 5D: Production Readiness Decision Layer
 *
 * 回答一个问题：这个系统现在是否可以开放给真实用户？
 *
 * 三个信号源：
 *   1. Kernel Stability Signal — 系统在自我修复还是持续扰动
 *   2. Projection Fidelity Signal — 用户看到的世界是否可靠
 *   3. Control Pressure Signal — 系统是否过度依赖修复机制
 *
 * 合成决策函数：Production Readiness Score (PRS)
 *   PRS = f(kernelStability, projectionFidelity, controlPressure, energyBalance, intentCoherence)
 *
 * 输出 READY / CAUTION / NOT_READY，并附带可执行的解锁策略。
 */

import type { ShadowSummary, DivergenceMetric } from './shadow-ui-router.js'
import type { CinematicIntentVector } from './cinematic-intent.js'
import type { StoryConstitution } from '../schema/story-constitution.js'

// ============================================================
// Types
// ============================================================

export type ProductionStatus = 'READY' | 'CAUTION' | 'NOT_READY'

export type RolloutStage = 'locked' | 'shadow_only' | 'canary' | 'partial' | 'full'

export interface ProductionReadinessScore {
  /** 总分 0-1 */
  score: number
  /** 状态 */
  status: ProductionStatus
  /** 当前建议的发布阶段 */
  rolloutStage: RolloutStage
  /** 阻止上线的因素 */
  blockers: Blocker[]
  /** 每个信号的分解 */
  signals: SignalBreakdown
  /** 人可读的最终裁决解释 */
  verdictExplanation: string
  /** 推荐的解锁步骤（如果当前状态不允许 full production） */
  unlockPath: UnlockStep[]
}

export interface Blocker {
  name: string
  severity: 'critical' | 'warning' | 'info'
  signal: 'kernel' | 'fidelity' | 'control' | 'energy' | 'intent'
  detail: string
}

export interface SignalBreakdown {
  kernelStability: number
  projectionFidelity: number
  controlPressure: number
  energyBalance: number
  intentCoherence: number
}

export interface UnlockStep {
  stage: RolloutStage
  requiredScore: number
  description: string
}

// ============================================================
// Gatekeeper
// ============================================================

const STAGE_THRESHOLDS: { stage: RolloutStage; minScore: number }[] = [
  { stage: 'shadow_only', minScore: 0 },
  { stage: 'canary', minScore: 0.4 },
  { stage: 'partial', minScore: 0.65 },
  { stage: 'full', minScore: 0.85 },
]

export class ProductionGatekeeper {
  /**
   * 评估系统是否就绪
   */
  evaluate(
    shadowSummary: ShadowSummary,
    history?: {
      drifts: number[]
      interventions: number[]
      reanchors: number[]
    },
  ): ProductionReadinessScore {
    const blockers: Blocker[] = []

    // 1. Kernel Stability Signal
    const kernelStability = this.evaluateKernelStability(shadowSummary, history, blockers)

    // 2. Projection Fidelity Signal
    const projectionFidelity = this.evaluateProjectionFidelity(shadowSummary, blockers)

    // 3. Control Pressure Signal
    const controlPressure = this.evaluateControlPressure(shadowSummary, history, blockers)

    // 4. Energy Balance
    const energyBalance = this.evaluateEnergyBalance(blockers)

    // 5. Intent Coherence
    const intentCoherence = this.evaluateIntentCoherence(shadowSummary, blockers)

    // 合成 PRS
    const signals: SignalBreakdown = {
      kernelStability,
      projectionFidelity,
      controlPressure,
      energyBalance,
      intentCoherence,
    }

    const score = this.computePRS(signals)
    const status = this.classifyStatus(score, blockers)
    const rolloutStage = this.determineRolloutStage(score, status)
    const unlockPath = this.buildUnlockPath(score, blockers)

    const verdictExplanation = this.buildVerdictExplanation(score, status, blockers)

    return {
      score,
      status,
      rolloutStage,
      blockers,
      signals,
      verdictExplanation,
      unlockPath,
    }
  }

  // ============================================================
  // Signal Evaluators
  // ============================================================

  private evaluateKernelStability(
    summary: ShadowSummary,
    history?: { drifts: number[]; interventions: number[]; reanchors: number[] },
    blockers?: Blocker[],
  ): number {
    if (!history) {
      // No history → insufficient data, conservative score
      return 0.4
    }

    const { drifts, interventions, reanchors } = history

    // 1. Drift trend: 漂移是在收敛还是发散
    const driftTrend = this.computeTrend(drifts)
    if (driftTrend > 0.3) {
      blockers?.push({
        name: 'increasing_drift_trend',
        severity: 'warning',
        signal: 'kernel',
        detail: `Drift trend is increasing (${driftTrend.toFixed(2)}). System may be in continuous perturbation.`,
      })
    }

    // 2. Intervention frequency: 修复频率
    const avgInterventions = interventions.length > 0
      ? interventions.reduce((a, b) => a + b, 0) / interventions.length
      : 0
    if (avgInterventions > 0.5) {
      blockers?.push({
        name: 'high_intervention_rate',
        severity: 'warning',
        signal: 'kernel',
        detail: `Average intervention frequency ${(avgInterventions * 100).toFixed(0)}%. System oscillating.`,
      })
    }

    // 3. Re-anchor rate: 硬修复比例
    const reanchorRate = reanchors.length > 0
      ? reanchors.reduce((a, b) => a + b, 0) / reanchors.length
      : 0
    if (reanchorRate > 0.3) {
      blockers?.push({
        name: 'high_reanchor_rate',
        severity: 'critical',
        signal: 'kernel',
        detail: `Re-anchor rate ${(reanchorRate * 100).toFixed(0)}%. System cannot self-stabilize.`,
      })
    }

    // 计算综合分数
    const trendScore = Math.max(0, 1 - driftTrend * 2)
    const interventionScore = Math.max(0, 1 - avgInterventions)
    const reanchorScore = Math.max(0, 1 - reanchorRate * 2.5)

    return (trendScore + interventionScore + reanchorScore) / 3
  }

  private evaluateProjectionFidelity(
    summary: ShadowSummary,
    blockers?: Blocker[],
  ): number {
    if (summary.totalRequests === 0) {
      return 0.3 // No data → low confidence
    }

    // Divergence metrics → fidelity score
    let totalDivergence = 0
    let totalWeight = 0

    for (const d of summary.divergences) {
      const weight = this.divergenceWeight(d.name)
      totalDivergence += d.divergence * weight
      totalWeight += weight
    }

    const avgDivergence = totalWeight > 0 ? totalDivergence / totalWeight : 0

    if (avgDivergence > 0.5) {
      blockers?.push({
        name: 'high_ui_kernel_divergence',
        severity: 'critical',
        signal: 'fidelity',
        detail: `Average projection divergence ${(avgDivergence * 100).toFixed(0)}%. UI view is unreliable.`,
      })
    }

    // 检查是否有 blocked mutations
    if (summary.blockedMutations > 2) {
      blockers?.push({
        name: 'frequent_mutation_attempts',
        severity: 'warning',
        signal: 'fidelity',
        detail: `${summary.blockedMutations} mutation(s) blocked. UI may be attempting to override kernel.`,
      })
    }

    return Math.max(0, 1 - avgDivergence)
  }

  private evaluateControlPressure(
    summary: ShadowSummary,
    history?: { drifts: number[]; interventions: number[]; reanchors: number[] },
    blockers?: Blocker[],
  ): number {
    if (!history) return 0.5 // No data, default to moderate

    const totalMutations = summary.blockedMutations
    const totalInterventions = history.interventions.reduce((a, b) => a + b, 0)
    const totalReanchors = history.reanchors.reduce((a, b) => a + b, 0)

    // 综合控制压力
    const pressure = (totalInterventions * 0.4 + totalReanchors * 0.6) /
      Math.max(history.interventions.length + history.reanchors.length, 1)

    // Mutation attempts add pressure
    const mutationPressure = Math.min(1, totalMutations * 0.15)

    if (mutationPressure > 0.5) {
      blockers?.push({
        name: 'high_mutation_pressure',
        severity: 'warning',
        signal: 'control',
        detail: `UI mutation pressure ${(mutationPressure * 100).toFixed(0)}%. Feedback loop risk.`,
      })
    }

    if (pressure > 0.6) {
      blockers?.push({
        name: 'excessive_control_usage',
        severity: 'warning',
        signal: 'control',
        detail: `System executing interventions at ${(pressure * 100).toFixed(0)}% capacity. Over-relying on repair.`,
      })
    }

    const controlScore = Math.max(0, 1 - pressure)
    const mutationScore = Math.max(0, 1 - mutationPressure)

    return (controlScore + mutationScore) / 2
  }

  private evaluateEnergyBalance(blockers?: Blocker[]): number {
    // Energy balance 评估系统是否在"表达"和"稳定"之间健康运行
    // 由于当前没有累积的能量历史，使用保守默认值
    // 未来可以从 semantic-energy 的历史数据中提取
    return 0.8
  }

  private evaluateIntentCoherence(
    summary: ShadowSummary,
    blockers?: Blocker[],
  ): number {
    if (summary.divergences.length === 0) return 0.5

    // 从 divergence metrics 中提取 intent 相关的
    const intentMetrics = summary.divergences.filter(d =>
      ['theme_drift', 'emotion_drift', 'scene_structure'].includes(d.name),
    )

    if (intentMetrics.length === 0) return 0.7

    const avgIntentDiv = intentMetrics.reduce((a, b) => a + b.divergence, 0) / intentMetrics.length

    if (avgIntentDiv > 0.5) {
      blockers?.push({
        name: 'intent_divergence',
        severity: 'critical',
        signal: 'intent',
        detail: `Intent coherence divergence ${(avgIntentDiv * 100).toFixed(0)}%. Projection may not reflect true intent.`,
      })
    }

    return Math.max(0, 1 - avgIntentDiv)
  }

  // ============================================================
  // Decision Functions
  // ============================================================

  private computePRS(signals: SignalBreakdown): number {
    // 加权合成
    const weights = {
      kernelStability: 0.30,
      projectionFidelity: 0.30,
      controlPressure: 0.15,
      energyBalance: 0.10,
      intentCoherence: 0.15,
    }

    const score =
      signals.kernelStability * weights.kernelStability +
      signals.projectionFidelity * weights.projectionFidelity +
      signals.controlPressure * weights.controlPressure +
      signals.energyBalance * weights.energyBalance +
      signals.intentCoherence * weights.intentCoherence

    return Math.round(Math.min(Math.max(score, 0), 1) * 1000) / 1000
  }

  private classifyStatus(score: number, blockers: Blocker[]): ProductionStatus {
    // Critical blockers override score
    const hasCriticalBlocker = blockers.some(b => b.severity === 'critical')
    if (hasCriticalBlocker) return 'NOT_READY'

    if (score >= 0.75) return 'READY'
    if (score >= 0.45) return 'CAUTION'
    return 'NOT_READY'
  }

  private determineRolloutStage(
    score: number,
    status: ProductionStatus,
  ): RolloutStage {
    if (status === 'NOT_READY') return 'shadow_only'

    // Find the highest stage that the score qualifies for
    let stage: RolloutStage = 'shadow_only'
    for (const t of STAGE_THRESHOLDS) {
      if (score >= t.minScore) {
        stage = t.stage
      }
    }
    return stage
  }

  private buildUnlockPath(
    currentScore: number,
    blockers: Blocker[],
  ): UnlockStep[] {
    const currentStage = this.determineRolloutStage(currentScore, this.classifyStatus(currentScore, blockers))
    const currentIndex = STAGE_THRESHOLDS.findIndex(t => t.stage === currentStage)
    const criticalBlockers = blockers.filter(b => b.severity === 'critical')

    return STAGE_THRESHOLDS
      .filter((_, i) => i > currentIndex)
      .map(t => ({
        stage: t.stage,
        requiredScore: t.minScore,
        description: this.buildStageDescription(t.stage, criticalBlockers),
      }))
  }

  private buildVerdictExplanation(
    score: number,
    status: ProductionStatus,
    blockers: Blocker[],
  ): string {
    const lines: string[] = [
      `Production Readiness Score: ${(score * 100).toFixed(0)}%`,
      `Status: ${status}`,
    ]

    if (blockers.length === 0 && status === 'READY') {
      lines.push('No blockers detected. System is stable, projection is faithful, control is balanced.')
      lines.push('Full production rollout is recommended.')
    } else if (blockers.length === 0 && status === 'CAUTION') {
      lines.push('No specific blockers, but overall score is below threshold. More shadow testing recommended.')
    } else {
      lines.push(`Blockers: ${blockers.length}`)
      for (const b of blockers) {
        lines.push(`  [${b.severity.toUpperCase()}] ${b.signal}: ${b.detail}`)
      }
    }

    return lines.join('\n')
  }

  private buildStageDescription(
    stage: RolloutStage,
    criticalBlockers: Blocker[],
  ): string {
    switch (stage) {
      case 'shadow_only':
        return 'System locked to shadow mode. No user-facing exposure.'
      case 'canary':
        return criticalBlockers.length > 0
          ? 'Canary stage blocked by: ' + criticalBlockers.map(b => b.name).join(', ')
          : 'Limited to internal test users.'
      case 'partial':
        return 'Gradual rollout to real users, with divergence monitoring active.'
      case 'full':
        return 'Full production. System healthy, stable, and verified.'
    }
  }

  // ============================================================
  // Utilities
  // ============================================================

  private computeTrend(values: number[]): number {
    if (values.length < 3) return 0
    // Simple linear regression slope as trend indicator
    const n = values.length
    const xs = values.map((_, i) => i)
    const xMean = xs.reduce((a, b) => a + b, 0) / n
    const yMean = values.reduce((a, b) => a + b, 0) / n

    let numerator = 0
    let denominator = 0
    for (let i = 0; i < n; i++) {
      numerator += (xs[i] - xMean) * (values[i] - yMean)
      denominator += (xs[i] - xMean) ** 2
    }

    if (denominator === 0) return 0
    const slope = numerator / denominator
    return Math.max(0, Math.min(1, Math.abs(slope)))
  }

  private divergenceWeight(name: string): number {
    const weights: Record<string, number> = {
      theme_drift: 0.35,
      emotion_drift: 0.25,
      character_count: 0.15,
      scene_structure: 0.25,
    }
    return weights[name] || 0.2
  }
}

/** 全局单例 */
export const productionGatekeeper = new ProductionGatekeeper()
