// ════════════════════════════════════════════════════════════
// KH5-T003 — Metrics Registry
// ════════════════════════════════════════════════════════════

export interface MetricDefinition {
  name: string
  description: string
  unit: string
  type: 'counter' | 'gauge' | 'histogram'
}

export interface MetricSample {
  name: string
  value: number
  timestamp: string
  labels: Record<string, string>
}

const DEFINED_METRICS: MetricDefinition[] = [
  { name: 'packages_created_total', description: 'Total packages created', unit: 'count', type: 'counter' },
  { name: 'validation_success_rate', description: 'Package validation success rate', unit: '%', type: 'gauge' },
  { name: 'review_throughput', description: 'Reviews completed per hour', unit: 'count/h', type: 'gauge' },
  { name: 'review_sla_ms', description: 'Average review approval time', unit: 'ms', type: 'histogram' },
  { name: 'publish_success_rate', description: 'Publishing success rate', unit: '%', type: 'gauge' },
  { name: 'distribution_success_rate', description: 'Distribution success rate', unit: '%', type: 'gauge' },
  { name: 'retry_count_total', description: 'Total retry attempts', unit: 'count', type: 'counter' },
  { name: 'publish_duration_ms', description: 'Average publish duration', unit: 'ms', type: 'histogram' },
  { name: 'queue_depth', description: 'Current queue depth', unit: 'count', type: 'gauge' },
  { name: 'provider_availability', description: 'Provider availability', unit: '%', type: 'gauge' },
]

export class MetricsRegistry {
  private samples: MetricSample[] = []

  getDefinitions(): MetricDefinition[] {
    return DEFINED_METRICS
  }

  record(name: string, value: number, labels: Record<string, string> = {}) {
    this.samples.push({ name, value, timestamp: new Date().toISOString(), labels })
  }

  getLatest(name: string): MetricSample | null {
    const matches = this.samples.filter(s => s.name === name)
    if (matches.length === 0) return null
    return matches.reduce((latest, s) => (s.timestamp > latest.timestamp ? s : latest))
  }

  getRange(name: string, since: string): MetricSample[] {
    return this.samples.filter(s => s.name === name && s.timestamp >= since)
  }

  getAllLatest(): Record<string, MetricSample | null> {
    const result: Record<string, MetricSample | null> = {}
    for (const def of DEFINED_METRICS) {
      result[def.name] = this.getLatest(def.name)
    }
    return result
  }
}
