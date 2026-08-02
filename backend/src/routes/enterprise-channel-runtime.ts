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
  // Task03.2 Phase D — 支持 ?agentInstanceId= 触发 AgentChannelBinding 权限校验（analyze）
  app.get('/api/enterprise/channels/runtime/:id/metrics', async (request, reply) => {
    const { id } = request.params as any
    const { agentInstanceId } = request.query as any
    try {
      const metrics = await channelService.fetchMetrics(id, { agentInstanceId })
      return reply.send({ code: 0, data: metrics })
    } catch (e: any) {
      const status = e.code === 'permission_denied' ? 403 : 400
      return reply.status(status).send({ code: e.code === 'permission_denied' ? 'permission_denied' : 1, message: e.message })
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

  // ═══════════════════════════════════════════════════════
  // 浏览器登录交互（Task03.2 Phase A+：工作台可测扫码/短信登录）
  // 前端弹窗 → 轮询截图 → 掌柜扫码 / 填手机号+验证码 → 登录成功 → refresh-credential
  // ═══════════════════════════════════════════════════════

  // 确保抖音渠道账号存在（查不到则自动创建），返回 accountId
  app.post('/api/enterprise/channels/runtime/douyin/ensure-account', async (request, reply) => {
    const user = (request as any).user as any
    const tenantId = user?.tenantId || user?.id || 'default'
    try {
      const { prisma } = await import('../utils/index.js')
      let account = await prisma.enterpriseChannelAccount.findFirst({
        where: { channelType: 'douyin' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })
      if (!account) {
        const created = await channelService.connectAccount({
          tenantId,
          platform: 'douyin',
          accountName: '抖音创作者中心',
          externalAccountId: 'douyin-' + Date.now(),
          credential: { cookieData: '[]' },
        })
        account = { id: created.id }
      }
      return reply.send({ code: 0, data: { id: account.id } })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // 登录页状态（截图 base64 + 登录检测）——前端轮询
  app.get('/api/enterprise/channels/runtime/browser/:sessionId/status', async (request, reply) => {
    const { sessionId } = request.params as any
    try {
      const adapter = channelService.resolveAdapter('douyin') as any
      const status = await adapter.getLoginStatus(sessionId)
      return reply.send({ code: 0, data: status })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // TASK03.2.1 — 等待登录完成并自动回写账号（登录成功闭环）
  // 浏览器轮询多信号探针 → 登录成功 → 自动更新 EnterpriseChannelAccount
  // （connected + connectedAt + externalAccountId + channelName）+ 保存 cookie 凭证
  app.post('/api/enterprise/channels/runtime/:id/wait-for-login', async (request, reply) => {
    const { id } = request.params as any
    try {
      const result = await channelService.waitChannelLogin(id, 180000)
      // 登录成功 → 自动续期凭证（cookie 加密落库），无需用户手动操作
      if (result.status === 'connected') {
        try {
          await channelService.refreshChannelCredential(id)
        } catch (e: any) {
          console.warn(`[Runtime] wait-for-login 凭证保存失败: ${e.message}`)
        }
      }
      return reply.send({ code: 0, data: result })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // 填手机号
  app.post('/api/enterprise/channels/runtime/browser/:sessionId/phone', async (request, reply) => {
    const { sessionId } = request.params as any
    const { phone } = request.body as any
    if (!phone) return reply.status(400).send({ code: 400, message: 'phone is required' })
    try {
      const adapter = channelService.resolveAdapter('douyin') as any
      const result = await adapter.fillPhone(sessionId, phone)
      return reply.send({ code: 0, data: result })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // 点「获取验证码」（短信发送）
  app.post('/api/enterprise/channels/runtime/browser/:sessionId/send-code', async (request, reply) => {
    const { sessionId } = request.params as any
    try {
      const adapter = channelService.resolveAdapter('douyin') as any
      const result = await adapter.clickSendCode(sessionId)
      return reply.send({ code: 0, data: result })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // 填验证码 + 点登录
  app.post('/api/enterprise/channels/runtime/browser/:sessionId/code', async (request, reply) => {
    const { sessionId } = request.params as any
    const { code } = request.body as any
    if (!code) return reply.status(400).send({ code: 400, message: 'code is required' })
    try {
      const adapter = channelService.resolveAdapter('douyin') as any
      const result = await adapter.fillCodeAndLogin(sessionId, code)
      return reply.send({ code: 0, data: result })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // 切换登录方式 tab：sms / qr / password
  app.post('/api/enterprise/channels/runtime/browser/:sessionId/tab', async (request, reply) => {
    const { sessionId } = request.params as any
    const { tab } = request.body as any
    if (!['sms', 'qr', 'password'].includes(tab)) return reply.status(400).send({ code: 400, message: 'tab must be sms|qr|password' })
    try {
      const adapter = channelService.resolveAdapter('douyin') as any
      const result = await adapter.switchLoginTab(sessionId, tab)
      return reply.send({ code: 0, data: result })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })
}
