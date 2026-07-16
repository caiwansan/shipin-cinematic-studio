/**
 * P4.2.5.2-IMP-01.2 — Token Cache (Tenant-Isolated)
 * 
 * 内存级 Token 缓存 — 租户隔离 + TTL 过期 + 并发安全
 * 
 * 设计原则:
 * - 每个租户独立的 Token 条目 (tenantId → TokenEntry)
 * - 所有租户共享同一 Cache 实例 (全局单例)
 * - Token 提前 5 分钟触发刷新
 * - 并发请求只刷新一次 (Promise 复用)
 */

// ─── Token Cache Types ─────────────────────────────────────

export interface TokenEntry {
  token: string
  expiresAt: number // epoch ms
  createdAt: number
  refreshPromise: Promise<string> | null
}

export interface TokenCacheStats {
  totalEntries: number
  tenantIds: string[]
  hits: number
  misses: number
  refreshes: number
}

// ─── Token Cache (Singleton) ───────────────────────────────

export class TokenCache {
  private cache: Map<string, TokenEntry> = new Map()
  private stats = { hits: 0, misses: 0, refreshes: 0 }

  /**
   * 获取缓存 Token
   * @param tenantId 租户 ID
   * @param refreshCallback 缓存失效时的刷新回调
   * @param preloadMs 提前多少 ms 刷新 (默认 5 分钟)
   * @returns Token 字符串，或 null（需要刷新）
   */
  get(
    tenantId: string,
    refreshCallback: () => Promise<{ token: string; expiresAt: number }>,
    preloadMs: number = 5 * 60 * 1000
  ): string | null {
    const entry = this.cache.get(tenantId)

    if (!entry) {
      this.stats.misses++
      return null
    }

    // Token 已过期
    if (Date.now() >= entry.expiresAt) {
      this.stats.misses++
      return null
    }

    // Token 在 preloadMs 内即将过期 → 触发异步刷新但不阻塞返回
    if (Date.now() >= entry.expiresAt - preloadMs) {
      if (!entry.refreshPromise) {
        this.refreshAsync(tenantId, refreshCallback)
      }
      // 返回旧 Token（仍然有效）
    }

    this.stats.hits++
    return entry.token
  }

  /**
   * 获取某个租户的刷新 Promise（用于并发控制）
   */
  getRefreshPromise(tenantId: string): Promise<string> | null {
    return this.cache.get(tenantId)?.refreshPromise ?? null
  }

  /**
   * 设置 Token
   */
  set(tenantId: string, token: string, expiresAt: number): void {
    const existing = this.cache.get(tenantId)
    this.cache.set(tenantId, {
      token,
      expiresAt,
      createdAt: Date.now(),
      refreshPromise: existing?.refreshPromise ?? null, // 保留现有 refreshPromise
    })
  }

  /**
   * 设置某个租户的刷新 Promise
   */
  setRefreshPromise(tenantId: string, promise: Promise<string> | null): void {
    const entry = this.cache.get(tenantId)
    if (entry) {
      entry.refreshPromise = promise
    }
  }

  /**
   * 使某个租户的 Token 失效（401 等错误时调用）
   */
  invalidate(tenantId: string): void {
    this.cache.delete(tenantId)
  }

  /**
   * 清除所有缓存
   */
  clearAll(): void {
    this.cache.clear()
    this.stats = { hits: 0, misses: 0, refreshes: 0 }
  }

  /**
   * 获取统计信息
   */
  getStats(): TokenCacheStats {
    return {
      totalEntries: this.cache.size,
      tenantIds: Array.from(this.cache.keys()),
      ...this.stats,
    }
  }

  /**
   * 异步刷新（不阻塞当前请求）
   */
  private async refreshAsync(
    tenantId: string,
    refreshCallback: () => Promise<{ token: string; expiresAt: number }>
  ): Promise<void> {
    // 复用已有刷新 Promise
    const existing = this.getRefreshPromise(tenantId)
    if (existing) {
      await existing
      return
    }

    this.stats.refreshes++
    const promise = this.doRefresh(tenantId, refreshCallback)
    this.setRefreshPromise(tenantId, promise)
    try {
      await promise
    } finally {
      this.setRefreshPromise(tenantId, null)
    }
  }

  /**
   * 执行刷新
   */
  private async doRefresh(
    tenantId: string,
    refreshCallback: () => Promise<{ token: string; expiresAt: number }>
  ): Promise<string> {
    const { token, expiresAt } = await refreshCallback()
    this.set(tenantId, token, expiresAt)
    return token
  }
}

// ─── Singleton Export ──────────────────────────────────────

export const tokenCache = new TokenCache()
