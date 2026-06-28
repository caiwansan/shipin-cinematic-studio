/**
 * cinematic-governance.ts — Cinematic Stability Governance Layer v1
 *
 * 控制一个会自我改变的系统。
 * 当 CRFL → DPM → CET 构成持续演化环路后，必须引入：
 *
 * 1. Drift Observability — DPM drift curve + CET bias shift tracking
 * 2. Stability Budgets — 每周期最大变化量，防止审美崩塌
 * 3. Regression Locks — 锚定偏好快照，保证"这个版本的电影感"不丢失
 * 4. Governance Policies — 定义系统如何变化、变化多少、变化方向是否健康
 *
 * 设计原则：
 *   - governance 不阻止变化，只约束变化的方向和速率（像宪法约束政府）
 *   - StabilityBudget = per-cycle 最大偏移，超过则自动回退
 *   - RegressionLock = 可托管的偏好锚点快照，不限制进化方向，只限制退化
 *   - 所有 governance 指标对外暴露为只读 dashboard
 */

// ============================================================
// Types
// ============================================================

export interface GovernanceConfig {
  /** 每周期 DPM 权重最大变化量 */
  maxWeightShiftPerCycle: number
  /** CET bias 最大偏移量 */
  maxCETBiasShiftPerCycle: number
  /** 连续 n 周期同向漂移触发警告 */
  consecutiveDriftWindow: number
  /** 偏好熵阈值，超过视为审美涣散 */
  maxPreferenceEntropy: number
  /** 回归锁自动创建间隔（周期数） */
  autoSnapshotInterval: number
  /** 自动回滚阈值（连续负向漂移次数） */
  autoRollbackThreshold: number
}

export const DEFAULT_GOVERNANCE_CONFIG: GovernanceConfig = {
  maxWeightShiftPerCycle: 0.15,
  maxCETBiasShiftPerCycle: 0.05,
  consecutiveDriftWindow: 5,
  maxPreferenceEntropy: 0.7,
  autoSnapshotInterval: 20,
  autoRollbackThreshold: 8,
}

export interface GovernanceSnapshot {
  timestamp: number
  cycleId: number
  dpmWeights: {
    motion: number
    camera: number
    emotion: number
    composition: number
    temporal: number
  }
  cetBiases: {
    motionBias: number
    cameraBias: number
    temporalBias: number
  }
  preferenceEntropy: number
}

export interface DriftRecord {
  cycleId: number
  timestamp: number
  dpmWeightDelta: number
  cetBiasDelta: number
  feedbackDirection: 'positive' | 'negative' | 'mixed'
  /** 是否被 governance 拦截或修正 */
  governed: boolean
  governanceAction?: 'allowed' | 'clamped' | 'rolled_back' | 'snapshot_created'
}

export interface GovernanceStatus {
  currentCycleId: number
  isStable: boolean
  consecutiveNegativeDrifts: number
  totalDrift: number
  preferenceEntropy: number
  recentActions: string[]
  activeSnapshotId: number | null
  warnings: string[]
}

export interface GovernanceDecision {
  allowed: boolean
  action: 'allow' | 'clamp' | 'rollback' | 'create_snapshot'
  clampedWeightShift?: number
  reason: string
}

// ============================================================
// Preference Entropy — 审美涣散度测量
// ============================================================

export class PreferenceEntropyCalculator {
  /**
   * 计算 DPM 权重的"分"度 = 系统是否在多个审美维度间摇摆
   * 高熵 = 权重均匀分布 = 系统不知道用户偏好什么
   * 低熵 = 权重集中 = 有明确审美偏向
   */
  calculate(weights: GovernanceSnapshot['dpmWeights']): number {
    const values = Object.values(weights)
    const total = values.reduce((a, b) => a + b, 0)
    if (total === 0) return 1

    const normalized = values.map(v => v / total)
    const entropy = -normalized.reduce((sum, p) => {
      if (p <= 0) return sum
      return sum + p * Math.log2(p)
    }, 0)

    // normalize to 0-1 (max entropy for 5 dimensions = log2(5) ≈ 2.32)
    return Math.min(1, entropy / Math.log2(values.length))
  }
}

// ============================================================
// Snapshot Manager — 偏好锚点快照
// ============================================================

export class SnapshotManager {
  private snapshots: GovernanceSnapshot[] = []
  private maxSnapshots: number

  constructor(maxSnapshots: number = 10) {
    this.maxSnapshots = maxSnapshots
  }

