/**
 * Enterprise Channel Runtime Routes — SPRINT-MEDIA-CHANNEL-01 Task03.1.3
 *
 * 新 Enterprise Channel Runtime 链路（不做 UI）：
 *   EnterpriseChannelService → AdapterRegistry(resolveAdapter) → DouyinBrowserAdapter → Playwright
 *
 * 与旧链路的关系：
 * - channels.ts /api/enterprise/channel-accounts/:id/connect 是模拟授权（fakeToken + simulated:true）
 *   → 保留 deprecated，不修改，不被本路由复用
 * - 本路由是唯一真实 Runtime 入口（浏览器自动化 → 抖音创作者中心）
 *
 * 禁止事项（掌柜 Task03 约束）：不涉及 UI / dashboardData / 自动发布 / AI 运营建议
 */
import type { FastifyInstance } from 'fastify'
import { channelService } from '../services/enterprise/channel.service.js'

export async function enterpriseChannelRuntimeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // 连接渠道（打开浏览器会话 → 抖音创作者中心登录/恢复）
  app.post('/api/enterprise/channels/runtime/:id/connect', async (request, reply) => {
    const { id } = request.params as any
    try {
      const result = await channelService.connectChannel(id)
      return reply.send({ code: 0, data: result })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // 读取真实核心指标（粉丝/作品/获赞，禁止 mock）
  app.get('/api/enterprise/channels/runtime/:id/metrics', async (request, reply) => {
    const { id } = request.params as any
    try {
      const metrics = await channelService.fetchMetrics(id)
      return reply.send({ code: 0, data: metrics })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // 凭证续期（登录完成后调用：浏览器取新 cookie → AES 回写 credentialEncrypted）
  app.post('/api/enterprise/channels/runtime/:id/refresh-credential', async (request, reply) => {
    const { id } = request.params as any
    try {
      const result = await channelService.refreshChannelCredential(id)
      return reply.send({ code: 0, data: result })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // 渠道健康检查（Chromium 可启动性 + 平台状态）
  app.get('/api/enterprise/channels/runtime/:id/health', async (request, reply) => {
    const { id } = request.params as any
    try {
      const health = await channelService.getChannelHealth(id)
      return reply.send({ code: 0, data: health })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })
}
