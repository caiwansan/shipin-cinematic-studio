// ============================================================
// Execution Metrics Repository — Metrics aggregation
// ============================================================

import type { ExecutionMetrics, ExecutionResult } from '../types.js'
import type { PlatformContext } from '@platform/context/platform-context'

interface AggregatedMetrics {
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  cancelledExecutions: number
  averageDurationMs: number
  totalCost: number
  totalRetries: number
  byCapability: Map<string, {
    count: number
    failures: number
    averageDurationMs: number
  }>
  byStrategy: Map<string, {
    count: number
    failures: number
    averageDurationMs: number
  }>
}

const metricsStore = new Map<string, ExecutionMetrics[]>()
const aggregatedMetrics: AggregatedMetrics = {
  totalExecutions: 0,
  successfulExecutions: 0,
  failedExecutions: 0,
  cancelledExecutions: 0,
  averageDurationMs: 0,
  totalCost: 0,
  totalRetries: 0,
  byCapability: new Map(),
  byStrategy: new Map(),
}

export const executionMetricsRepository = {
  /**
   * Record metrics from an execution result.
   */
  async record(result: ExecutionResult, _ctx?: PlatformContext): Promise<void> {
    // Store individual metrics
    if (!metricsStore.has(result.capabilityId)) {
      metricsStore.set(result.capabilityId, [])
    }
    metricsStore.get(result.capabilityId)!.push(result.metrics)

    // Update aggregated
    aggregatedMetrics.totalExecutions++
    if (result.status === 'completed') aggregatedMetrics.successfulExecutions++
    else if (result.status === 'failed') aggregatedMetrics.failedExecutions++
    else if (result.status === 'cancelled') aggregatedMetrics.cancelledExecutions++

    aggregatedMetrics.totalRetries += result.metrics.retryCount

    if (result.metrics.totalCost) {
      aggregatedMetrics.totalCost += result.metrics.totalCost
    }

    // Update by capability
    const capStats = aggregatedMetrics.byCapability.get(result.capabilityId) || { count: 0, failures: 0, averageDurationMs: 0 }
    capStats.count++
    if (result.status === 'failed') capStats.failures++
    capStats.averageDurationMs = ((capStats.averageDurationMs * (capStats.count - 1)) + (result.durationMs || 0)) / capStats.count
    aggregatedMetrics.byCapability.set(result.capabilityId, capStats)

    // Update by strategy
    const strat = result.metrics.strategyUsed
    const stratStats = aggregatedMetrics.byStrategy.get(strat) || { count: 0, failures: 0, averageDurationMs: 0 }
    stratStats.count++
    if (result.status === 'failed') stratStats.failures++
    stratStats.averageDurationMs = ((stratStats.averageDurationMs * (stratStats.count - 1)) + (result.durationMs || 0)) / stratStats.count
    aggregatedMetrics.byStrategy.set(strat, stratStats)

    // Recalculate average
    if (aggregatedMetrics.totalExecutions > 0) {
      const totalDuration = Array.from(metricsStore.values())
        .flat()
        .reduce((sum, m) => sum + m.totalDurationMs, 0)
      aggregatedMetrics.averageDurationMs = totalDuration / aggregatedMetrics.totalExecutions
    }
  },

  /**
   * Get global aggregated metrics.
   */
  async getGlobal(_ctx?: PlatformContext): Promise<{
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    cancelledExecutions: number
    averageDurationMs: number
    totalCost: number
    totalRetries: number
  }> {
    return {
      totalExecutions: aggregatedMetrics.totalExecutions,
      successfulExecutions: aggregatedMetrics.successfulExecutions,
      failedExecutions: aggregatedMetrics.failedExecutions,
      cancelledExecutions: aggregatedMetrics.cancelledExecutions,
      averageDurationMs: aggregatedMetrics.averageDurationMs,
      totalCost: aggregatedMetrics.totalCost,
      totalRetries: aggregatedMetrics.totalRetries,
    }
  },

  /**
   * Get metrics for a specific capability.
   */
  async getByCapabilityId(capabilityId: string, _ctx?: PlatformContext): Promise<{
    count: number
    failures: number
    averageDurationMs: number
    recentMetrics: ExecutionMetrics[]
  }> {
    const capMetrics = metricsStore.get(capabilityId) || []
    const capStats = aggregatedMetrics.byCapability.get(capabilityId) || { count: 0, failures: 0, averageDurationMs: 0 }

    return {
      count: capStats.count,
      failures: capStats.failures,
      averageDurationMs: capStats.averageDurationMs,
      recentMetrics: capMetrics.slice(-10),
    }
  },

  /**
   * Get metrics by strategy.
   */
  async getByStrategy(_ctx?: PlatformContext): Promise<Record<string, { count: number; failures: number; averageDurationMs: number }>> {
    const result: Record<string, { count: number; failures: number; averageDurationMs: number }> = {}
    for (const [strategy, stats] of aggregatedMetrics.byStrategy) {
      result[strategy] = { ...stats }
    }
    return result
  },

  /**
   * Clear all metrics (for testing).
   */
  async clear(_ctx?: PlatformContext): Promise<void> {
    metricsStore.clear()
    aggregatedMetrics.totalExecutions = 0
    aggregatedMetrics.successfulExecutions = 0
    aggregatedMetrics.failedExecutions = 0
    aggregatedMetrics.cancelledExecutions = 0
    aggregatedMetrics.averageDurationMs = 0
    aggregatedMetrics.totalCost = 0
    aggregatedMetrics.totalRetries = 0
    aggregatedMetrics.byCapability.clear()
    aggregatedMetrics.byStrategy.clear()
  },
}
