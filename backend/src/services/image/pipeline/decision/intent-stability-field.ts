// ============================================================
// decision/intent-stability-field.ts
//
// 职责：Intent Stability Field（Phase 4.5 + 4.6 增强）
//   观测系统在不同输入扰动下意图是否收敛
//
// Phase 4.6 新增：
//   - conflict→intent 映射矩阵：DCVL 差异模式 → 意图映射表
//   - DSB response curve：压力变化下意图跳变检测
//   - 频率分析：给定时间窗口内的意图稳定性
//   - 快照采样：按 domain 字段分组（若有）
//
// 设计原则：
//   - 纯观测层（不改变 DIE/DCVL/DSB 任何行为）
//   - 不产生新语义（只聚合已有指标）
//   - 不设置阈值（人类观察者判断）
// ============================================================

import type { DirectorIntent, IntentType } from './director-intent-engine.js'
import type { ConsistencyReport, ConsistencyStatus } from './decision-consistency-validation.js'
import type { DSBState } from './decision-stability-buffer.js'

// ─── 快照（全量记录） ──────────────────────────────────

export interface IntentFieldSnapshot {
  timestamp: string
  intent: {
    primary: IntentType
    confidence: number
    suppressedCount: number
  }
  context: {
    divergenceRate: number
    collapsed: boolean
    forcedRatio: number
    dsbStabilityScore: number
    dsbStable: boolean
    consistencyStatus: ConsistencyStatus
  }
}

// ─── Conflict → Intent 映射条目 ───────────────────────

export interface ConflictIntentMapping {
  conflictSignature: string      // divergence profile 指纹
  primaryIntent: IntentType
  count: number
  confidenceAvg: number
}

// ─── DSB 响应曲线 ──────────────────────────────────────

export interface DSBResponseCurve {
  /** DSB 分数滑动窗口均值（最近 5 个采样） */
  rollingScore: number[]
  /** 每个窗口内意图跳变次数 */
  jumpsUnderPressure: number[]
  /** 最近一次 DSB 分数下降后意图是否跟着跳变 */
  lastDropCausedJump: boolean
}

// ─── 频率分析 ──────────────────────────────────────────

export interface IntentFrequencyAnalysis {
  /** 滑动窗口大小 */
  windowSize: number
  /** 窗口中主导意图占比 */
  dominantIntentRatio: number
  /** 窗口中 intent 切换次数 */
  transitions: number
}

// ─── 完整稳定性报告 ────────────────────────────────────

export interface IntentStabilityReport {
  /** 基础指标 */
  totalSamples: number
  intentTypeDriftRate: number
  intentConfidenceVariance: number
  intentTypeDistribution: Record<IntentType, number>
  intentDecisionMismatchRate: number
  /** conflict → intent 映射矩阵 */
  conflictIntentMappings: ConflictIntentMapping[]
  /** DSB 响应曲线 */
  dsbResponse: DSBResponseCurve
  /** 频率分析 */
  frequencyAnalysis: IntentFrequencyAnalysis
  /** 可读摘要 */
  summary: string
}

// ─── 冲突指纹 ──────────────────────────────────────────

function buildConflictFingerprint(
  collapsed: boolean,
  divergenceRate: number,
  forcedRatio: number,
  consistencyStatus: ConsistencyStatus,
): string {
  const parts: string[] = []
  if (collapsed) parts.push('COLLAPSED')
  if (consistencyStatus === 'DIVERGENT') parts.push('DIVERGENT')
  if (forcedRatio > 0.3) parts.push('FORCED')
  if (divergenceRate > 0.3) parts.push('HIGH_DIVERGENCE')
  if (parts.length === 0) parts.push('HEALTHY')
  return parts.join('_')
}

// ─── 稳定场引擎 ────────────────────────────────────────

export class IntentStabilityField {
  private snapshots: IntentFieldSnapshot[] = []
  private readonly MAX_HISTORY = 100
  private readonly WINDOW_SIZE = 10

  private lastIntentType: IntentType | null = null
  private typeChanges = 0
  private dsbScoreHistory: number[] = []