  create(data: Omit<GovernanceSnapshot, 'timestamp'>): GovernanceSnapshot {
    const snapshot: GovernanceSnapshot = { ...data, timestamp: Date.now() }
    this.snapshots.push(snapshot)
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift()
    }
    return snapshot
  }

  getLatest(): GovernanceSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null
  }

  /** 回归到指定快照 */
  rollbackTo(snapshotId: number): GovernanceSnapshot | null {
    const target = this.snapshots.find(s => s.cycleId === snapshotId)
    if (!target) return null

    // Remove all snapshots after this one
    this.snapshots = this.snapshots.filter(s => s.cycleId <= snapshotId)
    return target
  }

  /** 从最接近的快照恢复 */
  findNearest(cycleId: number): GovernanceSnapshot | null {
    if (this.snapshots.length === 0) return null

    let nearest = this.snapshots[0]
    let minDist = Math.abs(nearest.cycleId - cycleId)

    for (const s of this.snapshots) {
      const dist = Math.abs(s.cycleId - cycleId)
      if (dist < minDist) {
        minDist = dist
        nearest = s
      }
    }

    return nearest
  }

  getAll(): GovernanceSnapshot[] {
    return [...this.snapshots]
  }

  count(): number {
    return this.snapshots.length
  }
}

// ============================================================
// Stability Governor — 核心治理引擎
// ============================================================

export class StabilityGovernor {
  config: GovernanceConfig
  records: DriftRecord[] = []
  snapshots = new SnapshotManager()
  entropyCalculator = new PreferenceEntropyCalculator()
  private currentCycleId: number = 0

  constructor(config?: Partial<GovernanceConfig>) {
    this.config = { ...DEFAULT_GOVERNANCE_CONFIG, ...config }
  }

  /**
   * 治理一个 CRFL 更新周期
   * 返回 governance decision：
   *   - allow: 允许更新
   *   - clamp: 削减更新幅度
   *   - rollback: 回滚到最近的健康快照
   *   - create_snapshot: 自动创建快照
   */
  govern(update: {
    dpmWeightShift: number
    cetBiasShift: number
    feedbackDirection: 'positive' | 'negative' | 'mixed'
    currentWeights: GovernanceSnapshot['dpmWeights']
    currentBiases: GovernanceSnapshot['cetBiases']
  }): GovernanceDecision {
    this.currentCycleId++

    // 1. 检查连续负向漂移
    if (update.feedbackDirection === 'negative') {
      this.records.push({
        cycleId: this.currentCycleId,
        timestamp: Date.now(),
        dpmWeightDelta: update.dpmWeightShift,
        cetBiasDelta: update.cetBiasShift,
        feedbackDirection: 'negative',
        governed: false,
      })

      const consecutiveNegatives = this.countConsecutiveNegative()
      if (consecutiveNegatives >= this.config.autoRollbackThreshold) {
        // 回滚到最新快照
        const nearest = this.snapshots.getLatest()
        if (nearest) {
          return {
            allowed: true,
            action: 'rollback',
            reason: `连续 ${consecutiveNegatives} 周期负向漂移，回滚到快照 #${nearest.cycleId}`,
          }
        }
      }
    } else {
      // positive/mixed → 正常记录
      this.records.push({
        cycleId: this.currentCycleId,
        timestamp: Date.now(),
        dpmWeightDelta: update.dpmWeightShift,
        cetBiasDelta: update.cetBiasShift,
        feedbackDirection: update.feedbackDirection,
        governed: false,
      })
    }

    // 2. 检查 DPM 权重偏移是否超限
    const absWeightShift = Math.abs(update.dpmWeightShift)
    if (absWeightShift > this.config.maxWeightShiftPerCycle) {
      const clamped = Math.sign(update.dpmWeightShift) * this.config.maxWeightShiftPerCycle
      this.markGoverned('clamped', `DPM 权重偏移 ${absWeightShift.toFixed(3)} 超限 (max: ${this.config.maxWeightShiftPerCycle})`)
      return {
        allowed: true,
        action: 'clamp',
        clampedWeightShift: clamped,
        reason: `权重偏移已削减: ${absWeightShift.toFixed(3)} → ${this.config.maxWeightShiftPerCycle}`,
      }
    }

    // 3. 检查 CET bias 偏移是否超限
    if (Math.abs(update.cetBiasShift) > this.config.maxCETBiasShiftPerCycle) {
      this.markGoverned('clamped', `CET bias 偏移 ${update.cetBiasShift.toFixed(3)} 超限`)
      return {
        allowed: true,
        action: 'clamp',
        reason: `CET bias 偏移已削减到 ${this.config.maxCETBiasShiftPerCycle}`,
      }
    }

    // 4. 检查偏好熵
    const entropy = this.entropyCalculator.calculate(update.currentWeights)
    if (entropy > this.config.maxPreferenceEntropy) {
      const nearest = this.snapshots.findNearest(this.currentCycleId)
      if (nearest) {
        this.markGoverned('rollback', `偏好熵 ${entropy.toFixed(3)} 超限 (max: ${this.config.maxPreferenceEntropy})`)
        return {
          allowed: true,
          action: 'rollback',
          reason: `审美涣散 (熵 ${entropy.toFixed(3)})，回滚到快照 #${nearest.cycleId}`,
        }
      }
    }

    // 5. 自动快照
    if (this.currentCycleId % this.config.autoSnapshotInterval === 0) {
      this.snapshots.create({
        cycleId: this.currentCycleId,
        dpmWeights: update.currentWeights,
        cetBiases: update.currentBiases,
        preferenceEntropy: entropy,
      })
      this.markGoverned('snapshot_created', `周期 ${this.currentCycleId} 自动快照`)
      return {
        allowed: true,
        action: 'create_snapshot',
        reason: `自动创建快照 #${this.currentCycleId}`,
      }
    }

    // 6. 正常放行
    return { allowed: true, action: 'allow', reason: '在安全范围内' }
  }

