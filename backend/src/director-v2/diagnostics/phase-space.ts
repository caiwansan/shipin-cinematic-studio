/**
 * phase-space.ts — Director System Phase Space Model
 *
 * 将 BSI × FreedomIndex 建模为 2D 状态空间。
 * 核心功能：
 *   1. 追踪状态轨迹 S(t) = (BSI, FreedomIndex)
 *   2. 计算相速度 dS/dt
 *   3. 检测相变（在象限间切换）
 *   4. 识别 stagnation attractor（系统被吸入低维区域）
 *
 * 这不是"新指标"，而是"时间序列上的相态分析"。
 */

// ============================================================
// Types
// ============================================================

export interface PhaseState {
  bsi: number
  freedomIndex: number
  timestamp: number
}

export type Quadrant = 'creative_stable' | 'stable_but_stagnant' | 'creative_but_risky' | 'unstable_degenerate'

export type PhaseTransition =
  | { from: Quadrant; to: Quadrant; speed: number; smooth: boolean }

export interface PhaseTrajectory {
  /** 当前状态 */
  current: PhaseState
  /** 速度向量 */
  velocity: { dbsi: number; dfreedom: number; magnitude: number }
  /** 历史路径（最后 N 个点） */
  path: PhaseState[]
  /** 最近一次相变 */
  lastTransition: PhaseTransition | null
  /** 是否检测到 stagnation 吸引子 */
  stagnationDetected: boolean
  /** stagnation 强度 (0-1) */
  stagnationIntensity: number
}

export interface StagnationReport {
  /** 是否陷入 stagnation attractor */
  attractorReached: boolean
  /** 吸引子位置（均值坐标） */
  attractorPosition: { bsi: number; freedomIndex: number }
  /** 轨道的收敛半径 */
  convergenceRadius: number
  /** 已停留周期数 */
  stableCycles: number
  /** 建议操作 */
  recommendation: string
}

// ============================================================
// Quadrant Mapping
// ============================================================

export function classifyQuadrant(bsi: number, freedomIndex: number): Quadrant {
  const stable = bsi >= 0.85
  const free = freedomIndex >= 0.5

  if (stable && free) return 'creative_stable'
  if (stable && !free) return 'stable_but_stagnant'
  if (!stable && free) return 'creative_but_risky'
  return 'unstable_degenerate'
}

// ============================================================
// Phase Space Analyzer
// ============================================================

export class PhaseSpaceAnalyzer {
  /** 历史状态（时间序） */
  private states: PhaseState[] = []
  /** 最大保存点数 */
  private maxHistory: number

  constructor(maxHistory: number = 100) {
    this.maxHistory = maxHistory
  }

  /**
   * 记录新状态并返回当前轨迹分析
   */
  record(bsi: number, freedomIndex: number): PhaseTrajectory {
    const state: PhaseState = { bsi, freedomIndex, timestamp: Date.now() }
    this.states.push(state)
    if (this.states.length > this.maxHistory) {
      this.states.shift()
    }
    return this.analyze()
  }

  /**
   * 分析当前轨迹
   */
  analyze(): PhaseTrajectory {
    const current = this.states[this.states.length - 1]
    if (!current) {
      return {
        current: { bsi: 0.5, freedomIndex: 0.5, timestamp: Date.now() },
        velocity: { dbsi: 0, dfreedom: 0, magnitude: 0 },
        path: [],
        lastTransition: null,
        stagnationDetected: false,
        stagnationIntensity: 0,
      }
    }

    const velocity = this.computeVelocity()
    const transition = this.detectTransition()
    const stagnation = this.detectStagnation()

    return {
      current,
      velocity,
      path: [...this.states],
      lastTransition: transition,
      stagnationDetected: stagnation.attractorReached,
      stagnationIntensity: stagnation.attractorReached
        ? Math.min(1, stagnation.stableCycles / 10)
        : 0,
    }
  }

