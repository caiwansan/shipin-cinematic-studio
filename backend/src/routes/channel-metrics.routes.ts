/**
 * Channel Metrics Routes — SPRINT-MEDIA-AI-EMPLOYEE-OPERATION-REALITY-01 Task02/03/05
 *
 * AI 员工读取真实账号指标的 API：
 *  - POST /api/enterprise/channels/:id/metrics/collect   AI 员工触发真实读取（数字电脑 → 提取器 → 快照）
 *  - GET  /api/enterprise/channels/:id/metrics/latest    最新快照（owner-view/前端）
 *  - GET  /api/enterprise/channels/:id/metrics/history   历史快照（趋势）
 *  - POST /api/enterprise/channels/:id/metrics/analyze   AI 运营分析（只读，LLM 生成建议）
 *
 * 纪律：
 *  - 无数据 → status=unavailable + reason（禁止 0）
 *  - 权限：AI 员工只能读取绑定授权账号（G5）
 *  - 只读：不发布/不评论/不私信/不点赞
 */
import type { FastifyInstance } from 'fastify'
import { channelMetricsService, MetricsPermissionError } from '../services/enterprise/channel/metrics/channel-metrics.service.js'

export async function channelMetricsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // POST /api/enterprise/channels/:id/metrics/collect?agentId=xxx
  // AI 员工读取真实指标（Task01/02）：权限断言 → 数字电脑 → 提取器 → Snapshot
  app.post('/api/enterprise/channels/:id/metrics/collect', async (request, reply) => {
    try {
      const { id } = request.params as any
      const query: any = (request.query as any) || {}
      const agentId = query.agentId
      if (!agentId) return reply.status(400).send({ code: 1, message: '缺少 agentId（AI 员工实例 ID）' })
      const user = (request as any).user as any
      const snapshot = await channelMetricsService.collectForAgent(agentId, id, {
        tenantId: user?.tenantId || user?.id || 'default',
        organizationId: user?.organizationId || user?.orgId || user?.tenantId || user?.id || 'default',
        businessType: query.businessType || 'media',
      })
      return reply.send({ code: 0, data: snapshot })
    } catch (e: any) {
      if (e instanceof MetricsPermissionError) return reply.status(403).send({ code: 1, message: e.message })
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // GET /api/enterprise/channels/:id/metrics/latest
  app.get('/api/enterprise/channels/:id/metrics/latest', async (request, reply) => {
    try {
      const { id } = request.params as any
      const snapshot = await channelMetricsService.latest(id)
      return reply.send({ code: 0, data: snapshot })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // GET /api/enterprise/channels/:id/metrics/history?days=7
  app.get('/api/enterprise/channels/:id/metrics/history', async (request, reply) => {
    try {
      const { id } = request.params as any
      const query: any = (request.query as any) || {}
      const days = parseInt(query.days) || 7
      const rows = await channelMetricsService.history(id, days)
      return reply.send({ code: 0, data: rows })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // POST /api/enterprise/channels/:id/metrics/analyze?agentId=xxx&userId=yyy
  // Task05 — AI 运营分析（只读：真实数据 → 分析 → 建议；不自动执行）
  app.post('/api/enterprise/channels/:id/metrics/analyze', async (request, reply) => {
    try {
      const { id } = request.params as any
      const query: any = (request.query as any) || {}
      const agentId = query.agentId
      if (!agentId) return reply.status(400).send({ code: 1, message: '缺少 agentId（AI 员工实例 ID）' })
      const user = (request as any).user as any
      const result = await channelMetricsService.analyzeForAgent(agentId, id, {
        llmUserId: query.userId || user?.id || 'default',
      })
      return reply.send({ code: 0, data: result })
    } catch (e: any) {
      if (e instanceof MetricsPermissionError) return reply.status(403).send({ code: 1, message: e.message })
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })
}
