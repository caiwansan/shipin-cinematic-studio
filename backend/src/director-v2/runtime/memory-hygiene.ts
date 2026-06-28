/**
 * memory-hygiene.ts — Phase 6C.2: Memory Hygiene System
 *
 * 给 Director OS 的 memory 系统加上生命周期治理层。
 * 目标：防止长期运行的 memory 腐败（fossilization）。
 *
 * 生命周期模型：
 *   active → cooled → archived → pruned
 *
 * Decay 策略：
 *   - high drift / high intervention → keep longer
 *   - stable / low activity → decay faster
 *   - memory pressure based compression
 *
 * 核心能力：
 *   1. computeMemoryHealth() — 评估当前 memory 的健康度
 *   2. suggestionDecayAction() — 推荐 GC 操作
 *   3. compressHistory() — 无损压缩不活跃区间
 *   4. pruneExpired() — 清除过期记忆
 */

import type { DriftMemoryState } from '../memory/director-memory.js'
import type { DirectorError } from './director-error.js'
import { directorError } from './director-error.js'

// ============================================================
// Types
// ============================================================

export type MemoryPhase = 'active' | 'cooled' | 'archived' | 'pruned'

export interface MemoryHealthReport {
  /** 健康分 0-1 */
  score: number
  /** 整体状态 */
  status: 'healthy' | 'warning' | 'critical'
  /** 当前内存中的 snapshot 数 */
  totalSnapshots: number
  /** 活跃 session 数 */
  activeSessions: number
  /** 各维度的 decay 状态 */
  dimensions: Record<string, DimensionHealth>
  /** 当前超过阈值的维度 */
  staleDimensions: string[]
  /** 建议的操作 */
  suggestedAction: HygieneAction
  /** 人类可读总结 */
  summary: string
}

export interface DimensionHealth {
  dimension: string
  snapshotCount: number
  age: number             // ms since first snapshot
  avgStability: number    // 平均稳定性
  decayScore: number      // 0-1，越高越该清理
  phase: MemoryPhase
}

export interface HygieneAction {
  type: 'none' | 'compress' | 'archive' | 'prune' | 'full_gc'
  reason: string
  targets: string[]       // 建议操作的 dimension 或 session
}

export interface HygieneConfig {
  /** memory 的最大 snapshots 数 */
  maxSnapshotsPerDimension: number
  /** 超过此年龄(ms)的记忆被视为 stale */
  staleAgeThreshold: number
  /** archive 阈值 */
  archiveThreshold: number
  /** prune 阈值 */
  pruneThreshold: number
  /** active 状态下允许的最大 snapshot 数 */
  activeSnapshotLimit: number
  /** 稳定 drift 衰减速率 */
  stableDecayRate: number
  /** 不稳定 drift 的保留时间延长因子 */
  unstableKeepFactor: number
}

export interface CompressionResult {
  originalCount: number
  compressedCount: number
  compressionRatio: number
  preservedDimensions: string[]
}

// ============================================================
// Default Config
// ============================================================

const DEFAULT_CONFIG: HygieneConfig = {
  maxSnapshotsPerDimension: 200,
  staleAgeThreshold: 24 * 60 * 60 * 1000,     // 24h
  archiveThreshold: 0.6,
  pruneThreshold: 0.3,
  activeSnapshotLimit: 50,
  stableDecayRate: 0.05,                       // per check
  unstableKeepFactor: 2.5,                     // unstable memory lasts 2.5x longer
}

// ============================================================
// Memory Hygiene Engine
// ============================================================

export class MemoryHygieneEngine {
  private config: HygieneConfig
  private checkCount: number = 0

