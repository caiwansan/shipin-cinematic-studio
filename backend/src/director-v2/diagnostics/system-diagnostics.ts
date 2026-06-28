/**
 * system-diagnostics.ts — System Observability + Stability Diagnostics
 *
 * Cinematic System Operations Phase 的核心工具。
 * 不是新系统层，而是让已存在的 governance、DPM、CRFL、CET 数据
 * 变得可观察、可解释、可操作。
 *
 * 三个核心输出：
 *   1. Stability Diagnostics — 系统健康度 + 漂移趋势分析
 *   2. Drift Explainability — 每次漂移的原因追溯
 *   3. Preference Entropy Visualization — 审美分布的可读解释
 */

// ============================================================
// Types
// ============================================================

export interface SystemDiagnosticsReport {
  /** 时间戳 */
  timestamp: number
  /** 系统整体健康度 */
  healthScore: number
  /** 当前阶段 */
  phase: 'stable' | 'drifting' | 'unstable' | 'recovering'
  /** 活跃警告 */
  activeWarnings: WarningItem[]
  /** 趋势分析 */
  trends: TrendAnalysis
  /** 漂移可解释性 */
  driftExplanation: DriftExplanation
  /** 审美分布 */
  preferenceLandscape: PreferenceLandscape
  /** 建议操作 */
  recommendations: string[]
}

export interface WarningItem {
  level: 'info' | 'warning' | 'critical'
  source: string
  message: string
  detail: string
  timestamp: number
}

export interface TrendAnalysis {
  /** 最近 n 个周期 DPM 权重偏移方向 */
  dpmWeightDirection: string
  /** CET bias 迁移方向 */
  cetBiasDirection: string
  /** 偏好熵趋势 */
  entropyTrend: 'increasing' | 'stable' | 'decreasing'
  /** 是否出现审美漂移信号 */
  aestheticDriftDetected: boolean
  /** 信号强度 */
  signalStrength: number
}

export interface DriftExplanation {
  /** 什么在漂移 */
  what: string
  /** 为什么漂移 */
  why: string
  /** 漂移了多少 */
  magnitude: number
  /** 是否健康 */
  isHealthyDrift: boolean
  /** 建议是否干预 */
  needsIntervention: boolean
}

export interface PreferenceLandscape {
  /** 各维度权重分布 */
  weightDistribution: Record<string, number>
  /** 熵值 */
  entropy: number
  /** 集中度（最高权重 / 最低权重） */
  concentrationRatio: number
  /** 审美类别描述 */
  aestheticType: 'focused' | 'balanced' | 'dispersed'
  /** 相比上一个快照的变化 */
  changeFromSnapshot: string
}

// ============================================================
// Diagnostics Engine
// ============================================================

export class SystemDiagnosticsEngine {
  private history: SystemDiagnosticsReport[] = []
  private maxHistory: number

  constructor(maxHistory: number = 24) {
    this.maxHistory = maxHistory
  }

  /**
   * 生成当前系统诊断报告
   */
  generate(opts: {
    healthScore: number
    governanceStatus: {
      currentCycleId: number
      consecutiveNegativeDrifts: number
      totalDrift: number
      preferenceEntropy: number
      warnings: string[]
      activeSnapshotId: number | null
    }
    dpmWeights?: Record<string, number>
    cetBiases?: { motionBias: number; cameraBias: number; temporalBias: number }
    driftRecords?: { dpmWeightDelta: number; feedbackDirection: string }[]
  }): SystemDiagnosticsReport {
    const phase = this.determinePhase(opts)
    const warnings = this.buildWarnings(opts)
    const trends = this.analyzeTrends(opts)
    const driftExplained = this.explainDrift(opts, trends)
    const landscape = this.describeLandscape(opts)

    const report: SystemDiagnosticsReport = {
      timestamp: Date.now(),
      healthScore: opts.healthScore,
      phase,
      activeWarnings: warnings,
      trends,
      driftExplanation: driftExplained,
      preferenceLandscape: landscape,
      recommendations: this.generateRecommendations(phase, warnings, trends),
    }

    this.history.push(report)
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }

