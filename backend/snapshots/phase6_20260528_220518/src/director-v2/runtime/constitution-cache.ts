/**
 * constitution-cache.ts — Last Good Constitution 缓存
 *
 * Dual-Lane Runtime 的关键组件。
 * 当 LLM 超时/失败时，返回"上次成功编译过的 Constitution"，
 * 而不是空白的默认值。
 *
 * 这保证了：
 *   - continuity survives even without LLM
 *   - 多次编译同项目时语义一致性
 *   - 降级不丢身份
 */

import type { StoryConstitution } from '../schema/story-constitution.js'

// ============================================================
// Types
// ============================================================

export interface CachedConstitution {
  constitution: StoryConstitution
  compiledAt: number
  confidence: number
  fullyFromLLM: boolean
  enrichLatencyMs: number
  projectId: string
}

// ============================================================
// Constitution Cache
// ============================================================

export class ConstitutionCache {
  /** projectId → CachedConstitution */
  private cache = new Map<string, CachedConstitution>()
  /** LRU 追踪 */
  private accessOrder: string[] = []
  private maxEntries: number

  constructor(maxEntries = 100) {
    this.maxEntries = maxEntries
  }

  /**
   * 存储编译结果（仅在 confidence >= MIN_CONFIDENCE 时）
   */
  set(
    projectId: string,
    constitution: StoryConstitution,
    meta: {
      confidence: number
      fullyFromLLM: boolean
      enrichLatencyMs: number
    },
  ): boolean {
    if (meta.confidence < 0.3) return false

    const entry: CachedConstitution = {
      constitution,
      compiledAt: Date.now(),
      confidence: meta.confidence,
      fullyFromLLM: meta.fullyFromLLM,
      enrichLatencyMs: meta.enrichLatencyMs,
      projectId,
    }

    this.cache.set(projectId, entry)
    this.touch(projectId)
    this.evict()
    return true
  }

  /**
   * 获取上一次成功的 Constitution
   * @returns 如果从未编译过返回 null
   */
  get(projectId: string): CachedConstitution | null {
    const entry = this.cache.get(projectId)
    if (!entry) return null
    this.touch(projectId)
    return entry
  }

  /**
   * 存在且置信度 >= threshold？
   */
  hasValid(projectId: string, threshold = 0.5): boolean {
    const entry = this.cache.get(projectId)
    if (!entry) return false
    return entry.confidence >= threshold
  }

  /**
   * 清除特定项目的缓存
   */
  invalidate(projectId: string): void {
    this.cache.delete(projectId)
    this.accessOrder = this.accessOrder.filter(id => id !== projectId)
  }

  /**
   * 获取缓存统计
   */
  stats(): { entries: number; projectIds: string[]; oldestAge: number | null } {
    const now = Date.now()
    let oldestAge: number | null = null
    for (const entry of this.cache.values()) {
      const age = now - entry.compiledAt
      if (oldestAge === null || age > oldestAge) oldestAge = age
    }
    return {
      entries: this.cache.size,
      projectIds: Array.from(this.cache.keys()),
      oldestAge,
    }
  }

  // ===== Private =====

  private touch(projectId: string): void {
    this.accessOrder = this.accessOrder.filter(id => id !== projectId)
    this.accessOrder.push(projectId)
  }

  private evict(): void {
    while (this.cache.size > this.maxEntries) {
      const oldest = this.accessOrder.shift()
      if (oldest) this.cache.delete(oldest)
    }
  }
}

/** 全局单例 */
export const constitutionCache = new ConstitutionCache()