  /**
   * 速度向量 (dBSI/dt, dFreedom/dt)
   * 基于最后 3 个点（如有）的差分
   */
  private computeVelocity(): { dbsi: number; dfreedom: number; magnitude: number } {
    if (this.states.length < 2) {
      return { dbsi: 0, dfreedom: 0, magnitude: 0 }
    }

    const n = this.states.length
    const last = this.states[n - 1]
    const prev = this.states[n - 2]

    const dbsi = last.bsi - prev.bsi
    const dfreedom = last.freedomIndex - prev.freedomIndex
    const magnitude = Math.sqrt(dbsi * dbsi + dfreedom * dfreedom)

    return { dbsi, dfreedom, magnitude }
  }

  /**
   * 检测相变（象限切换）
   */
  private detectTransition(): PhaseTransition | null {
    if (this.states.length < 2) return null

    const n = this.states.length
    const current = this.states[n - 1]
    const previous = this.states[n - 2]

    const prevQuadrant = classifyQuadrant(previous.bsi, previous.freedomIndex)
    const curQuadrant = classifyQuadrant(current.bsi, current.freedomIndex)

    if (prevQuadrant !== curQuadrant) {
      // 计算切换速度
      const dt = Math.max(current.timestamp - previous.timestamp, 1)
      const speed = Math.sqrt(
        (current.bsi - previous.bsi) ** 2 + (current.freedomIndex - previous.freedomIndex) ** 2
      ) / dt

      return {
        from: prevQuadrant,
        to: curQuadrant,
        speed,
        smooth: speed < 0.001, // 慢速切换 = 平滑漂移
      }
    }

    return null
  }

  /**
   * 检测是否陷入 stagnation attractor
   *
   * 定义：连续 N 个周期停留在同一个象限，
   * 且状态向心收敛（BSI 稳定且 Freedom 稳定且低）
   */
  private detectStagnation(): StagnationReport {
    if (this.states.length < 3) {
      return {
        attractorReached: false,
        attractorPosition: { bsi: 0.5, freedomIndex: 0.5 },
        convergenceRadius: 0,
        stableCycles: 0,
        recommendation: 'Not enough data',
      }
    }

    const recent = this.states.slice(-10)
    const n = recent.length

    // 算这些点的均值（吸引子位置估计）
    const meanBSI = recent.reduce((s, st) => s + st.bsi, 0) / n
    const meanFreedom = recent.reduce((s, st) => s + st.freedomIndex, 0) / n

    // 收敛半径 = 到均值的平均距离
    const distances = recent.map(st => Math.sqrt((st.bsi - meanBSI) ** 2 + (st.freedomIndex - meanFreedom) ** 2))
    const convergenceRadius = distances.reduce((s, d) => s + d, 0) / n

    // 检测是否都在同一个象限
    const quadrants = recent.map(st => classifyQuadrant(st.bsi, st.freedomIndex))
    const allSameQuadrant = quadrants.every(q => q === quadrants[0])

    // 稳定周期 = 连续在同一象限的周期数
    let stableCycles = 0
    for (let i = this.states.length - 1; i >= 0; i--) {
      const q = classifyQuadrant(this.states[i].bsi, this.states[i].freedomIndex)
      if (q === classifyQuadrant(this.states[this.states.length - 1].bsi, this.states[this.states.length - 1].freedomIndex)) {
        stableCycles++
      } else break
    }

    // Stagnation 检测：
    // 1. 在同一象限超过 5 周期
    // 2. 收敛半径小（< 0.05）
    // 3. 位于 stagnant 或 degenerate 象限
    const currentQuadrant = classifyQuadrant(meanBSI, meanFreedom)
    const isStagnation = allSameQuadrant
      && stableCycles >= 5
      && convergenceRadius < 0.05
      && (currentQuadrant === 'stable_but_stagnant' || currentQuadrant === 'unstable_degenerate')

    let recommendation: string
    if (isStagnation) {
      recommendation = `Stagnation attractor detected at (BSI=${meanBSI.toFixed(2)}, Freedom=${meanFreedom.toFixed(2)}). `
        + `System has been stable in '${currentQuadrant}' for ${stableCycles} cycles. `
        + (currentQuadrant === 'stable_but_stagnant'
          ? 'Recommend loosening governance constraints to expand freedom budget.'
          : 'Recommend rollback or governance reconfiguration.')
    } else if (stableCycles >= 5 && convergenceRadius < 0.05) {
      recommendation = `System converging to (${meanBSI.toFixed(2)}, ${meanFreedom.toFixed(2)}) but still healthy.`
    } else {
      recommendation = 'Normal phase exploration.'
    }

    return {
      attractorReached: isStagnation,
      attractorPosition: { bsi: meanBSI, freedomIndex: meanFreedom },
      convergenceRadius,
      stableCycles,
      recommendation,
    }
  }

