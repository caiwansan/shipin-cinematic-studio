// ============================================================
// decision/intent-phase-portrait.ts
//
// 职责：Intent Phase Portrait（意图相位图谱）
//   将 IDF 的时序观测数据投影到语义相位空间，
//   回答「这个系统在时间中是什么形状」
//
// 核心思想：
//   相位空间中的每个点 = (DSB稳定性, 意图置信度, 冲突尺度)
//   时间轴上的连续点构成相位轨迹（phase trajectory）
//   系统越稳定 → 相位轨迹越收敛于小区域
//   系统不稳定 → 相位轨迹扩散/跳跃
//
// 设计原则：
//   - 纯投影层（只消费 IDF snapshot 数据，不依赖 DIE/DCVL/DSB）
//   - 不产生新指标（只重组已有指标为相位坐标）
//   - 不设置阈值（人类观察者判断轨迹形态）
// ============================================================

import type { IntentFieldSnapshot } from './intent-stability-field.js'
import type { IntentType } from './director-intent-engine.js'

// ─── 相位投影 ──────────────────────────────────────────

/** 语义相位坐标 */
export interface PhaseCoordinate {
  /** 稳定性轴 x: DSB 稳定分 (0-1) */
  stability: number
  /** 意图轴 y: 意图置信度 (0-1) */
  intentConfidence: number
  /** 冲突轴 z: DCVL 分歧率 (0-1) */
  conflictIntensity: number
}

/** 相位投影 */
export interface PhaseProjection {
  /** 当前相位坐标 */
  current: PhaseCoordinate
  /** 历史相位坐标（时间序列） */
  history: PhaseCoordinate[]
  /** 时间戳 */
  timestamp: string
}

// ─── 相位轨迹分析 ──────────────────────────────────────

export interface PhaseTrajectory {
  /** 总投影点数 */
  totalPoints: number
  /** 轨迹中心（所有 points 均值） */
  centroid: PhaseCoordinate
  /** 轨迹扩散半径（各点到中心的最大距离） */
  spreadRadius: number
  /** 末端收敛比（最近 10 点 vs 全部点的平均半径比） */
  recentConvergenceRatio: number
  /** 是否形成稳定 attractor */
  hasAttractor: boolean
  /** attractor 中心坐标（如果有） */
  attractorCenter?: PhaseCoordinate
  /** 已有初始 attractor（第一次 hasAttractor=true 时的 attractorCenter） */
  initialAttractor?: PhaseCoordinate
  /** 当前 attractor 与初始 attractor 的偏移量 */
  identityDrift?: number
  /** 系统是否保持了同一性（偏移量 < 2× 初始半径） */
  identityPreserved?: boolean
  /** 可读摘要 */
  summary: string
}

// ─── 相位图谱引擎 ──────────────────────────────────────

export class IntentPhasePortrait {
  private projections: PhaseCoordinate[] = []
  private readonly MAX_POINTS = 200

  /** 系统第一次 hasAttractor=true 时的 attractorCenter */
  private initialAttractor: PhaseCoordinate | null = null
  /** 初始吸引子的扩散半径（用于计算 2× 偏移阈值） */
  private initialSpreadRadius: number = 0

  /**
   * 基于 IDF snapshot 投影一个相位点
   */
  project(snapshot: IntentFieldSnapshot): PhaseCoordinate {
    return {
      stability: snapshot.context.dsbStabilityScore,
      intentConfidence: snapshot.intent.confidence,
      conflictIntensity: snapshot.context.divergenceRate,
    }
  }

  /**
   * 记录一个投影
   */
  record(snapshot: IntentFieldSnapshot): void {
    const coord = this.project(snapshot)
    this.projections.push(coord)
    if (this.projections.length > this.MAX_POINTS) {
      this.projections = this.projections.slice(-this.MAX_POINTS)
    }
  }

  /**
   * 批量记录
   */
  recordBatch(snapshots: IntentFieldSnapshot[]): void {
    for (const s of snapshots) this.record(s)
  }