  /**
   * 记录一个采样点
   */
  record(
    intent: DirectorIntent,
    consistency: ConsistencyReport,
    dsb: DSBState,
  ): void {
    const snapshot: IntentFieldSnapshot = {
      timestamp: new Date().toISOString(),
      intent: {
        primary: intent.primary,
        confidence: intent.confidence,
        suppressedCount: intent.suppressedAlternatives.length,
      },
      context: {
        divergenceRate: consistency.divergenceRate,
        collapsed: consistency.ontologyHealth.collapsed,
        forcedRatio: consistency.forcedDecisionAudit.forcedRatio,
        dsbStabilityScore: dsb.stability.score,
        dsbStable: dsb.stability.stable,
        consistencyStatus: consistency.status,
      },
    }

    this.snapshots.push(snapshot)
    if (this.snapshots.length > this.MAX_HISTORY) {
      this.snapshots = this.snapshots.slice(-this.MAX_HISTORY)
    }

    // 追踪 intent type 变化
    if (this.lastIntentType !== null && intent.primary !== this.lastIntentType) {
      this.typeChanges++
    }
    this.lastIntentType = intent.primary

    // 追踪 DSB 分数历史
    this.dsbScoreHistory.push(dsb.stability.score)
    if (this.dsbScoreHistory.length > this.WINDOW_SIZE) {
      this.dsbScoreHistory = this.dsbScoreHistory.slice(-this.WINDOW_SIZE)
    }
  }

  /**
   * 生成当前观察报告
   */
  generateReport(): IntentStabilityReport {
    const total = this.snapshots.length
    if (total === 0) {
      return {
        totalSamples: 0,
        intentTypeDriftRate: 0,
        intentConfidenceVariance: 0,
        intentTypeDistribution: {} as Record<IntentType, number>,
        intentDecisionMismatchRate: 0,
        conflictIntentMappings: [],
        dsbResponse: { rollingScore: [], jumpsUnderPressure: [], lastDropCausedJump: false },
        frequencyAnalysis: { windowSize: this.WINDOW_SIZE, dominantIntentRatio: 0, transitions: 0 },
        summary: '[ISF] 无采样数据',
      }
    }

    // ── 基础指标 ──

    const distribution = this.computeDistribution()
    const typeDriftRate = Math.round((this.typeChanges / Math.max(1, total - 1)) * 100) / 100

    const confidences = this.snapshots.map(s => s.intent.confidence)
    const meanConf = confidences.reduce((a, b) => a + b, 0) / confidences.length
    const variance = Math.round(
      confidences.reduce((a, b) => a + (b - meanConf) ** 2, 0) / confidences.length * 10000
    ) / 10000

    let mismatchCount = 0
    for (const snap of this.snapshots) {
      if (snap.context.dsbStable && snap.intent.primary === 'SUSPEND') mismatchCount++
      if (!snap.context.dsbStable && snap.intent.primary === 'PROCEED') mismatchCount++
    }
    const mismatchRate = Math.round((mismatchCount / total) * 100) / 100

    // ── Conflict → Intent 映射 ──

    const mapping = this.buildConflictIntentMappings()

    // ── DSB 响应曲线 ──

    const dsbCurve = this.buildDSBResponseCurve()

    // ── 频率分析（最近 WINDOW_SIZE 个采样） ──

    const freq = this.computeFrequencyAnalysis()

    return {
      totalSamples: total,
      intentTypeDriftRate: typeDriftRate,
      intentConfidenceVariance: variance,
      intentTypeDistribution: distribution,
      intentDecisionMismatchRate: mismatchRate,
      conflictIntentMappings: mapping,
      dsbResponse: dsbCurve,
      frequencyAnalysis: freq,
      summary: this.buildSummary(typeDriftRate, variance, mismatchRate, mapping, dsbCurve, freq),
    }
  }

  // ── 内部计算 ─────────────────────────────────────────

  private computeDistribution(): Record<IntentType, number> {
    const d: Record<string, number> = {}
    for (const snap of this.snapshots) {
      d[snap.intent.primary] = (d[snap.intent.primary] ?? 0) + 1
    }
    return d as Record<IntentType, number>
  }

  private buildConflictIntentMappings(): ConflictIntentMapping[] {
    const groups = new Map<string, { total: number; intentCounts: Record<string, number>; confSum: number }>()

    for (const snap of this.snapshots) {
      const fingerprint = buildConflictFingerprint(
        snap.context.collapsed,
        snap.context.divergenceRate,
        snap.context.forcedRatio,
        snap.context.consistencyStatus,
      )
      const g = groups.get(fingerprint) ?? { total: 0, intentCounts: {}, confSum: 0 }
      g.total++
      g.intentCounts[snap.intent.primary] = (g.intentCounts[snap.intent.primary] ?? 0) + 1
      g.confSum += snap.intent.confidence
      groups.set(fingerprint, g)
    }

    return Array.from(groups.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([fingerprint, g]) => {
        const dominant = Object.entries(g.intentCounts).sort((a, b) => b[1] - a[1])[0]
        return {
          conflictSignature: fingerprint,
          primaryIntent: dominant?.[0] as IntentType ?? 'PROCEED',
          count: g.total,
          confidenceAvg: Math.round((g.confSum / g.total) * 100) / 100,
        }
      })
  }

