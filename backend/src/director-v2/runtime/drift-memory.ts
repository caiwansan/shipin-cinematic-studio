/**
 * drift-memory.ts — Drift Accumulation & Momentum System
 *
 * Phase 2B 升级：从 stateless classification 到 stateful drift accumulation
 *
 * 核心概念：
 *   1. Drift Memory Graph — 每个维度的历史漂移记录
 *   2. Drift Momentum — 速度 + 加速度 + 趋势预测
 *   3. Semantic Boundary Elasticity — 基于记忆压力的边界软话
 *   4. Creative-to-Structural Transition Detection — 累积风险评估
 *
 * 用法：
 *   const mem = new DriftMemory({ projectId: 'proj_001' })
 *   mem.record(skeleton, enriched, driftResult)
 *   const momentum = mem.getMomentum('theme')
 *   const risk = mem.getAccumulationRisk()
 */

import type { StoryConstitution } from '../schema/story-constitution.js'
import type { DriftScore, DriftClassification } from './drift-scorer.js'

// ============================================================
// Types
// ============================================================

export interface DriftSnapshot {
  timestamp: number      // ms
  run: number            // 序号
  overall: number        // 0-1
  dimensionScores: Record<string, number>
  classification: DriftClassification
  projectId: string
}

export interface DriftHistory {
  snapshots: DriftSnapshot[]
  lastUpdate: number
}

export interface DriftDimensionHistory {
  snapshots: { run: number; delta: number; score: number }[]
  velocity: number        // 最近 N 次变化的平均速度
  acceleration: number    // 速度变化率
  trend: 'stable' | 'increasing' | 'decreasing' | 'accelerating'
}

export interface DriftMomentum {
  dimension: string
  currentScore: number
  velocity: number          // >0 = 向不稳定方向移动
  acceleration: number      // >0.01 = 加速恶化
  trend: 'stable' | 'increasing' | 'decreasing' | 'accelerating'
  projectedScore: number    // 后 N 轮的预测值
  projectedClassification: DriftClassification
  warning: 'none' | 'watch' | 'alert' | 'critical'
}

export interface AccumulationRisk {
  projectId: string
  overallAccumulation: number     // 所有维度的累积压力
  highestRiskDimension: string
  highestRiskScore: number
  transitionRisk: number           // creative→structural 风险 (0-1)
  momentumAlerts: number           // 警报数
  recommendedAction: 'none' | 'recompile_skeleton' | 'tighten_enrichment' | 'reset_accumulation'
}

// ============================================================
// Drift Memory — 核心存储
// ============================================================

export class DriftMemory {
  private stores: Map<string, DriftHistory> = new Map()
  private maxSnapshots: number = 50
  private momentumWindow: number = 5     // 计算 momentum 用的最近 N 次

  /**
   * 记录一次漂移快照
   */
  record(
    projectId: string,
    skeleton: Record<string, unknown>,
    enriched: StoryConstitution,
    drift: DriftScore,
  ): void {
    const key = this.memKey(projectId, enriched.traceId || '')
    let history = this.stores.get(key)
    if (!history) {
      history = { snapshots: [], lastUpdate: 0 }
      this.stores.set(key, history)
    }

    const dimScores: Record<string, number> = {}
    for (const d of drift.dimensions) {
      dimScores[d.name] = d.score
    }

    const snapshot: DriftSnapshot = {
      timestamp: Date.now(),
      run: history.snapshots.length + 1,
      overall: drift.overall,
      dimensionScores: dimScores,
      classification: drift.classification,
      projectId,
    }

    history.snapshots.push(snapshot)
    history.lastUpdate = snapshot.timestamp

    // 裁剪（保留最近 maxSnapshots）
    if (history.snapshots.length > this.maxSnapshots) {
      history.snapshots = history.snapshots.slice(-this.maxSnapshots)
    }
  }