  /**
   * 分析相位轨迹
   */
  analyzeTrajectory(): PhaseTrajectory {
    const total = this.projections.length
    if (total === 0) {
      return {
        totalPoints: 0,
        centroid: { stability: 0, intentConfidence: 0, conflictIntensity: 0 },
        spreadRadius: 0,
        recentConvergenceRatio: 1,
        hasAttractor: false,
        summary: '[PhasePortrait] 无数据',
      }
    }

    // 所有点的中心
    const centroid: PhaseCoordinate = {
      stability: this.projections.reduce((s, p) => s + p.stability, 0) / total,
      intentConfidence: this.projections.reduce((s, p) => s + p.intentConfidence, 0) / total,
      conflictIntensity: this.projections.reduce((s, p) => s + p.conflictIntensity, 0) / total,
    }

    // 扩散半径（各点到中心的最大欧氏距离）
    const distances = this.projections.map(p =>
      Math.sqrt(
        (p.stability - centroid.stability) ** 2 +
        (p.intentConfidence - centroid.intentConfidence) ** 2 +
        (p.conflictIntensity - centroid.conflictIntensity) ** 2
      )
    )
    const spreadRadius = Math.max(...distances)

    // 末端收敛比
    const recent = this.projections.slice(-10)
    const recentDistances = recent.map(p =>
      Math.sqrt(
        (p.stability - centroid.stability) ** 2 +
        (p.intentConfidence - centroid.intentConfidence) ** 2 +
        (p.conflictIntensity - centroid.conflictIntensity) ** 2
      )
    )
    const recentAvgRadius = recentDistances.reduce((s, d) => s + d, 0) / Math.max(1, recentDistances.length)
    const allAvgRadius = distances.reduce((s, d) => s + d, 0) / Math.max(1, distances.length)
    const recentConvergenceRatio = allAvgRadius > 0 ? recentAvgRadius / allAvgRadius : 1

    // attractor 判定：扩散半径小 + 末端收敛
    const hasAttractor = spreadRadius < 0.4 && recentConvergenceRatio < 0.8

    // 锁存初始吸引子（第一次 hasAttractor=true 时）
    if (hasAttractor && !this.initialAttractor) {
      this.initialAttractor = { ...centroid }
      this.initialSpreadRadius = spreadRadius
    }

    // identity drift：当前 attractor 与初始 attractor 的偏移
    let identityDrift: number | undefined
    let identityPreserved: boolean | undefined
    if (this.initialAttractor) {
      const curCenter = hasAttractor ? centroid : this.initialAttractor
      identityDrift = Math.round(
        Math.sqrt(
          (curCenter.stability - this.initialAttractor.stability) ** 2 +
          (curCenter.intentConfidence - this.initialAttractor.intentConfidence) ** 2 +
          (curCenter.conflictIntensity - this.initialAttractor.conflictIntensity) ** 2
        ) * 100
      ) / 100
      identityPreserved = identityDrift < this.initialSpreadRadius * 2
    }

    return {
      totalPoints: total,
      centroid: {
        stability: Math.round(centroid.stability * 100) / 100,
        intentConfidence: Math.round(centroid.intentConfidence * 100) / 100,
        conflictIntensity: Math.round(centroid.conflictIntensity * 100) / 100,
      },
      spreadRadius: Math.round(spreadRadius * 100) / 100,
      recentConvergenceRatio: Math.round(recentConvergenceRatio * 100) / 100,
      hasAttractor,
      attractorCenter: hasAttractor ? centroid : undefined,
      initialAttractor: this.initialAttractor ?? undefined,
      identityDrift,
      identityPreserved,
      summary: this.buildSummary(spreadRadius, recentConvergenceRatio, hasAttractor, centroid, identityDrift, identityPreserved),
    }
  }

  /**
   * 获取当前投影集合
   */
  getProjections(): PhaseCoordinate[] {
    return [...this.projections]
  }

  /**
   * 重置
   */
  reset(): void {
    this.projections = []
    this.initialAttractor = null
    this.initialSpreadRadius = 0
  }

  // ── 摘要 ──

  private buildSummary(
    spreadRadius: number,
    convergenceRatio: number,
    hasAttractor: boolean,
    centroid: PhaseCoordinate,
    identityDrift?: number,
    identityPreserved?: boolean,
  ): string {
    const attractorLabel = hasAttractor ? '🔒 吸引子' : '⚡ 扩散态'
    const convergenceLabel = convergenceRatio < 0.6
      ? '收敛中'
      : convergenceRatio < 1.0
        ? '稳定'
        : '发散'
    const identityLabel = identityPreserved === undefined
      ? ''
      : identityPreserved
        ? ` 同一性✅ drift=${(identityDrift! * 100).toFixed(0)}%`
        : ` ⚠️ 同一性丢失 drift=${(identityDrift! * 100).toFixed(0)}%`

    return `[PhasePortrait] ${attractorLabel} ${convergenceLabel}${identityLabel} | 中心($${(centroid.stability * 100).toFixed(0)}, ${(centroid.intentConfidence * 100).toFixed(0)}, ${(centroid.conflictIntensity * 100).toFixed(0)}) | 半径=${(spreadRadius * 100).toFixed(0)}% | 收敛比=${(convergenceRatio * 100).toFixed(0)}% | 采样${this.projections.length}次`
  }
}