  private buildDSBResponseCurve(): DSBResponseCurve {
    if (this.dsbScoreHistory.length < 2) {
      return { rollingScore: [...this.dsbScoreHistory], jumpsUnderPressure: [], lastDropCausedJump: false }
    }

    const scoreWindow = [...this.dsbScoreHistory]
    const jumps: number[] = []
    let lastDropCausedJump = false

    // 检测 DSB 下降 → 意图是否跳变
    for (let i = 1; i < scoreWindow.length; i++) {
      if (scoreWindow[i] < scoreWindow[i - 1] - 0.1) {
        // DSB 显著下降
        if (i < this.snapshots.length) {
          const snapAfterDrop = this.snapshots[this.snapshots.length - 1 - (scoreWindow.length - 1 - i)]
          if (i >= 1 && this.snapshots.length >= 2) {
            const prevIndex = this.snapshots.length - 1 - (scoreWindow.length - 1 - (i - 1))
            const prevSnap = this.snapshots[Math.max(0, prevIndex)]
            if (prevSnap && snapAfterDrop) {
              const jumped = prevSnap.intent.primary !== snapAfterDrop.intent.primary
              jumps.push(jumped ? 1 : 0)
              if (i === scoreWindow.length - 1) lastDropCausedJump = jumped
            }
          }
        }
      }
    }

    return {
      rollingScore: scoreWindow,
      jumpsUnderPressure: jumps,
      lastDropCausedJump,
    }
  }

  private computeFrequencyAnalysis(): IntentFrequencyAnalysis {
    if (this.snapshots.length < 2) {
      return { windowSize: this.WINDOW_SIZE, dominantIntentRatio: 1, transitions: 0 }
    }

    const window = this.snapshots.slice(-this.WINDOW_SIZE)
    const freq: Record<string, number> = {}
    for (const snap of window) {
      freq[snap.intent.primary] = (freq[snap.intent.primary] ?? 0) + 1
    }
    const dominant = Math.max(...Object.values(freq))
    const dominantRatio = Math.round((dominant / window.length) * 100) / 100

    let transitions = 0
    for (let i = 1; i < window.length; i++) {
      if (window[i].intent.primary !== window[i - 1].intent.primary) transitions++
    }

    return { windowSize: window.length, dominantIntentRatio: dominantRatio, transitions }
  }

  // ── 摘要 ─────────────────────────────────────────────

  private buildSummary(
    driftRate: number,
    variance: number,
    mismatchRate: number,
    mappings: ConflictIntentMapping[],
    dsbCurve: DSBResponseCurve,
    freq: IntentFrequencyAnalysis,
  ): string {
    const signals: string[] = []

    if (driftRate > 0.3) signals.push(`意图漂移${(driftRate * 100).toFixed(0)}%`)
    if (variance > 0.1) signals.push(`置信度不稳定 σ²=${variance.toFixed(3)}`)
    if (mismatchRate > 0.2) signals.push(`意图与决策不一致${(mismatchRate * 100).toFixed(0)}%`)
    if (freq.dominantIntentRatio < 0.6) signals.push(`频率窗口主导率仅${(freq.dominantIntentRatio * 100).toFixed(0)}%（切换${freq.transitions}次）`)
    if (dsbCurve.lastDropCausedJump) signals.push('DSB下降导致意图跳变')
    if (dsbCurve.jumpsUnderPressure.filter(Boolean).length > 1) signals.push('DSB压力下多次跳变')
    if (mappings.length > 3) signals.push(`映射矩阵${mappings.length}种冲突指纹（应收敛）`)

    const header = signals.length > 0 ? `[IDF] ⚠️ ${signals.join(' | ')}` : '[IDF] ✅ 意图场稳定'
    return `${header} | 采样${this.snapshots.length}次 | 近${freq.windowSize}次主导${(freq.dominantIntentRatio * 100).toFixed(0)}% | DSB跳变${dsbCurve.jumpsUnderPressure.filter(Boolean).length}次`
  }

  reset(): void {
    this.snapshots = []
    this.lastIntentType = null
    this.typeChanges = 0
    this.dsbScoreHistory = []
  }

  /**
   * 获取所有快照（供 Phase Portrait 消费）
   */
  getSnapshots(): IntentFieldSnapshot[] {
    return [...this.snapshots]
  }
}
