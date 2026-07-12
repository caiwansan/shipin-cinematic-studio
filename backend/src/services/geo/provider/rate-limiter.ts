// ============================================================
// GEO AI Provider — Token Bucket Rate Limiter
// RC2-T001: GEO AI Provider Infrastructure
//
// Simple per-provider token bucket:
// - tokens refilled per second at a configurable rate
// - acquire() returns boolean (true = allowed)
// ============================================================

interface TokenBucketState {
  tokens: number
  lastRefill: number
  maxTokens: number
  refillRatePerSecond: number
}

export class RateLimiter {
  private buckets = new Map<string, TokenBucketState>()

  /**
   * Try to acquire a token for the given provider.
   * @returns true if token acquired, false if rate limited
   */
  acquire(provider: string, ratePerSecond: number = 10): boolean {
    const now = Date.now()
    let bucket = this.buckets.get(provider)

    if (!bucket || bucket.refillRatePerSecond !== ratePerSecond) {
      bucket = {
        tokens: ratePerSecond,
        lastRefill: now,
        maxTokens: ratePerSecond,
        refillRatePerSecond: ratePerSecond,
      }
      this.buckets.set(provider, bucket)
    }

    // Refill tokens based on elapsed time
    const elapsed = (now - bucket.lastRefill) / 1000
    const refillTokens = elapsed * bucket.refillRatePerSecond
    if (refillTokens > 0) {
      bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + refillTokens)
      bucket.lastRefill = now
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      return true
    }

    return false
  }

  /**
   * Get the current state of a provider's token bucket.
   */
  getState(provider: string): { tokens: number; maxTokens: number; refillRatePerSecond: number } | null {
    const bucket = this.buckets.get(provider)
    if (!bucket) return null

    // Refill first
    const elapsed = (Date.now() - bucket.lastRefill) / 1000
    const refillTokens = elapsed * bucket.refillRatePerSecond
    if (refillTokens > 0) {
      bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + refillTokens)
      bucket.lastRefill = Date.now()
    }

    return {
      tokens: bucket.tokens,
      maxTokens: bucket.maxTokens,
      refillRatePerSecond: bucket.refillRatePerSecond,
    }
  }

  /**
   * Reset rate limiter for a provider (or all).
   */
  reset(provider?: string): void {
    if (provider) {
      this.buckets.delete(provider)
    } else {
      this.buckets.clear()
    }
  }
}
