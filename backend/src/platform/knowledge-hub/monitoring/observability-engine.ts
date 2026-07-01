// ════════════════════════════════════════════════════════════
// KH5-T001 — ObservabilityEngine
// ════════════════════════════════════════════════════════════

import { HealthEngine } from './health-engine'
import { MetricsRegistry } from './metrics-registry'

export interface ObservabilitySnapshot {
  health: {
    overall: string
    components: { name: string; status: string; message: string }[]
  }
  metrics: Record<string, { value: number; unit: string } | null>
  timestamp: string
}

export class ObservabilityEngine {
  constructor(
    private health: HealthEngine,
    private metrics: MetricsRegistry,
  ) {}

  snapshot(): ObservabilitySnapshot {
    const healthReport = this.health.getReport()
    const metricDefs = this.metrics.getDefinitions()
    const metricValues = this.metrics.getAllLatest()

    const metrics: Record<string, { value: number; unit: string } | null> = {}
    for (const def of metricDefs) {
      const sample = metricValues[def.name]
      metrics[def.name] = sample ? { value: sample.value, unit: def.unit } : null
    }

    return {
      health: {
        overall: healthReport.overall,
        components: healthReport.components.map(c => ({
          name: c.name,
          status: c.status,
          message: c.message,
        })),
      },
      metrics,
      timestamp: new Date().toISOString(),
    }
  }
}
