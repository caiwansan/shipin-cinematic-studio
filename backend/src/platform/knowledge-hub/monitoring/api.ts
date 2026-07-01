// ════════════════════════════════════════════════════════════
// KH5-T006 — Monitoring API
// ════════════════════════════════════════════════════════════

import { FastifyInstance } from 'fastify'
import { ObservabilityEngine } from './observability-engine'
import { HealthEngine } from './health-engine'
import { MetricsRegistry } from './metrics-registry'
import { AuditExplorer } from './audit-explorer'
import { AlertManager } from './alert-manager'
import { DistributionEngine } from '../distribution/distribution-engine'
import { AuditTimeline } from '../review/audit-timeline'

export function registerMonitoringRoutes(
  fastify: FastifyInstance,
  opts: {
    obs: ObservabilityEngine
    health: HealthEngine
    metrics: MetricsRegistry
    audit: AuditExplorer
    alerts: AlertManager
    timeline: AuditTimeline
    distribution: DistributionEngine
  },
) {
  // ── GET /knowledge/monitoring/overview — Unified snapshot ──
  fastify.get('/api/knowledge/monitoring/overview', async () => {
    const snapshot = opts.obs.snapshot()
    return { success: true, data: snapshot }
  })

  // ── GET /knowledge/monitoring/health — HealthEngine report ──
  fastify.get('/api/knowledge/monitoring/health', async () => {
    return { success: true, data: opts.health.getReport() }
  })

  // ── GET /knowledge/monitoring/metrics — Metrics registry ──
  fastify.get('/api/knowledge/monitoring/metrics', async () => {
    const definitions = opts.metrics.getDefinitions()
    const latest = opts.metrics.getAllLatest()
    return {
      success: true,
      data: {
        definitions,
        latest,
      },
    }
  })

  // ── GET /knowledge/monitoring/audit — Audit Timeline explorer ──
  fastify.get('/api/knowledge/monitoring/audit', async (request) => {
    const query = request.query as any
    const events = await opts.audit.query({
      packageId: query.packageId,
      type: query.type,
      since: query.since,
      until: query.until,
      limit: query.limit ? parseInt(query.limit) : 100,
    })
    return { success: true, data: { events, total: events.length, types: opts.audit.getEventTypes() } }
  })

  // ── GET /knowledge/monitoring/jobs — All active jobs ──
  fastify.get('/api/knowledge/monitoring/jobs', async () => {
    const distJobs = await opts.distribution.listJobs()
    return {
      success: true,
      data: {
        distribution: distJobs,
      },
    }
  })

  // ── GET /knowledge/monitoring/alerts — Alerts ──
  fastify.get('/api/knowledge/monitoring/alerts', async () => {
    return {
      success: true,
      data: {
        active: opts.alerts.getActiveAlerts(),
        history: opts.alerts.getAlertHistory(50),
        rules: opts.alerts.getRules(),
      },
    }
  })

  // ── POST /knowledge/monitoring/alerts/rules — Create alert rule ──
  fastify.post('/api/knowledge/monitoring/alerts/rules', async (request, reply) => {
    const body = request.body as any
    if (!body.metric || body.threshold === undefined) {
      return reply.status(400).send({ success: false, error: 'metric and threshold are required' })
    }
    const rule = opts.alerts.addRule({
      metric: body.metric,
      threshold: body.threshold,
      operator: body.operator || 'gt',
      window: body.window || 300,
      severity: body.severity || 'warning',
      message: body.message || `${body.metric} exceeded threshold`,
      enabled: body.enabled !== false,
    })
    return { success: true, data: rule }
  })

  // ── POST /knowledge/monitoring/health/report — Report component health ──
  fastify.post('/api/knowledge/monitoring/health/report', async (request, reply) => {
    const body = request.body as any
    if (!body.name || !body.status) {
      return reply.status(400).send({ success: false, error: 'name and status are required' })
    }
    opts.health.report(body.name, body.status, body.message || '')
    return { success: true, data: opts.health.getComponent(body.name) }
  })
}
