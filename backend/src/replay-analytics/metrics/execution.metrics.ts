/**
 * Execution Metrics Schema — unified metric envelope
 *
 * Every node / event / artifact in the runtime carries this.
 * This is what elevates Replay from "playback" to "analytics".
 */

// ============================================================
// Core Metrics — every execution step produces one
// ============================================================

export interface ExecutionMetrics {
  timing: TimingMetrics
  cost?: CostMetrics
  quality?: QualityMetrics
  retry?: RetryMetrics
}

export interface TimingMetrics {
  durationMs: number        // wall-clock execution time
  cpuMs?: number            // CPU time (if available)
  waitMs?: number           // time spent waiting for deps / queue
  networkMs?: number        // time spent on network I/O
}

export interface CostMetrics {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  estimatedCostUsd?: number
  creditsUsed?: number       // platform-specific
  modelName?: string          // e.g. deepseek-v4-flash, flux-schnell
  provider?: string           // e.g. deepseek, openai, replicate
}

export interface QualityMetrics {
  outputSizeBytes?: number
  outputLength?: number       // tokens / chars in output
  schemaValid?: boolean       // did output match expected schema?
  schemaError?: string        // if invalid, why
  truncation?: boolean        // was output truncated
}

export interface RetryMetrics {
  attemptCount: number        // 1 = first try
  maxAttempts: number
  lastAttemptDurationMs?: number
  retryReasons?: string[]     // e.g. ["timeout", "rate_limit", "schema_mismatch"]
}

// ============================================================
// Aggregated Run Metrics — rollup across all nodes
// ============================================================

export interface RunMetricsAggregate {
  runId: string
  totalDurationMs: number
  totalCostUsd?: number
  totalTokens?: number
  nodeCount: number
  completedCount: number
  failedCount: number
  skippedCount: number

  // Timing distribution
  timingDistribution: {
    min: number
    max: number
    avg: number
    p50: number
    p95: number
    p99: number
  }

  // Bottleneck data
  bottleneckNodeId?: string
  bottleneckNodeType?: string
  bottleneckImpactPct?: number  // % of total duration

  // Cost breakdown
  costBreakdown?: Record<string, number>  // nodeType → cost

  // Per-node metrics
  perNode: Record<string, {
    nodeType: string
    metrics: ExecutionMetrics
    outputTypes?: string[]
    optimizationHint?: string
  }>
}

// ============================================================
// Optimization Signals
// ============================================================

export type OptimizationSignalType =
  | 'serial_bottleneck'
  | 'high_cost_node'
  | 'frequent_failure'
  | 'redundant_path'
  | 'cacheable_output'
  | 'parallelizable_path'
  | 'schema_mismatch'

export interface OptimizationSignal {
  type: OptimizationSignalType
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  nodeIds?: string[]
  impactPct?: number      // estimated improvement
  suggestedAction?: string
  code?: string            // machine-readable key for automated handling
}
