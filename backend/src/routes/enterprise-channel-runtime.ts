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
import { enterpriseContextService } from '../services/enterprise/enterprise-context.service.js'

/** SPRINT-MEDIA-TENANT-ISOLATION-FIX-01 — org 实时解析（JWT 快照可过期，统一以 govUser→govOrg 实时查询为准） */
async function resolveOrgId(userId: string) {
  const { getOrganizationIdForUser } = await import('../services/enterprise/organization/identity-bootstrap.service.js')
  return getOrganizationIdForUser(userId)
}
import { identityProbeRegistry } from '../enterprise/channel/identity-probe.js'
import { channelPlatformRegistry } from '../enterprise/channel/platform-registry.js'

export async function enterpriseChannelRuntimeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  /**
   * SPRINT-MEDIA-TENANT-ISOLATION-FIX-01 Task02 — runtime 路由租户强制校验
   * 1) 无 org 用户一律 403（未知身份不得访问任何渠道资产）
   * 2) :id 路由（账号级操作）校验账号 org === 用户 org（IDOR 关闭）
   * 3) request.orgId 注入 handler（account-status/ensure-account 等按 org 过滤）
   */
  app.addHook('preHandler', async (request, reply) => {
    const user = request.user as any
    // org 实时解析（JWT 快照可能过期，如组织迁移后旧 token）；带 60s TTL 缓存
    const orgId = user?.id ? await resolveOrgId(user.id) : null
    ;(request as any).orgId = orgId
    // registry = 平台能力清单（登录即可，无业务数据）——无 org 用户也能看到平台列表，操作时才 403
    const isRegistry = String(request.url).includes('/channels/registry')
    if (!orgId && !isRegistry) {
      return reply.status(403).send({ code: 403, error: 'NO_ORGANIZATION', message: '当前用户未归属任何组织' })
    }
    const { id } = request.params as any
    if (id) {
      const { prisma } = await import('../utils/index.js')
      const account = await prisma.enterpriseChannelAccount.findUnique({
        where: { id },
        select: { organizationId: true },
      })
      if (!account) return reply.status(404).send({ code: 404, message: 'Channel account not found' })
      if (account.organizationId !== orgId) {
        return reply.status(403).send({ code: 403, error: 'CHANNEL_NOT_IN_ORG', message: '无权访问该渠道账号' })
      }
    }
  })

  // ═══ REGISTRY-SSOT-01 — 平台注册中心（前端渠道中心唯一数据源）═══
  // 前端禁止硬编码 connectable/platform；平台能力（登录方式/探针策略/扫码后行为/就绪状态）
  // 全部从本接口拉取。新增平台 = meta 配置 + adapter 注册，前端零改动自动点亮。
  app.get('/api/enterprise/channels/registry', async (_request, reply) => {
    try {
      const capabilities = channelPlatformRegistry.getCapabilities()
      return reply.send({
        code: 0,
        data: {
          platforms: capabilities,
          connectable: channelPlatformRegistry.getConnectablePlatforms(),
        },
      })
    } catch (e: any) {
      return reply.status(500).send({ code: 1, message: e.message })
    }
  })

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
      // FIX-02 — 用户私有资产：metrics 读取前校验账号可访问（owner 或授权人）
      const { prisma } = await import('../utils/index.js')
      const { ChannelAccessService } = await import('../services/enterprise/channel/channel-access.service.js')
      const access = new ChannelAccessService(prisma)
      if (!(await access.canAccess((request as any).user?.id, id, 'READ'))) {
        return reply.status(403).send({ code: 403, error: 'CHANNEL_ACCESS_DENIED', message: '无权读取该账号指标（需账号所有者授权）' })
      }
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

  // TASK03.2.2 G4 — 渠道账号连接状态（前端卡片已连接态渲染）
  // 2026-08-02 — 多平台泛化：/api/enterprise/channels/runtime/:platform/account-status
  app.get('/api/enterprise/channels/runtime/:platform/account-status', async (request, reply) => {
    const { platform } = request.params as any
    const orgId = (request as any).orgId
    try {
      const { prisma } = await import('../utils/index.js')
      const { isChannelConnected, ChannelConnectionStatus } = await import('../constants/channel-connection-status.js')
      // FIX-02 — 用户私有资产：只查当前用户可访问的账号（owner ∪ share）
      const { ChannelAccessService } = await import('../services/enterprise/channel/channel-access.service.js')
      const access = new ChannelAccessService(prisma)
      const accessibleIds = await access.getAccessibleAccountIds((request as any).user?.id)
      const account = await prisma.enterpriseChannelAccount.findFirst({
        where: { channelType: platform, organizationId: orgId, id: { in: accessibleIds } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, connectionStatus: true, channelName: true, externalAccountId: true, metadata: true },
      })
      if (!account) return reply.send({ code: 0, data: { connected: false, connectionStatus: ChannelConnectionStatus.PENDING } })
      const meta = (account.metadata as any) || {}
      return reply.send({
        code: 0,
        data: {
          // REALITY-HARDENING-01 Task01 — 仅 CONNECTED + externalAccountId 为真连接
          connected: isChannelConnected(account.connectionStatus) && !!account.externalAccountId,
          connectionStatus: account.connectionStatus,
          accountName: account.channelName,
          avatar: meta.avatar || '',
          permissionLevel: meta.permissionLevel ?? 1,
          boundAt: meta.boundAt || null,
          // Channel Identity Trust Completion — 设备可信标记（安全验证完成后长期可信）
          deviceTrusted: !!meta.deviceTrusted,
          lastVerifiedAt: meta.lastVerifiedAt || null,
        },
      })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // 确保渠道账号存在（查不到则自动创建），返回 accountId
  // 2026-08-02 — 多平台泛化：/api/enterprise/channels/runtime/:platform/ensure-account
  app.post('/api/enterprise/channels/runtime/:platform/ensure-account', async (request, reply) => {
    const { platform } = request.params as any
    const user = (request as any).user as any
    const orgId = (request as any).orgId
    const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || '')
    const tenantId = govTenantId || orgId || 'default'
    try {
      const { prisma } = await import('../utils/index.js')
      // FIX-02 — 写路径防串号（P0）：只允许「自己的账号」或「新建自己账号」，
      // 禁止 findFirst 偷取同组织他人账号（B 扫码覆盖 A 登录态 = 事故）
      let account = await prisma.enterpriseChannelAccount.findFirst({
        where: { channelType: platform, organizationId: orgId, ownerId: user.id },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })
      if (!account) {
        // REALITY-GATE-FINAL-01 — 真实或不存在：只建 WAITING_LOGIN 空壳（无假 ID/无空凭证/不冒充账号名），
        // 真实身份由登录成功后写入（updateChannelIdentity）。禁止 externalAccountId=platform-时间戳 占位。
        const created = await channelService.connectAccount({
          tenantId,
          organizationId: orgId,
          platform,
          accountName: '未连接',
          credential: {},
          ownerId: user.id, // FIX-02 — 创建者即 owner（用户私有资产）
        })
        account = { id: created.id }
      }
      return reply.send({ code: 0, data: { id: account.id } })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // 登录页状态（截图 base64 + 登录检测）——前端轮询
  // TASK03.2.2-FIX — 串行化：探针执行 2-3s 而前端轮询 2.5s，并发会互相替换/关闭页面 → 登录检测失败
  // 2026-08-02 — 多平台：sessionId 形如 `platform:accountId`，按前缀解析 adapter
  const statusLocks = new Map<string, Promise<any>>()
  app.get('/api/enterprise/channels/runtime/browser/:sessionId/status', async (request, reply) => {
    const { sessionId } = request.params as any
    const prev = statusLocks.get(sessionId) || Promise.resolve()
    const run = prev.then(async () => {
      try {
        const platform = String(sessionId).split(':')[0]
        const adapter = channelService.resolveAdapter(platform) as any
        const status = await adapter.getLoginStatus(sessionId)
        // SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task 03 — 轮询时同步授权状态机（幂等、失败静默）
        if (status && status.loginStage) {
          try {
            const { browserAuthSessionService } = await import('../services/enterprise/browser-auth-session.service.js')
            const { prisma } = await import('../utils/index.js')
            const accountId = String(sessionId).replace(/^[^:]+:/, '')
            const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: accountId } })
            if (account) {
              const authSession = await browserAuthSessionService.begin(account.id, { type: 'app' })
              const stage = status.loginStage
              if (stage === 'verifying' && status.verificationRequired) {
                await browserAuthSessionService.transition(authSession.id, 'PLATFORM_VERIFY', {
                  metadata: { verificationType: status.verificationType || 'app' },
                }).catch(() => {})
              } else if (stage === 'waiting_scan' || stage === 'scan_confirming') {
                await browserAuthSessionService.transition(authSession.id, 'WAIT_USER_LOGIN').catch(() => {})
              } else if (stage === 'awaiting_confirmation') {
                await browserAuthSessionService.transition(authSession.id, 'PLATFORM_VERIFY').catch(() => {})
              }
            }
          } catch (e: any) {
            // 状态机同步失败不影响主流程
          }
        }
        return { code: 0, data: status }
      } catch (e: any) {
        return reply.status(400).send({ code: 1, message: e.message })
      }
    }).finally(() => {
      // 清理锁（避免 Map 无限增长）
      setTimeout(() => { if (statusLocks.get(sessionId) === run) statusLocks.delete(sessionId) }, 100)
    })
    statusLocks.set(sessionId, run)
    return run
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
      const platform = String(sessionId).split(':')[0]
      const adapter = channelService.resolveAdapter(platform) as any
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
      const platform = String(sessionId).split(':')[0]
      const adapter = channelService.resolveAdapter(platform) as any
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
      const platform = String(sessionId).split(':')[0]
      const adapter = channelService.resolveAdapter(platform) as any
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
      const platform = String(sessionId).split(':')[0]
      const adapter = channelService.resolveAdapter(platform) as any
      const result = await adapter.switchLoginTab(sessionId, tab)
      return reply.send({ code: 0, data: result })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // ═══════════════════════════════════════════════════════
  // TASK03.2.2 — Channel Runtime Identity System（渠道运行身份系统）
  // 掌柜蓝图：人工授权确认事件 + Runtime Health Agent + 三级权限
  // ═══════════════════════════════════════════════════════

  // 人工授权确认（扫码成功后用户点「确认绑定」→ 探针复核 → 回写 DB + 保存凭证）
  // G1 Identity：externalAccountId + channelName + avatar + connectionStatus=connected
  app.post('/api/enterprise/channels/runtime/:id/confirm-binding', async (request, reply) => {
    const { id } = request.params as any
    try {
      const result = await channelService.confirmChannelBinding(id)
      return reply.send({ code: 0, data: result })
    } catch (e: any) {
      const status = e.code === 'permission_denied' ? 403 : 400
      return reply.status(status).send({ code: e.code === 'permission_denied' ? 'permission_denied' : 1, message: e.message })
    }
  })

  // Runtime Health Agent（三态：browser / session / account）
  // G3 Health：老板看到「我的 AI 员工办公室正常」
  app.get('/api/enterprise/channels/runtime/:id/runtime-health', async (request, reply) => {
    const { id } = request.params as any
    try {
      const health = await channelService.getRuntimeHealth(id)
      return reply.send({ code: 0, data: health })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // 账号当前权限等级
  app.get('/api/enterprise/channels/runtime/:id/permission', async (request, reply) => {
    const { id } = request.params as any
    try {
      const level = await channelService.getPermissionLevel(id)
      return reply.send({ code: 0, data: { accountId: id, permissionLevel: level } })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // 设置权限等级（当前冻结 L1；L2/L3 掌柜批准后开放）
  app.post('/api/enterprise/channels/runtime/:id/permission', async (request, reply) => {
    const { id } = request.params as any
    const { level } = request.body as any
    if (![1, 2, 3].includes(Number(level))) {
      return reply.status(400).send({ code: 400, message: 'level must be 1|2|3' })
    }
    try {
      const result = await channelService.setPermissionLevel(id, Number(level))
      return reply.send({ code: 0, data: result })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // 身份探针（debug：查看当前浏览器会话的探测身份）
  app.get('/api/enterprise/channels/runtime/:id/identity-probe', async (request, reply) => {
    const { id } = request.params as any
    try {
      const account = await channelService.getAccountById(id)
      const probe = identityProbeRegistry.get(account.channelType)
      if (!probe) throw new Error(`渠道 ${account.channelType} 无身份探针`)
      const sid = account.channelType + ':' + account.id
      const identity = await probe.probe(sid)
      return reply.send({ code: 0, data: identity })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // KUAISHOU-QR-FIX-02 debug：查看登录页现场（URL/title/过期提示/扫码确认提示）
  app.get('/api/enterprise/channels/runtime/browser/:sessionId/debug-page', async (request: any, reply: any) => {
    try {
      const { sessionId } = request.params
      const { browserRuntime } = await import('../services/media/browser-runtime.service.js')
      const info = await browserRuntime.withPage(sessionId, async (page) => {
        const text = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 1500) : '').catch(() => '')
        const title = await page.title().catch(() => '')
        return { url: page.url(), title, text }
      })
      return { code: 0, data: info }
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })
}
