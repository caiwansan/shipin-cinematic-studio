// ============================================================
// GEO AI Provider — Observability & Metrics
// RC2-T001: GEO AI Provider Infrastructure
//
// Collects rolling window metrics per provider+capability:
// - latency (p50, p95, p99, avg)
// - success/error/timeout/retry rates
// - cache hit rate
// - token usage & cost
//
// Rolling window: last 1000 events or last 5 minutes
// ============================================================

import { ProviderEvent, ProviderName, GeoCapability, ProviderMetrics } from './types'

interface MetricRecord {
  event: ProviderEvent
  timestamp: number
}

export class ProviderObservability {
  private records: MetricRecord[] = []
  private maxRecords: number = 1000
  private windowMs: number = 5 * 60 * 1000 // 5 minutes

  /**
   * Record an event.
   */
  recordEvent(event: ProviderEvent): void {
    this.records.push({ event, timestamp: Date.now() })
    this.prune()
  }

  /**
   * Get metrics for all providers or a specific one.
   */
  getMetrics(providerName?: ProviderName): ProviderMetrics {
    this.prune()
    const records = providerName
      ? this.records.filter(r => r.event.provider === providerName)
      : this.records

    const allLatencies = records.map(r => r.event.latencyMs)
    const successRecords = records.filter(r => r.event.success)
    const failureRecords = records.filter(r => !r.event.success)
    const timeoutRecords = records.filter(r => r.event.error?.includes('timeout'))
    const retryRecords = records.filter(r => r.event.retryCount > 0)
    const cacheHitRecords = records.filter(r => r.event.cached)

    // Collect by provider
    const byProvider: Record<string, any> = {}
    const providers = new Set(records.map(r => r.event.provider))
    for (const p of providers) {
      const pRecords = records.filter(r => r.event.provider === p)
      const pLatencies = pRecords.map(r => r.event.latencyMs)
      const pSuccess = pRecords.filter(r => r.event.success)
      const pCacheHits = pRecords.filter(r => r.event.cached)

      byProvider[p] = {
        totalRequests: pRecords.length,
        successCount: pSuccess.length,
        failureCount: pRecords.length - pSuccess.length,
        latencyMs: this.calculatePercentiles(pLatencies),
        successRate: pRecords.length > 0 ? pSuccess.length / pRecords.length : 1,
        cacheHitRate: pRecords.length > 0 ? pCacheHits.length / pRecords.length : 0,
      }
    }

    // Calculate token usage
    const tokenUsage = records.reduce(
      (acc, r) => {
        if (r.event.tokenUsage) {
          acc.prompt += r.event.tokenUsage.prompt
          acc.completion += r.event.tokenUsage.completion
          acc.total += r.event.tokenUsage.total
        }
        return acc
      },
      { prompt: 0, completion: 0, total: 0 }
    )

    // Calculate cost
    const cost = records.reduce((sum, r) => sum + (r.event.cost ?? 0), 0)

    const total = records.length
    return {
      totalRequests: total,
      successCount: successRecords.length,
      failureCount: failureRecords.length,
      timeoutCount: timeoutRecords.length,
      retryCount: retryRecords.length,
      cacheHits: cacheHitRecords.length,
      cacheMisses: total - cacheHitRecords.length,
      tokenUsage,
      cost,
      latencyMs: this.calculatePercentiles(allLatencies),
      successRate: total > 0 ? successRecords.length / total : 1,
      errorRate: total > 0 ? failureRecords.length / total : 0,
      timeoutRate: total > 0 ? timeoutRecords.length / total : 0,
      retryRate: total > 0 ? retryRecords.length / total : 0,
      cacheHitRate: total > 0 ? cacheHitRecords.length / total : 0,
      byProvider,
    }
  }

  /**
   * Reset all metrics.
   */
  reset(): void {
    this.records = []
  }

  /**
   * Prune old records beyond the window.
   */
  private prune(): void {
    const cutoff = Date.now() - this.windowMs
    this.records = this.records.filter(r => r.timestamp >= cutoff)

    // Also cap by max records
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords)
    }
  }

  /**
   * Calculate latency percentiles.
   */
  private calculatePercentiles(latencies: number[]): { p50: number; p95: number; p99: number; avg: number } {
    if (latencies.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0 }
    }

    const sorted = [...latencies].sort((a, b) => a - b)
    const avg = latencies.reduce((sum, l) => sum + l, 0) / latencies.length

    const p50Idx = Math.floor(sorted.length * 0.5)
    const p95Idx = Math.floor(sorted.length * 0.95)
    const p99Idx = Math.floor(sorted.length * 0.99)

    return {
      p50: sorted[Math.min(p50Idx, sorted.length - 1)] ?? 0,
      p95: sorted[Math.min(p95Idx, sorted.length - 1)] ?? 0,
      p99: sorted[Math.min(p99Idx, sorted.length - 1)] ?? 0,
      avg: Math.round(avg * 100) / 100,
    }
  }
}
