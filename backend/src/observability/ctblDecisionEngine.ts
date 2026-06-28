/**
 * observability/ctblDecisionEngine.ts
 *
 * CTBL Decision Engine
 * Automatic CSIP gating based on real-time metrics
 *
 * Output: ENABLE_CSIP | HOLD | ALERT | INSUFFICIENT_DATA
 */

import { computeMetrics, hasEnoughSamples, type CTBLMetrics } from './ctblMetricsAggregator.js'

export type CTBLDecision = 'ENABLE_CSIP' | 'HOLD' | 'ALERT' | 'INSUFFICIENT_DATA'

export interface DecisionResult {
  decision: CTBLDecision
  metrics: CTBLMetrics
  minSamplesRequired: number
  confidenceInterval: { low: number; high: number }
  timestamp: string
}

/**
 * Calculate 95% confidence interval for a proportion
 * Using Wilson score interval for small samples
 */
function wilsonScoreInterval(successes: number, total: number): { low: number; high: number } {
  if (total === 0) return { low: 0, high: 1 }
  const z = 1.96  // 95% confidence
  const p = successes / total
  const denominator = 1 + z * z / total
  const center = p + z * z / (2 * total)
  const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total)
  return {
    low: Math.max(0, (center - margin) / denominator),
    high: Math.min(1, (center + margin) / denominator),
  }
}

const MIN_SAMPLES = 30
const GSR_THRESHOLD = 0.95
const CSR_THRESHOLD = 0.90
const FAILURE_THRESHOLD = 0.03
const CI_WIDTH_THRESHOLD = 0.15  // 95% CI width must be < 15% for reliable decision

/**
 * Evaluate current metrics and return a decision
 */
export function decide(minSamples: number = MIN_SAMPLES): DecisionResult {
  const metrics = computeMetrics()
  const timestamp = new Date().toISOString()

  // Not enough data
  if (!hasEnoughSamples(minSamples)) {
    return {
      decision: 'INSUFFICIENT_DATA',
      metrics,
      minSamplesRequired: minSamples,
      confidenceInterval: { gsrLow: 0, gsrHigh: 0 },
      timestamp,
    }
  }

  const successes = Math.round(metrics.gsr * metrics.sampleCount)
  const ci = wilsonScoreInterval(successes, metrics.sampleCount)
  const ciWidth = ci.high - ci.low

  // Alert: failure rate too high — something is wrong
  if (metrics.failureRate > 0.10) {
    return {
      decision: 'ALERT',
      metrics,
      minSamplesRequired: minSamples,
      confidenceInterval: ci,
      timestamp,
    }
  }

  // Check all gates
  const gsrPassed = metrics.gsr > GSR_THRESHOLD
  const csrPassed = metrics.csr > CSR_THRESHOLD
  const failurePassed = metrics.failureRate < FAILURE_THRESHOLD
  const ciPassed = ciWidth < CI_WIDTH_THRESHOLD

  if (gsrPassed && csrPassed && failurePassed && ciPassed) {
    return {
      decision: 'ENABLE_CSIP',
      metrics,
      minSamplesRequired: minSamples,
      confidenceInterval: ci,
      timestamp,
    }
  }

  return {
    decision: 'HOLD',
    metrics,
    minSamplesRequired: minSamples,
    confidenceInterval: ci,
    timestamp,
  }
}

/**
 * Generate a readable status summary
 */
export function formatDecision(result: DecisionResult): string {
  const statusEmoji: Record<string, string> = {
    ENABLE_CSIP: '🟢',
    HOLD: '🟡',
    ALERT: '🔴',
    INSUFFICIENT_DATA: '⚪',
  }
  const lines = [
    `${statusEmoji[result.decision]} [CTBL-DECISION] ${result.decision}`,
    `  GSR: ${(result.metrics.gsr * 100).toFixed(1)}% (target >${(GSR_THRESHOLD * 100).toFixed(0)}%)`,
    `  CSR: ${(result.metrics.csr * 100).toFixed(1)}% (target >${(CSR_THRESHOLD * 100).toFixed(0)}%)`,
    `  Failure: ${(result.metrics.failureRate * 100).toFixed(1)}% (target <${(FAILURE_THRESHOLD * 100).toFixed(0)}%)`,
    `  CI width: ${((result.confidenceInterval.high - result.confidenceInterval.low) * 100).toFixed(1)}% (target <${(CI_WIDTH_THRESHOLD * 100).toFixed(0)}%)`,
    `  Samples: ${result.metrics.sampleCount} (min ${result.minSamplesRequired})`,
    `  Timestamp: ${result.timestamp}`,
  ]
  return lines.join('\n')
}
