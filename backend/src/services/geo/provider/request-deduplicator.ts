// ============================================================
// GEO AI Provider — Request Deduplicator
// RC2-T001: GEO AI Provider Infrastructure
//
// Prevents duplicate in-flight requests for the same key.
// - If same key is already in-flight, return the existing promise
// - TTL-based dedup cache for completed requests
// ============================================================

interface DedupEntry {
  promise: Promise<any>
  timestamp: number
}

export class RequestDeduplicator {
  private inFlight = new Map<string, DedupEntry>()
  private completed = new Map<string, { value: any; expiresAt: number }>()
  private defaultTtlMs: number

  constructor(defaultTtlMs: number = 60000) {
    this.defaultTtlMs = defaultTtlMs
  }

  /**
   * Deduplicate a request by key.
   * - If key is in-flight: return the existing promise
   * - If key has a completed (cached) result within TTL: return cached result
   * - Otherwise: execute the factory function
   */
  async deduplicate<T>(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T> {
    // Check completed cache
    const completed = this.completed.get(key)
    if (completed && Date.now() < completed.expiresAt) {
      return completed.value as T
    }

    // Check in-flight requests
    const inFlight = this.inFlight.get(key)
    if (inFlight) {
      return inFlight.promise as Promise<T>
    }

    // Create new request
    const promise = factory().then(
      (result) => {
        // Cache the completed result
        const ttl = ttlMs ?? this.defaultTtlMs
        this.completed.set(key, { value: result, expiresAt: Date.now() + ttl })
        this.inFlight.delete(key)
        return result
      },
      (error) => {
        // On failure, remove from in-flight but don't cache
        this.inFlight.delete(key)
        throw error
      }
    )

    this.inFlight.set(key, { promise, timestamp: Date.now() })

    // Cleanup stale in-flight entries periodically
    this.cleanup()

    return promise as Promise<T>
  }

  /**
   * Invalidate a completed cache entry.
   */
  invalidate(key: string): void {
    this.completed.delete(key)
  }

  /**
   * Clear all in-flight and completed entries.
   */
  clear(): void {
    this.inFlight.clear()
    this.completed.clear()
  }

  /**
   * Get stats.
   */
  stats(): { inFlight: number; completed: number } {
    return {
      inFlight: this.inFlight.size,
      completed: this.completed.size,
    }
  }

  /**
   * Clean up old in-flight and completed entries.
   */
  private cleanup(): void {
    const now = Date.now()

    // Clean completed entries that have expired
    for (const [key, entry] of this.completed) {
      if (now >= entry.expiresAt) {
        this.completed.delete(key)
      }
    }

    // Clean in-flight entries older than 60 seconds (likely stuck)
    for (const [key, entry] of this.inFlight) {
      if (now - entry.timestamp > 60000) {
        this.inFlight.delete(key)
      }
    }
  }
}
