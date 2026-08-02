/**
 * Channel Health Routes — SPRINT-MEDIA-AI-EMPLOYEE-REALITY-01 Task01
 *
 * 渠道健康守卫 API（Channel Health Guard）：
 *  - GET  /api/enterprise/channels/:id/health           健康状态（owner-view）
 *  - GET  /api/enterprise/channels/health/attention     所有需要关注账号（NEEDS_ATTENTION/DEGRADED）
 *  - POST /api/enterprise/channels/:id/health/record-failure  运行时失败上报（内部）
 *  - POST /api/enterprise/channels/:id/health/record-success  执行成功上报（内部）
 *  - POST /api/enterprise/channels/:id/health/recover         人工恢复（owner 确认）
 *
 * 语义（掌柜）：账号是资产，不是消耗品。NEEDS_ATTENTION → 暂停任务保护账号，人工确认后恢复。
 */
import type { FastifyInstance } from 'fastify'
import { channelHealthGuardService, ChannelHealthError } from '../services/enterprise/channel/channel-health-guard.service.js'

export async function channelHealthRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /api/enterprise/channels/:id/health
  app.get('/api/enterprise/channels/:id/health', async (request, reply) => {
    try {
      const { id } = request.params as any
      const state = await channelHealthGuardService.getState(id)
      return reply.send({ code: 0, data: state })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // GET /api/enterprise/channels/health/attention
  app.get('/api/enterprise/channels/health/attention', async (request, reply) => {
    try {
      const user = (request as any).user as any
      const rows = await channelHealthGuardService.listAttention(user?.tenantId || user?.id || 'default')
      return reply.send({ code: 0, data: rows })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // POST /api/enterprise/channels/:id/health/record-failure
  // body: { error, signal?, by? }
  app.post('/api/enterprise/channels/:id/health/record-failure', async (request, reply) => {
    try {
      const { id } = request.params as any
      const body: any = (request.body as any) || {}
      if (!body.error) return reply.status(400).send({ code: 1, message: '缺少 error（失败原因）' })
      const user = (request as any).user as any
      const result = await channelHealthGuardService.recordFailure({
        channelAccountId: id,
        tenantId: user?.tenantId || user?.id || 'default',
        organizationId: user?.organizationId || user?.orgId || null,
        error: body.error,
        signal: body.signal,
        by: body.by || user?.id || 'system',
      })
      return reply.send({ code: 0, data: result })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // POST /api/enterprise/channels/:id/health/record-success
  app.post('/api/enterprise/channels/:id/health/record-success', async (request, reply) => {
    try {
      const { id } = request.params as any
      const state = await channelHealthGuardService.recordSuccess(id)
      return reply.send({ code: 0, data: state })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // POST /api/enterprise/channels/:id/health/recover
  // body: { by?, reason? } — owner 人工确认恢复（解除保护 + 恢复绑定）
  app.post('/api/enterprise/channels/:id/health/recover', async (request, reply) => {
    try {
      const { id } = request.params as any
      const body: any = (request.body as any) || {}
      const user = (request as any).user as any
      const result = await channelHealthGuardService.recover(id, {
        by: body.by || user?.id || 'owner',
        reason: body.reason,
      })
      return reply.send({ code: 0, data: result })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })
}