  /**
   * 获取指定维度在项目生命期内的 momentum
   */
  getMomentum(projectId: string, dimension: string): DriftMomentum | null {
    const hist = this.getAllHistory(projectId, dimension)
    if (!hist || hist.length === 0) return null

    const currentScore = hist[hist.length - 1].score
    const { velocity, acceleration } = this.computeMomentum(hist)
    const trend = this.classifyTrend(velocity, acceleration)
    const projectedScore = this.projectNext(hist, velocity, acceleration)
    const projectedClassification = this.projectClassification(projectedScore, dimension)

    const warning = this.classifyWarning(velocity, acceleration, projectedScore)

    return {
      dimension,
      currentScore,
      velocity: Math.round(velocity * 1000) / 1000,
      acceleration: Math.round(acceleration * 1000) / 1000,
      trend,
      projectedScore: Math.round(projectedScore * 100) / 100,
      projectedClassification,
      warning,
    }
  }

  /**
   * 获取项目的整体累积风险
   */
  getAccumulationRisk(projectId: string): AccumulationRisk {
    const dimensions = ['theme', 'tone', 'character', 'emotion', 'genre', 'pacing']
    let highestRiskScore = 0
    let highestRiskDimension = ''
    let momentumAlerts = 0
    let totalPressure = 0

    for (const dim of dimensions) {
      const momentum = this.getMomentum(projectId, dim)
      if (!momentum) continue

      totalPressure += momentum.currentScore

      if (momentum.warning === 'alert' || momentum.warning === 'critical') {
        momentumAlerts++
      }

      // 综合风险：当前得分 × （1 + 速度系数 + 加速度系数）
      const riskScore = momentum.currentScore * (1 + Math.abs(momentum.velocity) + Math.abs(momentum.acceleration) * 2)
      if (riskScore > highestRiskScore) {
        highestRiskScore = Math.round(riskScore * 100) / 100
        highestRiskDimension = dim
      }
    }

    const overallAccumulation = Math.round((totalPressure / dimensions.length) * 100) / 100

    // creative→structural 转移风险
    const transitionRisk = this.computeTransitionRisk(projectId, dimensions)

    // 推荐动作
    const recommendedAction = this.recommendAction(overallAccumulation, momentumAlerts, transitionRisk)

    return {
      projectId,
      overallAccumulation,
      highestRiskDimension,
      highestRiskScore,
      transitionRisk: Math.round(transitionRisk * 100) / 100,
      momentumAlerts,
      recommendedAction,
    }
  }

  /**
   * 清除某个项目的累积记忆
   */
  reset(projectId: string, traceId?: string): void {
    if (traceId) {
      this.stores.delete(this.memKey(projectId, traceId))
    } else {
      // 清除所有涉及该 projectId 的记录
      for (const [key] of this.stores) {
        if (key.startsWith(projectId)) {
          this.stores.delete(key)
        }
      }
    }
  }