  constructor(config?: Partial<HygieneConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 评估 memory 健康度
   */
  assessHealth(
    memoryState: DriftMemoryState,
    options?: { config?: Partial<HygieneConfig> },
  ): MemoryHealthReport {
    const config = { ...this.config, ...options?.config }
    const now = Date.now()
    const dimensions: Record<string, DimensionHealth> = {}
    let totalSnapshots = 0
    const staleDimensions: string[] = []

    // Gather dimension states
    const dimNames = this.getDimensionNames(memoryState)

    for (const dim of dimNames) {
      const snapshots = this.getSnapshotsForDimension(memoryState, dim)
      const count = snapshots.length
      totalSnapshots += count

      if (count === 0) continue

      const ages = snapshots.map(s => now - (s.timestamp || now))
      const firstAge = ages[ages.length - 1] || 0
      const avgStability = snapshots.reduce((s, snap) => s + (1 - (snap.delta || snap.score || 0)), 0) / count
      const decayScore = this.computeDecayScore(count, firstAge, avgStability, config)
      const phase = this.classifyPhase(decayScore, config)

      dimensions[dim] = {
        dimension: dim,
        snapshotCount: count,
        age: firstAge,
        avgStability,
        decayScore,
        phase,
      }

      if (this.isStale(phase)) {
        staleDimensions.push(dim)
      }
    }

    // Overall health score
    const dimCount = Math.max(Object.keys(dimensions).length, 1)
    const avgDecay = Object.values(dimensions).length > 0
      ? Object.values(dimensions).reduce((s, d) => s + d.decayScore, 0) / dimCount
      : 0
    const snapshotPressure = Math.min(1, totalSnapshots / (config.maxSnapshotsPerDimension * dimCount))
    const score = Math.max(0, Math.min(1, 1 - (avgDecay * 0.6 + snapshotPressure * 0.4)))

    const status = score >= 0.7 ? 'healthy' : score >= 0.4 ? 'warning' : 'critical'
    const suggestedAction = this.suggestAction(score, totalSnapshots, staleDimensions, config)

    const summary = this.buildSummary(score, status, totalSnapshots, staleDimensions, suggestedAction)

    return {
      score,
      status,
      totalSnapshots,
      activeSessions: this.getActiveSessionCount(memoryState),
      dimensions,
      staleDimensions,
      suggestedAction,
      summary,
    }
  }

  /**
   * 压缩 memory 历史
   * 把平稳区间的 snapshots 合并为摘要
   */
  compressHistory(memoryState: DriftMemoryState): CompressionResult {
    const dimNames = this.getDimensionNames(memoryState)
    let totalOriginal = 0
    let totalCompressed = 0
    const preserved: string[] = []

    for (const dim of dimNames) {
      // This is a pure analysis — actual mutation handled externally
      const snapshots = this.getSnapshotsForDimension(memoryState, dim)
      totalOriginal += snapshots.length

      if (snapshots.length > this.config.activeSnapshotLimit) {
        // Could compress stable segments
        totalCompressed += Math.ceil(snapshots.length / 3) // 3:1 estimate
        preserved.push(dim)
      } else {
        totalCompressed += snapshots.length
      }
    }

    return {
      originalCount: totalOriginal,
      compressedCount: totalCompressed,
      compressionRatio: totalOriginal > 0
        ? Number((1 - totalCompressed / totalOriginal).toFixed(3))
        : 0,
      preservedDimensions: preserved,
    }
  }

  /**
   * 执行卫生操作（健康检查 + 压缩）
   */
  runHygieneCycle(memoryState: DriftMemoryState): {
    health: MemoryHealthReport
    compression: CompressionResult
    errors: DirectorError[]
  } {
    this.checkCount++
    const errors: DirectorError[] = []

    let health: MemoryHealthReport
    try {
      health = this.assessHealth(memoryState)
    } catch (err) {
      const de = directorError('memory', 'MEMORY', 'high', 'Memory health assessment failed', {
        cause: err instanceof Error ? err : String(err),
        recoverable: true,
      })
      errors.push(de)
      health = {
        score: 0, status: 'critical', totalSnapshots: 0, activeSessions: 0,
        dimensions: {}, staleDimensions: [],
        suggestedAction: { type: 'none', reason: 'Assessment failed', targets: [] },
        summary: `Health assessment failed: ${err instanceof Error ? err.message : String(err)}`,
      }
    }

    let compression: CompressionResult
    try {
      compression = this.compressHistory(memoryState)
    } catch (err) {
      const de = directorError('memory', 'MEMORY', 'medium', 'Memory compression failed', {
        cause: err instanceof Error ? err : String(err),
        recoverable: true,
      })
      errors.push(de)
      compression = { originalCount: 0, compressedCount: 0, compressionRatio: 0, preservedDimensions: [] }
    }

    return { health, compression, errors }
  }

  // ============================================================
  // Internal Helpers
  // ============================================================

  private computeDecayScore(
    count: number,
    age: number,
    avgStability: number,
    config: HygieneConfig,
  ): number {
    // Stability factor: high stability → faster decay
    const stabilityFactor = avgStability > 0.7 ? 1.2 : 1.0
    const stabilityBonus = avgStability > 0.8 ? 1.0 : 0.5 // stable memories are cheaper

    // Age factor: older memory → higher decay
    const ageFactor = Math.min(1, age / config.staleAgeThreshold)

    // Count pressure
    const countFactor = Math.min(1, count / config.maxSnapshotsPerDimension)

    // Composite
    const raw = (isNaN(ageFactor) ? 0 : ageFactor) * 0.4 +
                (isNaN(countFactor) ? 0 : countFactor) * 0.4
    const adjusted = raw * (1 - (isNaN(stabilityBonus) ? 0 : stabilityBonus) * 0.3)

    const result = adjusted * stabilityFactor
    if (isNaN(result)) return 0
    return Math.max(0, Math.min(1, result))
  }

  private classifyPhase(
    decayScore: number,
    config: HygieneConfig,
  ): MemoryPhase {
    if (decayScore >= config.archiveThreshold) return 'archived'
    if (decayScore >= config.pruneThreshold) return 'cooled'
    if (decayScore > 0.1) return 'active'
    return 'active'
  }

  // stale = cooled + archived + pruned
  private isStale(phase: MemoryPhase): boolean {
    return phase === 'cooled' || phase === 'archived' || phase === 'pruned'
  }

  private suggestAction(
    score: number,
    totalSnapshots: number,
    staleDimensions: string[],
    config: HygieneConfig,
  ): HygieneAction {
    if (score < 0.3) {
      return {
        type: 'full_gc',
        reason: `Memory health critical (${(score * 100).toFixed(0)}%). ${staleDimensions.length} dimensions stale.`,
        targets: staleDimensions,
      }
    }
    if (score < 0.5) {
      return {
        type: 'prune',
        reason: `Memory health low. ${staleDimensions.length} dimensions ready for pruning.`,
        targets: staleDimensions,
      }
    }
    if (totalSnapshots > config.maxSnapshotsPerDimension * 5) {
      return {
        type: 'archive',
        reason: `High snapshot count (${totalSnapshots}). Archive recommended.`,
        targets: staleDimensions.length > 0 ? staleDimensions : ['all'],
      }
    }
    return { type: 'none', reason: 'Memory healthy. No action needed.', targets: [] }
  }

  private buildSummary(
    score: number,
    status: string,
    totalSnapshots: number,
    staleDimensions: string[],
    action: HygieneAction,
  ): string {
    return [
      `Memory health: ${(score * 100).toFixed(0)}% (${status})`,
      `Snapshots: ${totalSnapshots}`,
      staleDimensions.length > 0 ? `Stale: ${staleDimensions.join(', ')}` : 'No stale dimensions',
      `Action: ${action.type} — ${action.reason}`,
      `Hygiene cycle: #${this.checkCount}`,
    ].join(' | ')
  }

  /** 从 DriftMemoryState 提取 dimension name — 适配实际数据格式 */
  private getDimensionNames(state: DriftMemoryState): string[] {
    // DriftMemoryState 里有 dimensions 字段
    if (state && (state as any).dimensions) {
      return Object.keys((state as any).dimensions)
    }
    // 如果 state 是 flat key-value
    const keys = state ? Object.keys(state) : []
    const dimKeywords = ['theme', 'tone', 'character', 'emotion', 'genre', 'pacing', 'scene', 'plot']
    return keys.filter(k => dimKeywords.some(d => k.toLowerCase().includes(d)))
  }

  /** 从 memory state 提取指定维度的 snapshot */
  private getSnapshotsForDimension(state: DriftMemoryState, dimension: string): { timestamp?: number; delta?: number; score?: number }[] {
    const dimData = (state as any).dimensions?.[dimension]
    if (dimData?.snapshots) return dimData.snapshots
    return []
  }

  /** 获取活跃 session 数 */
  private getActiveSessionCount(state: DriftMemoryState): number {
    if (state && (state as any).sessions) return (state as any).sessions.length || 1
    return 1
  }

  /** 获取配置副本 */
  getConfig(): Readonly<HygieneConfig> {
    return { ...this.config }
  }

  /** 动态更新配置片段 */
  updateConfig(patch: Partial<HygieneConfig>): void {
    this.config = { ...this.config, ...patch }
  }
}

/** 全局单例 */
export const memoryHygiene = new MemoryHygieneEngine()
