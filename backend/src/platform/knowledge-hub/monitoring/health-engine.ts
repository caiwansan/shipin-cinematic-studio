// ════════════════════════════════════════════════════════════
// KH5-T002 — HealthEngine
// ════════════════════════════════════════════════════════════

export type HealthStatus = 'healthy' | 'warning' | 'degraded' | 'unavailable'

export interface HealthComponent {
  name: string
  status: HealthStatus
  message: string
  lastChecked: string
}

export interface HealthReport {
  overall: HealthStatus
  components: HealthComponent[]
  lastUpdated: string
}

export class HealthEngine {
  private components: Map<string, HealthComponent> = new Map()

  report(name: string, status: HealthStatus, message: string) {
    this.components.set(name, {
      name,
      status,
      message,
      lastChecked: new Date().toISOString(),
    })
  }

  getComponent(name: string): HealthComponent | null {
    return this.components.get(name) || null
  }

  getReport(): HealthReport {
    const components = Array.from(this.components.values())
    const statuses = components.map(c => c.status)
    const overall: HealthStatus =
      statuses.every(s => s === 'healthy') ? 'healthy'
      : statuses.some(s => s === 'unavailable') ? 'unavailable'
      : statuses.some(s => s === 'degraded') ? 'degraded'
      : 'warning'

    return { overall, components, lastUpdated: new Date().toISOString() }
  }
}
