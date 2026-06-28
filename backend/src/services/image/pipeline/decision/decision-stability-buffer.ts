// ============================================================
// decision/decision-stability-buffer.ts
//
// 职责：DSB — Decision Stabilization Buffer
//   在 Phase 4.2 Director Planner 启动前提供稳定边界
//
// 核心功能：
//   1. 冻结 divergence baseline（DCVL 指标锁存）
//   2. 计算稳定性分数（当前 vs 基线差异）
//   3. 时域缓冲（同一次决策请求中的跨 tick 稳定性）
//
// 设计原则：
//   - 不改变系统行为（shadow only）
//   - 不引入新的决策语义
//   - 只提供 "系统是否已经稳定" 的观测
//   - DSB 本身不决定是否进入 Phase 4.2（人类决策）
// ============================================================

import type { ConsistencyReport } from './decision-consistency-validation.js'

// ─── DSB 类型 ──────────────────────────────────────────

export interface DSBState {
  /** 基线是否已冻结 */
  baselineFrozen: boolean
  /** 基线冻结时间戳 */
  frozenAt?: string
  /** 基线快照 */
  baseline?: ConsistencyReport
  /** 当前稳定性状态 */
  stability: DecisionStability
  /** 信号 */
  signals: string[]
  /** 历史 tick 快照（最多保留 10 个） */
  tickHistory: Array<{
    tick: number
    timestamp: string
    divergenceRate: number
    collapsed: boolean
    forcedRatio: number
  }>
}

export interface DecisionStability {
  /** 整体稳定度 0-1 */
  score: number
  /** 各项指标稳定性 */
  metrics: {
    divergenceDrift: number  // divergenceRate 相对基线的偏差（越小越稳定）
    modeConsistency: number  // 模式是否反复跳变
    forcedPressure: number   // forced 比例变化率
  }
  /** 是否达到稳定阈值 */
  stable: boolean
  /** 稳定信号 */
  signals: string[]
}

// ─── DSB 管理器 ────────────────────────────────────────

export class DecisionStabilityBuffer {
  private state: DSBState
  private tickCount = 0
  private lastModes: string[] = []

  // 稳定阈值
  private readonly STABLE_THRESHOLD = 0.15  // divergence drift < 15%
  private readonly MAX_HISTORY = 10

  constructor() {
    this.state = {
      baselineFrozen: false,
      stability: {
        score: 0,
        metrics: { divergenceDrift: 1, modeConsistency: 0, forcedPressure: 0 },
        stable: false,
        signals: [],
      },
      signals: [],
      tickHistory: [],
    }
  }

  /**
   * 冻结当前 DCVL 报告为基线
   * 在 Phase 4.2 启动前调用一次
   */
  freezeBaseline(report: ConsistencyReport): void {
    this.state.baseline = { ...report }
    this.state.baselineFrozen = true
    this.state.frozenAt = new Date().toISOString()
    this.state.signals = ['BASELINE_FROZEN']
  }

  /**
   * 提交新的 DCVL 报告，更新稳定性状态
   */
  update(report: ConsistencyReport): DecisionStability {
    this.tickCount++
    const tick = this.tickCount

    // 记录历史
    this.state.tickHistory.push({
      tick,
      timestamp: new Date().toISOString(),
      divergenceRate: report.divergenceRate,
      collapsed: report.ontologyHealth.collapsed,
      forcedRatio: report.forcedDecisionAudit.forcedRatio,
    })

    // 限制历史长度
    if (this.state.tickHistory.length > this.MAX_HISTORY) {
      this.state.tickHistory = this.state.tickHistory.slice(-this.MAX_HISTORY)
    }

    const signals: string[] = []

    // ── divergence drift（如果基线已冻结，计算偏差） ──
    let divergenceDrift = 0
    if (this.state.baseline) {
      divergenceDrift = Math.abs(report.divergenceRate - this.state.baseline.divergenceRate)
      if (divergenceDrift > this.STABLE_THRESHOLD) {
        signals.push(`DIVERGENCE_DRIFT: ${(divergenceDrift * 100).toFixed(0)}% (threshold ${(this.STABLE_THRESHOLD * 100).toFixed(0)}%)`)
      }
    }

    // ── mode consistency（跨 tick 模式是否稳定） ──
    this.lastModes.push(report.status)
    if (this.lastModes.length > 5) {
      this.lastModes = this.lastModes.slice(-5)
    }

    const modeChanges = this.lastModes.filter(m => m !== report.status).length
    const modeConsistency = modeChanges === 0 ? 1 : Math.max(0, 1 - modeChanges / this.lastModes.length)

    if (modeConsistency < 0.6) {
      signals.push(`MODE_INCONSISTENT: ${this.lastModes.join('→')}`)
    }

    // ── forced pressure（forced 比例是否在上升） ──
    const forcedPressure = report.forcedDecisionAudit.forcedRatio
    if (forcedPressure > 0.3) {
      signals.push(`FORCED_PRESSURE_HIGH: ${(forcedPressure * 100).toFixed(0)}%`)
    }

    const driftScore = Math.max(0, 1 - divergenceDrift * 3)
    const stabilityScore = Math.round(
      (driftScore * 0.5 + modeConsistency * 0.3 + Math.max(0, 1 - forcedPressure) * 0.2) * 100
    ) / 100

    const stable = stabilityScore > 0.7 && signals.length === 0

    this.state.stability = {
      score: stabilityScore,
      metrics: {
        divergenceDrift: Math.round(divergenceDrift * 100) / 100,
        modeConsistency: Math.round(modeConsistency * 100) / 100,
        forcedPressure: Math.round(forcedPressure * 100) / 100,
      },
      stable,
      signals,
    }

    return this.state.stability
  }

  /**
   * 获取当前 DSB 状态快照
   */
  getSnapshot(): DSBState {
    return { ...this.state }
  }

  /**
   * 重置（清空历史）
   */
  reset(): void {
    this.state = {
      baselineFrozen: false,
      stability: {
        score: 0,
        metrics: { divergenceDrift: 1, modeConsistency: 0, forcedPressure: 0 },
        stable: false,
        signals: [],
      },
      signals: [],
      tickHistory: [],
    }
    this.lastModes = []
    this.tickCount = 0
  }
}