  /**
   * 导出相空间快照
   */
  getSnapshot(): {
    currentBsi: number
    currentFreedom: number
    quadrant: Quadrant
    historyLength: number
  } {
    const last = this.states[this.states.length - 1]
    return {
      currentBsi: last?.bsi ?? 0.5,
      currentFreedom: last?.freedomIndex ?? 0.5,
      quadrant: classifyQuadrant(last?.bsi ?? 0.5, last?.freedomIndex ?? 0.5),
      historyLength: this.states.length,
    }
  }
}

// ============================================================
// Phase Gate — 基于相空间的安全开关
// ============================================================

export interface PhaseGateDecision {
  /** 是否允许 switch */
  allow: boolean
  /** 当前象限 */
  quadrant: Quadrant
  /** 相速度 */
  phaseVelocity: number
  /** 是否在走向 stagnation */
  headingTowardStagnation: boolean
  /** 原因 */
  reasons: string[]
}

export class PhaseGate {
  private analyzer: PhaseSpaceAnalyzer

  constructor() {
    this.analyzer = new PhaseSpaceAnalyzer()
  }

  /**
   * 基于相空间做 switch 决策
   * 比 BSI × Freedom 静态决策更保守：
   *   检查速度方向——如果正朝 stagnation 走，即使当前相位 OK 也延迟
   */
  evaluate(bsi: number, freedomIndex: number): PhaseGateDecision {
    const trajectory = this.analyzer.record(bsi, freedomIndex)
    const quadrant = classifyQuadrant(bsi, freedomIndex)
    const reasons: string[] = []

    let allow = false
    let headingTowardStagnation = false

    switch (quadrant) {
      case 'creative_stable':
        allow = true
        reasons.push(`Creative stable — BSI ${bsi.toFixed(2)}, Freedom ${freedomIndex.toFixed(2)}`)
        break
      case 'stable_but_stagnant':
        // 检查速度方向：如果是在远离 stagnation，仍然 allow
        if (trajectory.velocity.dfreedom > 0) {
          allow = true
          reasons.push(`Stagnant but recovering — Freedom +${trajectory.velocity.dfreedom.toFixed(3)}/cycle`)
        } else {
          allow = false
          headingTowardStagnation = true
          reasons.push(`Stagnant and degrading — Freedom ${trajectory.velocity.dfreedom.toFixed(3)}/cycle`)
        }
        break
      case 'creative_but_risky':
        // 如果 BSI 在提升且 Freedom 稳定，allow with guard
        if (trajectory.velocity.dbsi > 0) {
          allow = true
          reasons.push(`Risky but recovering — BSI +${trajectory.velocity.dbsi.toFixed(3)}/cycle`)
        } else {
          allow = false
          reasons.push(`Risky and degrading — BSI ${trajectory.velocity.dbsi.toFixed(3)}/cycle`)
        }
        break
      case 'unstable_degenerate':
        allow = false
        reasons.push('Unstable degenerate — switch rejected')
        break
    }

    if (trajectory.stagnationDetected) {
      headingTowardStagnation = true
      reasons.push(`⚠ Stagnation attractor detected — ${trajectory.current.bsi.toFixed(2)}, ${trajectory.current.freedomIndex.toFixed(2)}`)
    }

    return {
      allow,
      quadrant,
      phaseVelocity: trajectory.velocity.magnitude,
      headingTowardStagnation,
      reasons,
    }
  }

  /**
   * 获取当前相空间分析
   */
  getDiagnostics() {
    return {
      analyzer: this.analyzer,
      trajectory: this.analyzer.analyze(),
      snapshot: this.analyzer.getSnapshot(),
    }
  }
}