  /**
   * 获取原始历史数据（用于调试/可视化）
   */
  getRawHistory(projectId: string, traceId?: string): DriftSnapshot[] {
    const key = traceId ? this.memKey(projectId, traceId) : projectId
    const history = this.stores.get(key)
    return history ? [...history.snapshots] : []
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private memKey(projectId: string, traceId: string): string {
    return traceId ? `${projectId}::${traceId}` : projectId
  }

  private getAllHistory(
    projectId: string,
    dimension: string,
  ): { run: number; delta: number; score: number }[] {
    // 合并 projectId 下的所有 trace 的相同维度数据，按 run 排序
    const all: { run: number; delta: number; score: number }[] = []

    for (const [key, history] of this.stores) {
      if (!key.startsWith(projectId)) continue

      for (const snap of history.snapshots) {
        // skip 第一次（没有 delta 基线）
        if (snap.run <= 0) continue

        const score = snap.dimensionScores[dimension]
        if (score === undefined) continue

        // delta：与上一次的差值（从历史中找前一次的 same dimension 值）
        const prev = history.snapshots
          .filter(s => s.run < snap.run)
          .reverse()
          .find(s => s.dimensionScores[dimension] !== undefined)

        const delta = prev ? score - prev.dimensionScores[dimension] : score

        all.push({ run: snap.run, delta, score })
      }
    }

    return all.sort((a, b) => a.run - b.run)
  }

  private computeMomentum(
    history: { run: number; delta: number; score: number }[],
  ): { velocity: number; acceleration: number } {
    if (history.length < 2) return { velocity: 0, acceleration: 0 }

    const window = history.slice(-this.momentumWindow)
    if (window.length < 2) return { velocity: 0, acceleration: 0 }

    // velocity = 最近的增量平均值
    const deltas = window.slice(1).map((h, i) => h.score - window[i].score)
    const velocity = deltas.reduce((a, b) => a + b, 0) / deltas.length

    // acceleration = 增量的增量
    let acceleration = 0
    if (deltas.length >= 2) {
      const accDeltas = deltas.slice(1).map((d, i) => d - deltas[i])
      acceleration = accDeltas.reduce((a, b) => a + b, 0) / accDeltas.length
    }

    return { velocity, acceleration }
  }

  private classifyTrend(
    velocity: number,
    acceleration: number,
  ): 'stable' | 'increasing' | 'decreasing' | 'accelerating' {
    if (Math.abs(velocity) < 0.001) return 'stable'
    if (velocity > 0 && acceleration > 0.005) return 'accelerating'
    if (velocity > 0) return 'increasing'
    return 'decreasing'
  }

  private projectNext(
    history: { run: number; delta: number; score: number }[],
    velocity: number,
    acceleration: number,
  ): number {
    if (history.length === 0) return 0
    const last = history[history.length - 1].score
    // 预测后 3 轮
    const steps = 3
    let projected = last
    for (let i = 0; i < steps; i++) {
      projected += velocity + acceleration * (i + 1)
    }
    return Math.max(0, Math.min(projected, 1))
  }

  private projectClassification(
    score: number,
    dimension: string,
  ): DriftClassification {
    // 根据维度的默认阈值判断预测后的分类
    const thresholds: Record<string, number> = {
      theme: 0.4, tone: 0.3, character: 0.3,
      emotion: 0.5, genre: 0.3, pacing: 0.4,
    }
    const threshold = thresholds[dimension] || 0.4

    // 接近 threshold 且加速 → structural_break 风险
    if (score >= threshold * 0.8 && score < threshold) return 'creative_variation'
    if (score >= threshold) return 'structural_break'
    return 'creative_variation'
  }

  private classifyWarning(
    velocity: number,
    acceleration: number,
    projectedScore: number,
  ): 'none' | 'watch' | 'alert' | 'critical' {
    if (projectedScore >= 0.7) return 'critical'
    if (projectedScore >= 0.5) return 'alert'
    if (acceleration > 0.01 && velocity > 0) return 'watch'
    if (velocity > 0.005) return 'watch'
    return 'none'
  }

  private computeTransitionRisk(
    projectId: string,
    dimensions: string[],
  ): number {
    // 过渡风险：有多少维度在 5 轮内可能从 creative 变为 structural
    let highRiskDims = 0

    for (const dim of dimensions) {
      const momentum = this.getMomentum(projectId, dim)
      if (!momentum) continue
      if (momentum.warning === 'alert' || momentum.warning === 'critical') {
        highRiskDims++
      }
      // 加速度 > 0 + 累积变异（不是纯结构 break，而是渐变）
      if (
        momentum.acceleration > 0.005 &&
        momentum.currentScore > 0.1 &&
        momentum.currentScore < 0.5
      ) {
        highRiskDims += 0.5
      }
    }

    return Math.min(highRiskDims / dimensions.length, 1)
  }

  private recommendAction(
    overallAccumulation: number,
    momentumAlerts: number,
    transitionRisk: number,
  ): 'none' | 'recompile_skeleton' | 'tighten_enrichment' | 'reset_accumulation' {
    if (transitionRisk > 0.6 || momentumAlerts >= 3) return 'recompile_skeleton'
    if (transitionRisk > 0.3 || momentumAlerts >= 1) return 'tighten_enrichment'
    if (overallAccumulation > 0.4) return 'reset_accumulation'
    return 'none'
  }
}

/** 全局单例 */
export const driftMemory = new DriftMemory()
