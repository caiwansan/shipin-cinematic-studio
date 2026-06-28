// ============================================================
// Telemetry Interface — observability metrics for all Runtimes
// ARCH-001-I: Define interface; Prometheus integration deferred to next phase
// ============================================================

/**
 * Standard runtime metrics structure for all platform operations.
 */
export interface RuntimeMetrics {
  /** Runtime name (e.g. 'asset', 'semantic', 'goal', 'capability') */
  name: string
  /** Operation latency in milliseconds */
  latencyMs: number
  /** Optional cost tracking (e.g. LLM token cost) */
  cost?: number
  /** Whether the operation succeeded */
  success: boolean
  /** How many retries were attempted */
  retryCount: number
  /** Error message if failed */
  error?: string
  /** Unix timestamp in milliseconds */
  timestamp: number
}

/**
 * Telemetry collector interface.
 * Implementations can write to console, file, or Prometheus.
 */
export interface ITelemetryCollector {
  /** Record a single metric point */
  record(metrics: RuntimeMetrics): void
  /** Record multiple metric points */
  recordBatch(metrics: RuntimeMetrics[]): void
  /** Get recent metrics (for dashboard) */
  getRecent(limit?: number): RuntimeMetrics[]
}

/**
 * Default console-based telemetry collector.
 */
export class ConsoleTelemetryCollector implements ITelemetryCollector {
  private buffer: RuntimeMetrics[] = []
  private maxBuffer = 1000

  record(metrics: RuntimeMetrics): void {
    this.buffer.push(metrics)
    if (this.buffer.length > this.maxBuffer) {
      this.buffer.shift()
    }
    if (!metrics.success) {
      console.warn(`[Telemetry] ${metrics.name} failed after ${metrics.retryCount} retries (${metrics.latencyMs}ms): ${metrics.error}`)
    }
  }

  recordBatch(metrics: RuntimeMetrics[]): void {
    for (const m of metrics) this.record(m)
  }

  getRecent(limit = 100): RuntimeMetrics[] {
    return this.buffer.slice(-limit)
  }
}

export const telemetryCollector: ITelemetryCollector = new ConsoleTelemetryCollector()
