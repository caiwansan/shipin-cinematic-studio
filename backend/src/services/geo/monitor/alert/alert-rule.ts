import type { Probe, ProbeTarget, ProbeResult } from '../monitor.types'
import http from 'http'
import https from 'https'

// ============================================================
// Alert rule interface freeze — Phase 1 stub implementation
// Phase 2: Implement with email/webhook/slack notifications
// ============================================================

export interface AlertRuleConfig {
  ruleType: 'drift' | 'downtime' | 'index_lost' | 'score_drop'
  threshold: number
  notificationType: 'email' | 'webhook' | 'slack'
  notificationTarget?: string
  cooldownMinutes: number
  enabled: boolean
}

export class AlertService {
  async checkAndNotify(config: AlertRuleConfig, context: Record<string, any>): Promise<void> {
    // Phase 1: Log only
    console.log(`[AlertService] Rule triggered: ${config.ruleType}`, { config, context })
    // Phase 2: Send email/webhook/slack notification
  }
}