  /** 获取治理状态 */
  getStatus(): GovernanceStatus {
    const consecutiveNegatives = this.countConsecutiveNegative()
    const totalDrift = this.records.reduce((s, r) => s + Math.abs(r.dpmWeightDelta), 0)
    const recentActions = this.records
      .filter(r => r.governed)
      .slice(-5)
      .map(r => `${r.governanceAction} (cycle ${r.cycleId})`)

    const latestSnapshot = this.snapshots.getLatest()
    const entropy = latestSnapshot ? latestSnapshot.preferenceEntropy : 0

    const warnings: string[] = []
    if (consecutiveNegatives >= this.config.consecutiveDriftWindow) {
      warnings.push(`连续 ${consecutiveNegatives} 周期负向漂移`)
    }
    if (entropy > this.config.maxPreferenceEntropy * 0.8) {
      warnings.push('偏好熵接近阈值')
    }
    if (this.snapshots.count() === 0) {
      warnings.push('无可用快照')
    }

    return {
      currentCycleId: this.currentCycleId,
      isStable: consecutiveNegatives < this.config.consecutiveDriftWindow && entropy < this.config.maxPreferenceEntropy,
      consecutiveNegativeDrifts: consecutiveNegatives,
      totalDrift,
      preferenceEntropy: entropy,
      recentActions,
      activeSnapshotId: latestSnapshot?.cycleId ?? null,
      warnings,
    }
  }

  private countConsecutiveNegative(): number {
    let count = 0
    for (let i = this.records.length - 1; i >= 0; i--) {
      if (this.records[i].feedbackDirection === 'negative') {
        count++
      } else {
        break
      }
    }
    return count
  }

  private markGoverned(action: string, reason: string): void {
    const last = this.records[this.records.length - 1]
    if (last) {
      last.governed = true
      last.governanceAction = action as DriftRecord['governanceAction']
    }
  }
}

// ============================================================
// Governance Dashboard — 只读状态视图
// ============================================================

export class GovernanceDashboard {
  constructor(private governor: StabilityGovernor) {}

  /** 系统健康度（0-1） */
  getHealth(): number {
    const status = this.governor.getStatus()
    let health = 1

    // 负向漂移惩罚
    health -= status.consecutiveNegativeDrifts * 0.1

    // 熵惩罚
    health -= status.preferenceEntropy * 0.3

    // 总漂移惩罚
    health -= status.totalDrift * 0.5

    // 无快照惩罚
    if (status.activeSnapshotId === null) health -= 0.1

    return Math.max(0, Math.min(1, health))
  }

  /** 完整状态报告 */
  getReport(): {
    health: number
    status: GovernanceStatus
    snapshotCount: number
    config: GovernanceConfig
  } {
    return {
      health: this.getHealth(),
      status: this.governor.getStatus(),
      snapshotCount: this.governor.snapshots.count(),
      config: { ...this.governor.config },
    }
  }
}
