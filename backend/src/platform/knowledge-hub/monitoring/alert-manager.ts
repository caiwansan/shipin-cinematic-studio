// ════════════════════════════════════════════════════════════
// KH5-T005 — AlertingPolicy
// ════════════════════════════════════════════════════════════

export type AlertSeverity = 'critical' | 'warning' | 'info'
export type AlertStatus = 'firing' | 'resolved'

export interface AlertPolicyRule {
  id: string
  metric: string
  threshold: number
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq'
  window: number  // seconds
  severity: AlertSeverity
  message: string
  enabled: boolean
}

export interface Alert {
  id: string
  ruleId: string
  metric: string
  value: number
  threshold: number
  severity: AlertSeverity
  status: AlertStatus
  message: string
  firedAt: string
  resolvedAt: string | null
}

export class AlertManager {
  private rules: Map<string, AlertPolicyRule> = new Map()
  private alerts: Alert[] = []

  addRule(rule: Omit<AlertPolicyRule, 'id'>): AlertPolicyRule {
    const full: AlertPolicyRule = { ...rule, id: crypto.randomUUID() }
    this.rules.set(full.id, full)
    return full
  }

  removeRule(id: string): boolean {
    return this.rules.delete(id)
  }

  getRules(): AlertPolicyRule[] {
    return Array.from(this.rules.values()).filter(r => r.enabled)
  }

  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => a.status === 'firing')
  }

  getAlertHistory(limit = 50): Alert[] {
    return this.alerts.slice(-limit).reverse()
  }

  evaluate(metricName: string, value: number) {
    for (const rule of this.getRules()) {
      if (rule.metric !== metricName) continue

      const triggered = this.compare(value, rule.threshold, rule.operator)
      const existing = this.alerts.find(a => a.ruleId === rule.id && a.status === 'firing')

      if (triggered && !existing) {
        this.alerts.push({
          id: crypto.randomUUID(),
          ruleId: rule.id,
          metric: metricName,
          value,
          threshold: rule.threshold,
          severity: rule.severity,
          status: 'firing',
          message: rule.message,
          firedAt: new Date().toISOString(),
          resolvedAt: null,
        })
      } else if (!triggered && existing) {
        existing.status = 'resolved'
        existing.resolvedAt = new Date().toISOString()
      }
    }
  }

  private compare(value: number, threshold: number, op: string): boolean {
    switch (op) {
      case 'gt': return value > threshold
      case 'lt': return value < threshold
      case 'gte': return value >= threshold
      case 'lte': return value <= threshold
      case 'eq': return value === threshold
      default: return false
    }
  }
}
