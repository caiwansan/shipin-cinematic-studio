// ============================================================
// GEO AI Provider — TTL-based In-Memory Cache
// RC2-T001: GEO AI Provider Infrastructure
//
// Thread-safe: uses Map + timer-based expiry
// ============================================================

interface CacheEntry<T> {
  value: T
  expiresAt: number
  timer: ReturnType<typeof setTimeout> | null
}

export class Cache {
  private store = new Map<string, CacheEntry<any>>()
  private hits = 0
  private misses = 0
  private defaultTtlMs: number

  constructor(defaultTtlMs: number = 60000) {
    this.defaultTtlMs = defaultTtlMs
  }

  /**
   * Set a cache entry with TTL in milliseconds.
   * Returns the value for chaining.
   */
  set<T>(key: string, value: T, ttlMs?: number): T {
    this.evictExpired()

    const existing = this.store.get(key)
    if (existing && existing.timer) {
      clearTimeout(existing.timer)
    }

    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs)
    const timer = setTimeout(() => {
      this.store.delete(key)
    }, ttlMs ?? this.defaultTtlMs)

    // Allow the timer to not keep the process alive
    if (timer.unref) {
      timer.unref()
    }

    this.store.set(key, { value, expiresAt, timer })
    return value
  }

  /**
   * Get a cache entry. Returns undefined if not found or expired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) {
      this.misses++
      return undefined
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      this.misses++
      return undefined
    }

    this.hits++
    return entry.value as T
  }

  /**
   * Remove a specific key from cache.
   */
  invalidate(key: string): void {
    const entry = this.store.get(key)
    if (entry) {
      if (entry.timer) clearTimeout(entry.timer)
      this.store.delete(key)
    }
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    for (const [, entry] of this.store) {
      if (entry.timer) clearTimeout(entry.timer)
    }
    this.store.clear()
    this.hits = 0
    this.misses = 0
  }

  /**
   * Get cache stats.
   */
  stats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    }
  }

  /**
   * Get or set cache entry via factory function.
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== undefined) {
      return cached
    }
    const value = await factory()
    this.set(key, value, ttlMs)
    return value
  }

  /**
   * Evict expired entries.
   */
  private evictExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        if (entry.timer) clearTimeout(entry.timer)
        this.store.delete(key)
      }
    }
  }
}