    return report
  }

  /**
   * 获取历史诊断数据（用于趋势图）
   */
  getHistory(cursor?: { since: number }): SystemDiagnosticsReport[] {
    if (cursor) {
      return this.history.filter(h => h.timestamp >= cursor.since)
    }
    return [...this.history]
  }

  private determinePhase(opts: SystemDiagnosticsReport['__type'] extends never ? never : Parameters<SystemDiagnosticsEngine['generate']>[0]): SystemDiagnosticsReport['phase'] {
    const { healthScore, governanceStatus } = opts as any
    if (healthScore >= 0.8) return 'stable'
    if (governanceStatus.consecutiveNegativeDrifts >= 5) return 'unstable'
    if (governanceStatus.consecutiveNegativeDrifts >= 3) return 'drifting'
    return 'stable'
  }

  private buildWarnings(opts: any): WarningItem[] {
    const warnings: WarningItem[] = []
    const { governanceStatus, healthScore } = opts

    if (healthScore < 0.5) {
      warnings.push({
        level: 'critical',
        source: 'system',
        message: '整体健康度低于 0.5',
        detail: '建议立即检查 CRFL 反馈循环和 DPM 权重分布',
        timestamp: Date.now(),
      })
    }

    if (governanceStatus.preferenceEntropy > 0.7) {
      warnings.push({
        level: 'warning',
        source: 'aesthetic',
        message: '偏好熵过高，审美分布过于分散',
        detail: `当前熵值: ${governanceStatus.preferenceEntropy.toFixed(3)}，阈值: 0.7`,
        timestamp: Date.now(),
      })
    }

    if (governanceStatus.consecutiveNegativeDrifts >= 3) {
      warnings.push({
        level: 'warning',
        source: 'feedback',
        message: `连续 ${governanceStatus.consecutiveNegativeDrifts} 周期负向反馈漂移`,
        detail: governanceStatus.consecutiveNegativeDrifts >= 5
          ? '已达自动回滚阈值'
          : '接近自动回滚阈值',
        timestamp: Date.now(),
      })
    }

    return warnings
  }

  private analyzeTrends(opts: any): TrendAnalysis {
    const { dpmWeights, cetBiases, governanceStatus } = opts
    const dpmDir = dpmWeights && this.inferWeightDirection(dpmWeights)
    const cetDir = cetBiases && `${cetBiases.motionBias > 0.01 ? '运动偏置正向 / ' : '运动偏置负向 / '}${cetBiases.cameraBias > 0.01 ? '镜头偏置正向' : '镜头偏置负向'}`
    const driftDetected = governanceStatus.totalDrift > 0.5
    const lastEntropy = this.history.length > 0
      ? this.history[this.history.length - 1].preferenceLandscape.entropy
      : governanceStatus.preferenceEntropy

    let entropyTrend: 'increasing' | 'stable' | 'decreasing' = 'stable'
    if (governanceStatus.preferenceEntropy > lastEntropy + 0.05) entropyTrend = 'increasing'
    else if (governanceStatus.preferenceEntropy < lastEntropy - 0.05) entropyTrend = 'decreasing'

    return {
      dpmWeightDirection: dpmDir || '无数据',
      cetBiasDirection: cetDir || '无数据',
      entropyTrend,
      aestheticDriftDetected: driftDetected,
      signalStrength: Math.min(1, governanceStatus.totalDrift / 2),
    }
  }

  private explainDrift(opts: any, trends: TrendAnalysis): DriftExplanation {
    const { governanceStatus } = opts
    const isNegativeDrift = governanceStatus.consecutiveNegativeDrifts >= 2
    const magnitude = governanceStatus.totalDrift

    let what: string
    let why: string
    let isHealthy: boolean

    if (isNegativeDrift) {
      what = 'DPM 权重持续向负向偏移'
      why = 'CRFL 反馈循环感知到人类偏好变化，连续多个周期负向信号累积'
      isHealthy = governanceStatus.consecutiveNegativeDrifts < 5
    } else if (trends.entropyTrend === 'increasing') {
      what = '偏好熵上升，审美分布趋于分散'
      why = '可能原因：多用户反馈信号冲突，或 system 尝试覆盖新风格'
      isHealthy = governanceStatus.preferenceEntropy < 0.7
    } else {
      what = '系统处于稳定状态'
      why = '无明显漂移信号'
      isHealthy = true
    }

    return {
      what,
      why,
      magnitude,
      isHealthyDrift: isHealthy,
      needsIntervention: !isHealthy || isNegativeDrift && governanceStatus.consecutiveNegativeDrifts >= 4,
    }
  }

  private describeLandscape(opts: any): PreferenceLandscape {
    const dpmWeights = opts.dpmWeights || { motion: 0.25, camera: 0.25, emotion: 0.20, composition: 0.15, temporal: 0.15 }
    const weights = Object.values(dpmWeights) as number[]
    const maxW = Math.max(...weights)
    const minW = Math.min(...weights)
    const concentrationRatio = minW > 0 ? maxW / minW : Infinity
    const entropy = opts.governanceStatus.preferenceEntropy

    let aestheticType: PreferenceLandscape['aestheticType']
    if (concentrationRatio > 3) aestheticType = 'focused'
    else if (entropy > 0.7) aestheticType = 'dispersed'
    else aestheticType = 'balanced'

    return {
      weightDistribution: { ...dpmWeights },
      entropy,
      concentrationRatio: Math.min(concentrationRatio, 100),
      aestheticType,
      changeFromSnapshot: '与上一个快照对比：稳定（无快照可对比）',
    }
  }

  private inferWeightDirection(weights: Record<string, number>): string {
    const entries = Object.entries(weights).sort((a, b) => b[1] - a[1])
    const top = entries[0]
    return `${top[0]} 权重最高 (${(top[1] * 100).toFixed(0)}%)`
  }

  private generateRecommendations(phase: string, warnings: WarningItem[], trends: TrendAnalysis): string[] {
    const recommendations: string[] = []

    if (phase === 'unstable') {
      recommendations.push('系统处于不稳定状态，建议回滚到最近快照')
      recommendations.push('降低 CRFL 学习率，减少每周期漂移量')
    }
    if (warnings.some(w => w.source === 'aesthetic')) {
      recommendations.push('偏好熵过高，考虑重置 DPM 权重或增加 feedback 噪声过滤')
    }
    if (trends.aestheticDriftDetected && trends.signalStrength > 0.7) {
      recommendations.push('漂移信号强度高，建议检查反馈数据质量')
    }
    if (!warnings.length) {
      recommendations.push('系统状态健康，无需干预')
    }
    if (recommendations.length === 0) {
      recommendations.push('持续监控漂移趋势')
    }

    return recommendations
  }
}

