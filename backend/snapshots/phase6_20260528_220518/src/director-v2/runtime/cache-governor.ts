/**
 * cache-governor.ts — Constitution Cache Validity Controller
 *
 * 防止 semantic fossilization（语义化石化）。
 * Cache 不是永远有效的，必须基于 quality × time × drift 动态判断。
 *
 * 失效条件：
 *   1. 时间 > TTL（默认 24h）
 *   2. 置信度 < threshold（默认 0.5）
 *   3. 连续 N 次 fallback 触发（默认 5 次）
 *   4. 手动失效
 */

import type { CachedConstitution } from './constitution-cache.js'

// ============================================================
// Types
// ============================================================

export interface CacheHealth {
  valid: boolean
  reason: string
  age: number           // ms since cached
  quality: number       // 0-1
  fallbackChain: number
  projectedDecay: number  // 预测质量衰减率
}

export interface CacheGovernorConfig {
  /** 默认 TTL (ms) */
  ttlMs: number
  /** 最低置信度 */
  minConfidence: number
  /** 连续 fallback 最大次数 */
  maxFallbackChain: number
  /** 每小时的置信度衰减 */
  decayPerHour: number
}

const DEFAULT_CONFIG: CacheGovernorConfig = {
  ttlMs: 24 * 60 * 60 * 1000,  // 24h
  minConfidence: 0.5,
  maxFallbackChain: 5,
  decayPerHour: 0.05,           // 每小时降低 0.05 置信度
}

// ============================================================
// Cache Governor
// ============================================================

export class CacheGovernor {
  private config: CacheGovernorConfig
  /** projectId → 连续 fallback 次数 */
  private fallbackCounters = new Map<string, number>()

  constructor(config?: Partial<CacheGovernorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 检查缓存是否有效（综合 health 评估）
   */
  assess(entry: CachedConstitution): CacheHealth {
    const now = Date.now()
    const age = now - entry.compiledAt
    const fallbackChain = this.fallbackCounters.get(entry.projectId) || 0

    // ===== 1. Time check =====
    if (age > this.config.ttlMs) {
      return {
        valid: false,
        reason: `TTL expired: ${Math.round(age / 3600000)}h > ${Math.round(this.config.ttlMs / 3600000)}h`,
        age,
        quality: 0,
        fallbackChain,
        projectedDecay: 1,
      }
    }

    // ===== 2. Confidence check =====
    let adjustedConfidence = entry.confidence

    // 时间衰减
    const hoursPassed = age / 3600000
    const decay = hoursPassed * this.config.decayPerHour
    adjustedConfidence = Math.max(0, adjustedConfidence - decay)

    // Fallback 链衰减
    if (fallbackChain > 0) {
      adjustedConfidence -= fallbackChain * 0.1
    }

    // 非 LLM 来源轻微惩罚（but not too aggressive）
    if (!entry.fullyFromLLM) {
      adjustedConfidence -= 0.1
    }

    adjustedConfidence = Math.max(0, Math.min(adjustedConfidence, 1))

    if (adjustedConfidence < this.config.minConfidence) {
      return {
        valid: false,
        reason: `Confidence decayed to ${adjustedConfidence.toFixed(2)} (< ${this.config.minConfidence})`,
        age,
        quality: adjustedConfidence,
        fallbackChain,
        projectedDecay: decay,
      }
    }

    // ===== 3. Fallback chain check =====
    if (fallbackChain > this.config.maxFallbackChain) {
      return {
        valid: false,
        reason: `Max fallback chain (${fallbackChain} > ${this.config.maxFallbackChain})`,
        age,
        quality: adjustedConfidence,
        fallbackChain,
        projectedDecay: decay,
      }
    }

    return {
      valid: true,
      reason: `Healthy (conf=${adjustedConfidence.toFixed(2)}, age=${Math.round(hoursPassed * 10) / 10}h)`,
      age,
      quality: adjustedConfidence,
      fallbackChain,
      projectedDecay: decay,
    }
  }

  /**
   * 记录一次 fallback 使用
   */
  recordFallback(projectId: string): number {
    const current = this.fallbackCounters.get(projectId) || 0
    const next = current + 1
    this.fallbackCounters.set(projectId, next)
    return next
  }

  /**
   * 成功 enrichment 后重置 fallback 计数器
   */
  resetFallbackCounter(projectId: string): void {
    this.fallbackCounters.delete(projectId)
  }

  /**
   * 获取 project 的缓存健康摘要
   */
  summary(entry: CachedConstitution): string {
    const health = this.assess(entry)
    return [
      `[Cache] ${entry.projectId}`,
      `  age: ${Math.round((Date.now() - entry.compiledAt) / 3600000 * 10) / 10}h`,
      `  conf: ${entry.confidence} → adjusted ${health.quality.toFixed(2)}`,
      `  source: ${entry.fullyFromLLM ? 'LLM' : 'skeleton'}`,
      `  fallback chain: ${health.fallbackChain}`,
      `  status: ${health.valid ? '✅ VALID' : '❌ ' + health.reason}`,
    ].join('\n')
  }
}

/** 全局单例 */
export const cacheGovernor = new CacheGovernor()
