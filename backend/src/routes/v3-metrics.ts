/**
 * routes/v3-metrics.ts — P1.7 V3 Schema 审计路由
 *
 * ═════════════════════════════════════════════
 * P1.7 只读原则：此路由不修改任何 Schema 或 Prompt 数据。
 * ═════════════════════════════════════════════
 *
 * GET  /api/v3-metrics/health — 生成健康报告
 * GET  /api/v3-metrics/check  — 仅检查告警
 * POST /api/v3-metrics/collect — 手动触发单次采集
 */

import { FastifyInstance } from 'fastify'
import { collectV3Metrics, generateV3HealthReport, checkV3Alerts } from '../services/v3-metrics.service.js'

export default async function v3MetricsRoutes(app: FastifyInstance) {

  /**
   * GET /api/v3-metrics/health
   * 生成 V3 Schema Health Report（默认最近 24 小时）。
   */
  app.get('/api/v3-metrics/health', async (request, reply) => {
    const query = request.query as any
    const hours = Math.min(Number(query?.hours) || 24, 168) // 最多 7 天
    const report = await generateV3HealthReport(hours)
    return { success: true, data: report }
  })

  /**
   * GET /api/v3-metrics/check
   * 仅检查是否有告警（轻量，适合定时调用）。
   */
  app.get('/api/v3-metrics/check', async (request, reply) => {
    const query = request.query as any
    const hours = Math.min(Number(query?.hours) || 24, 168)
    const alerts = await checkV3Alerts(hours)
    return { success: true, data: { alerts, alertCount: alerts.length, hasAlerts: alerts.length > 0 } }
  })

  /**
   * POST /api/v3-metrics/collect
   * 手动触发一次采集（需提供 scriptId + userId + segments）。
   */
  app.post('/api/v3-metrics/collect', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = request.body as any
    const { scriptId, segments, compiledPrompt } = body || {}

    if (!scriptId || !segments) {
      return reply.status(400).send({
        success: false,
        error: '缺少必要字段: scriptId, segments',
      })
    }

    const userId = (request as any).user?.id
    if (!userId) {
      return reply.status(401).send({ success: false, error: '未认证' })
    }

    const report = await collectV3Metrics({ scriptId, userId, segments, compiledPrompt })
    return { success: true, data: report }
  })
}