// ============================================================
// Drift Explainability (standalone)
// ============================================================

export function explainDriftEvent(event: {
  cycleId: number
  dpmWeightDelta: number
  cetBiasDelta: number
  feedbackDirection: string
  governed: boolean
  governanceAction?: string
}): string {
  const parts: string[] = []
  parts.push(`周期 #${event.cycleId}`)

  if (event.feedbackDirection === 'negative') {
    parts.push(`负向反馈漂移 ( delta: ${event.dpmWeightDelta.toFixed(3)} )`)
  } else {
    parts.push(`${event.feedbackDirection} 反馈漂移 ( delta: ${event.dpmWeightDelta.toFixed(3)} )`)
  }

  if (event.governed) {
    parts.push(`治理层干预: ${event.governanceAction}`)
  } else {
    parts.push('无治理干预')
  }

  parts.push(`CET bias shift: ${event.cetBiasDelta.toFixed(4)}`)
  return parts.join(' | ')
}

// ============================================================
// Landscape Tagger (preference landscape classification)
// ============================================================

export function classifyAestheticLandscape(weights: Record<string, number>): string[] {
  const sorted = Object.entries(weights).sort((a, b) => b[1] - a[1])
  const tags: string[] = []

  // 主导维度判断
  const topWeight = sorted[0][1]
  if (topWeight > 0.4) {
    tags.push(`${sorted[0][0]}-dominant`)
  } else if (topWeight > 0.3) {
    tags.push(`${sorted[0][0]}-leaning`)
  } else {
    tags.push('balanced')
  }

  // 分散度
  const secondWeight = sorted[1]?.[1] ?? 0
  if (topWeight - secondWeight < 0.05) {
    tags.push('competitive')
  }

  // 极端性
  const bottomWeight = sorted[sorted.length - 1][1]
  if (bottomWeight < 0.05) {
    tags.push('extreme-tail')
  }

  return tags
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "director-api",
  "mode": "OBSERVE"
};

