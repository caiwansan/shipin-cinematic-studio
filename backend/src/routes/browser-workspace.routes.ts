/**
 * Browser Workspace Routes — SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task 01/02
 *
 * AI 员工数字办公环境 — Browser Workspace 生命周期 API
 *  - GET    /api/enterprise/workspaces                 列表（按组织隔离）
 *  - POST   /api/enterprise/workspaces                创建（ensure-account → getOrCreate）
 *  - GET    /api/enterprise/workspaces/:id            详情（含健康状态）
 *  - POST   /api/enterprise/workspaces/:id/start      启动浏览器
 *  - POST   /api/enterprise/workspaces/:id/stop       停止浏览器
 *  - POST   /api/enterprise/workspaces/:id/restart    重启浏览器
 *  - GET    /api/enterprise/workspaces/:id/health     健康检查
 *  - DELETE /api/enterprise/workspaces/:id            销毁（默认保留 profile）
 *
 * 边界（掌柜批准约束）：
 * - 不存储凭证/cookie（唯一凭证源 EnterpriseChannelAccount.credentialEncrypted）
 * - 不做 AI 员工逻辑 / 操作日志（Task 07 另行建模）
 * - 不删除现有 Channel Runtime（增量升级）
 */
import type { FastifyInstance } from 'fastify'
import { browserWorkspaceService } from '../services/enterprise/browser-workspace.service.js'
import { browserRuntime } from '../services/media/browser-runtime.service.js'
import { channelService } from '../services/enterprise/channel.service.js'
import { browserAuthSessionService } from '../services/enterprise/browser-auth-session.service.js'
import { channelOperationLogService } from '../services/enterprise/channel-operation-log.service.js'
import { browserTrajectoryService } from '../services/enterprise/browser-trajectory.service.js'
import { browserWorkspaceRecoveryService } from '../services/enterprise/browser-workspace-recovery.service.js'

export async function browserWorkspaceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  const ctx = (request: any) => {
    const user = request.user as any
    return {
      tenantId: user?.tenantId || user?.id || 'default',
      organizationId: user?.organizationId || user?.orgId || user?.tenantId || user?.id || 'default',
    }
  }

  // SPRINT-MEDIA-IDENTITY-PERSISTENCE-FIX-01 — 手动触发启动恢复流程（幂等）
  // POST /api/enterprise/workspaces/recover?businessType=media
  app.post('/api/enterprise/workspaces/recover', async (request, reply) => {
    try {
      const query: any = (request.query as any) || {}
      const result = await browserWorkspaceRecoveryService.recoverAll({ businessType: query.businessType, verbose: true })
      return reply.send({ code: 0, data: result })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // 列表（按组织隔离）
  app.get('/api/enterprise/workspaces', async (request, reply) => {
    try {
      const { organizationId } = ctx(request)
      const list = await browserWorkspaceService.listByOrganization(organizationId)
      return reply.send({ code: 0, data: list })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // 创建（幂等：channelAccountId 唯一）
  app.post('/api/enterprise/workspaces', async (request, reply) => {
    try {
      const { tenantId, organizationId } = ctx(request)
      const body: any = (request.body as any) || {}
      const channelAccountId = body.channelAccountId
      const businessType = body.businessType || 'media' // 默认 media 域（兼容存量抖音）
      if (!channelAccountId) {
        // 未指定账号时：自动确保抖音账号存在（与 runtime ensure-account 一致）
        let account = await (await import('../utils/index.js')).prisma.enterpriseChannelAccount.findFirst({
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
        const ws = await browserWorkspaceService.getOrCreate(tenantId, organizationId, account.id, businessType)
        return reply.send({ code: 0, data: ws })
      }
      const ws = await browserWorkspaceService.getOrCreate(tenantId, organizationId, channelAccountId, businessType)
      return reply.send({ code: 0, data: ws })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // 详情（含浏览器实时健康状态）
  app.get('/api/enterprise/workspaces/:id', async (request, reply) => {
    try {
      const { id } = request.params as any
      const ws = await browserWorkspaceService.findById(id)
      if (!ws) return reply.status(404).send({ code: 1, message: 'BrowserWorkspace not found' })
      const sessionId = await browserWorkspaceService.resolveSessionId(ws.channelAccountId)
      const health = await browserRuntime.healthCheckWorkspace(sessionId)
      return reply.send({ code: 0, data: { ...ws, runtime: health } })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // 启动浏览器（拉起持久化实例，保留登录态）
  app.post('/api/enterprise/workspaces/:id/start', async (request, reply) => {
    try {
      const { id } = request.params as any
      const ws = await browserWorkspaceService.findById(id)
      if (!ws) return reply.status(404).send({ code: 1, message: 'BrowserWorkspace not found' })
      const sessionId = await browserWorkspaceService.resolveSessionId(ws.channelAccountId)
      await browserWorkspaceService.transition(id, ['CREATED', 'READY', 'ERROR', 'RUNNING'], 'RUNNING')
      await browserRuntime.startWorkspace(sessionId, ws.profilePath, { headless: false })
      // SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task 02/04 — workspace 启动后导航到平台登录页/创作者中心
      // （拿账号 channelType 决定目标；IDENTITY-PERSISTENCE-FIX-01：所有已注册平台通用）
      try {
        const { prisma } = await import('../utils/index.js')
        const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: ws.channelAccountId } })
        if (account?.channelType) {
          const { CHANNEL_META } = await import('../enterprise/channel/adapters/browser-channel.meta.js')
          const target = (CHANNEL_META[account.channelType as string] as any)?.loginUrl || (account.channelType === 'douyin' ? 'https://creator.douyin.com/' : null)
          if (target) {
            const nav = await browserRuntime.navigate(sessionId, target, { headless: false })
            if (nav.success) {
              console.log(`[BrowserWorkspace] 已导航到 ${account.channelType} 工作台 ${sessionId}`)
            }
          }
        }
      } catch (e: any) {
        console.warn(`[BrowserWorkspace] 平台导航失败（不影响 workspace 启动）: ${e.message}`)
      }
      await browserWorkspaceService.markHealthCheck(id)
      const updated = await browserWorkspaceService.findById(id)
      return reply.send({ code: 0, data: updated })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // 停止浏览器（profile 保留）
  app.post('/api/enterprise/workspaces/:id/stop', async (request, reply) => {
    try {
      const { id } = request.params as any
      const ws = await browserWorkspaceService.findById(id)
      if (!ws) return reply.status(404).send({ code: 1, message: 'BrowserWorkspace not found' })
      const sessionId = await browserWorkspaceService.resolveSessionId(ws.channelAccountId)
      await browserRuntime.stopWorkspace(sessionId)
      const updated = await browserWorkspaceService.transition(id, ['RUNNING', 'ERROR', 'READY'], 'READY')
      return reply.send({ code: 0, data: updated })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // 重启浏览器
  app.post('/api/enterprise/workspaces/:id/restart', async (request, reply) => {
    try {
      const { id } = request.params as any
      const ws = await browserWorkspaceService.findById(id)
      if (!ws) return reply.status(404).send({ code: 1, message: 'BrowserWorkspace not found' })
      const sessionId = await browserWorkspaceService.resolveSessionId(ws.channelAccountId)
      await browserRuntime.restartWorkspace(sessionId, ws.profilePath, { headless: false })
      await browserWorkspaceService.transition(id, ['CREATED', 'READY', 'RUNNING', 'ERROR'], 'RUNNING')
      await browserWorkspaceService.markHealthCheck(id)
      const updated = await browserWorkspaceService.findById(id)
      return reply.send({ code: 0, data: updated })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // 健康检查
  app.get('/api/enterprise/workspaces/:id/health', async (request, reply) => {
    try {
      const { id } = request.params as any
      const ws = await browserWorkspaceService.findById(id)
      if (!ws) return reply.status(404).send({ code: 1, message: 'BrowserWorkspace not found' })
      const sessionId = await browserWorkspaceService.resolveSessionId(ws.channelAccountId)
      const health = await browserRuntime.healthCheckWorkspace(sessionId)
      if (health.ok) {
        await browserWorkspaceService.markHealthCheck(id)
      }
      const updated = await browserWorkspaceService.findById(id)
      return reply.send({ code: 0, data: { ...updated, runtime: health } })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // 销毁（默认保留 profile；?deleteProfile=true 删除）
  app.delete('/api/enterprise/workspaces/:id', async (request, reply) => {    try {
      const { id } = request.params as any
      const query: any = (request.query as any) || {}
      const ws = await browserWorkspaceService.findById(id)
      if (!ws) return reply.status(404).send({ code: 1, message: 'BrowserWorkspace not found' })
      const sessionId = await browserWorkspaceService.resolveSessionId(ws.channelAccountId)
      await browserRuntime.destroyWorkspace(sessionId, ws.profilePath, query.deleteProfile === 'true')
      await browserWorkspaceService.transition(id, ['CREATED', 'READY', 'RUNNING', 'ERROR'], 'DESTROYED')
      return reply.send({ code: 0, data: { id, status: 'DESTROYED' } })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task 07 — 操作日志（防重复 + 审计）
  // GET /api/enterprise/workspaces/:id/operation-logs
  app.get('/api/enterprise/workspaces/:id/operation-logs', async (request, reply) => {
    try {
      const { id } = request.params as any
      const ws = await browserWorkspaceService.findById(id)
      if (!ws) return reply.status(404).send({ code: 1, message: 'BrowserWorkspace not found' })
      const logs = await channelOperationLogService.listByWorkspace(id, 50)
      return reply.send({ code: 0, data: logs })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task 08 — AI 操作轨迹（实时）
  // GET /api/enterprise/workspaces/:id/trajectory
  app.get('/api/enterprise/workspaces/:id/trajectory', async (request, reply) => {
    try {
      const { id } = request.params as any
      const ws = await browserWorkspaceService.findById(id)
      if (!ws) return reply.status(404).send({ code: 1, message: 'BrowserWorkspace not found' })
      const traj = await browserTrajectoryService.listByWorkspace(id, 30)
      return reply.send({ code: 0, data: traj })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task08.1 — Browser Workspace Owner View（老板视角）
  // AI员工 → 工作电脑（🟢在线/⚫离线）→ 平台 → 最近操作 → 状态
  // SPRINT-MEDIA-BROWSER-WORKSPACE-01.1 Domain Boundary Fix：
  //   只返回 media 域 AI 员工 + media 域 workspace（双过滤），禁止 Career/Recruitment Agent 混入
  //   （原实现无域过滤 → 新媒体工作台展示了「用户的AI职业助理」绑抖音的跨域污染）
  // GET /api/enterprise/workspaces/owner-view?businessType=media
  // REALITY-HARDENING-01 Task03 — 真实性视图：
  //   online 必须是 workspace RUNNING/READY + account CONNECTED + externalAccountId 三重条件
  //   workerStatus 推导：等待扫码/验证中/工作中/离线/异常（未登录绝不显示「工作中」）
  //   lastOperation 只接受真实只读动作（publish/reply 等 Task 阶段禁用动作一律过滤）
  app.get('/api/enterprise/workspaces/owner-view', async (request, reply) => {
    try {
      const { prisma } = await import('../utils/index.js')
      const { isChannelConnected, ChannelConnectionStatus } = await import('../constants/channel-connection-status.js')
      const query: any = (request.query as any) || {}
      const businessType = query.businessType || 'media'
      const { organizationId } = ctx(request)

      // REALITY-HARDENING-01 — 动作白名单：仅展示真实可发生的只读/生命周期动作
      // （publish/reply/comment/schedule 在 Task 阶段 adapter 恒 failed，日志出现即伪造）
      const TRUSTED_ACTIONS = new Set([
        'navigate', 'open_creator_center', 'login', 'scan', 'verify',
        'bind', 'confirm', 'fetch_metrics', 'read', 'health_check', 'refresh',
      ])

      // 域过滤第一层：workspace 必须属于 media 域
      // org 过滤：admin 超管（无 organizationId）看全部 media workspace；普通用户严格按 org 隔离
      const wsWhere: any = { businessType }
      if (organizationId && organizationId !== 'default') {
        wsWhere.organizationId = organizationId
      }
      const wsList = await prisma.browserWorkspace.findMany({ where: wsWhere })
      const wsIds = wsList.map((w: any) => w.id)
      if (!wsIds.length) return reply.send({ code: 0, data: [] })

      // AI-EMPLOYEE-OPERATION-REALITY-01 Task04 — 预取各账号最新指标快照（owner-view 运营状态）
      const accIds = wsList.map((w: any) => w.channelAccountId)
      const latestSnaps = await prisma.channelMetricSnapshot.findMany({
        where: { channelAccountId: { in: accIds } },
        orderBy: { collectedAt: 'desc' },
      })
      const latestMetricMap = new Map<string, any>()
      for (const s of latestSnaps) {
        if (!latestMetricMap.has(s.channelAccountId)) latestMetricMap.set(s.channelAccountId, s)
      }

      const bindings = await prisma.agentChannelBinding.findMany({
        where: { status: 'active', browserWorkspaceId: { in: wsIds } },
        orderBy: { updatedAt: 'desc' },
      })
      const rows: any[] = []
      for (const b of bindings) {
        if (!b.browserWorkspaceId) continue
        const ws = wsList.find((w: any) => w.id === b.browserWorkspaceId)
        if (!ws) continue
        const account = await prisma.enterpriseChannelAccount.findUnique({
          where: { id: ws.channelAccountId },
          select: { id: true, channelType: true, channelName: true, accountName: true, avatarUrl: true, connectionStatus: true, externalAccountId: true, connectedAt: true, metadata: true },
        })
        if (!account) continue
        const agent = await prisma.enterpriseAgentInstance.findUnique({ where: { id: b.agentInstanceId } })
        // 域过滤第二层：AI 员工必须属于 media 域（防 Career/Recruitment Agent 混入）
        const profile = agent ? await prisma.enterpriseAgentProfile.findUnique({
          where: { id: agent.employeeId },
          select: { id: true, name: true, role: true, agentType: true, businessType: true },
        }) : null
        if (!profile || profile.businessType !== businessType) {
          console.warn(`[OwnerView] 域过滤: agent ${agent?.id} domain=${profile?.businessType} ≠ ${businessType}，已跳过（防跨域污染）`)
          continue
        }
        const traj = await browserTrajectoryService.listByWorkspace(ws.id, 1)
        // 最近真实操作：过滤伪造/禁用动作（publish/reply/comment/schedule 不可能是 success）
        const trustedTraj = traj.filter((t: any) => TRUSTED_ACTIONS.has(t.action))
        const workspaceRunning = ['RUNNING', 'READY'].includes(ws.status)
        const accountConnected = isChannelConnected(account.connectionStatus) && !!account.externalAccountId
        // SPRINT-MEDIA-IDENTITY-PERSISTENCE-FIX-01 Task 04 — 身份维度（刷新/重启后系统仍知道是谁登录的）：
        //   verified = 有 externalAccountId 且最近探针/恢复在 24h 内（身份新鲜）
        //   stale    = 有 externalAccountId 但身份快照超 24h（需要 Reality API 实时核验）
        //   missing  = 从未获取到账号身份（即使 workspace RUNNING 也不算真在线）
        const accMeta = (account.metadata as any) || {}
        const lastVerifiedAt = accMeta.lastVerifiedAt || null
        // IDENTITY-VIEW-01 Task05 — verified 必须同时满足「身份新鲜 + 登录有效」：
        //   身份快照新鲜 ≠ 当前登录有效（EXPIRED/ERROR 即使昨天刚验证过也要显示「需重新验证」）
        const loginInvalid = account.connectionStatus === ChannelConnectionStatus.EXPIRED || account.connectionStatus === ChannelConnectionStatus.ERROR
        const identityStatus = !account.externalAccountId
          ? 'missing'
          : loginInvalid
            ? 'stale'
            : lastVerifiedAt && (Date.now() - new Date(lastVerifiedAt).getTime()) < 24 * 3600 * 1000
              ? 'verified'
              : 'stale'
        // IDENTITY-VIEW-01 Task05 — 身份失效原因（真实 SaaS：账号身份 ≠ 当前在线；登录过就保留身份，不删除）
        //   浏览器环境失效 / 登录态过期 / 探针未确认 / 从未登录
        const identityReason = (() => {
          if (identityStatus === 'verified') return null
          if (identityStatus === 'missing') return '从未获取到账号身份（扫码登录后自动记录）'
          if (!workspaceRunning) return '浏览器环境失效（数字电脑未运行）'
          if (account.connectionStatus === ChannelConnectionStatus.EXPIRED) return '登录状态已过期，需重新扫码验证'
          if (account.connectionStatus === ChannelConnectionStatus.ERROR) return '连接异常，需重新验证'
          return '身份快照超期，需重新验证'
        })()
        // 真实性状态推导：老板看到的状态 = 电脑 + 账号 + 最近动作 的组合，不是单一 workspace RUNNING
        const workerStatus = (() => {
          if (!workspaceRunning) return 'offline'
          if (accountConnected) return 'working'
          if (account.connectionStatus === ChannelConnectionStatus.WAITING_LOGIN) return 'waiting_scan'
          if (account.connectionStatus === ChannelConnectionStatus.VERIFYING) return 'verifying'
          if (account.connectionStatus === ChannelConnectionStatus.AUTHENTICATED) return 'authenticated'
          if (account.connectionStatus === ChannelConnectionStatus.IDENTITY_VERIFIED) return 'authenticated'
          if (account.connectionStatus === ChannelConnectionStatus.EXPIRED) return 'expired'
          if (account.connectionStatus === ChannelConnectionStatus.ERROR) return 'error'
          return 'pending'
        })()
        rows.push({
          workspaceId: ws.id,
          workspaceStatus: ws.status,
          online: workspaceRunning && accountConnected,
          workerStatus,
          lastHealthCheckAt: ws.lastHealthCheckAt,
          businessType: ws.businessType,
          platform: account.channelType || null,
          platformName: account.channelName || null,
          accountConnection: account.connectionStatus || null,
          // IDENTITY-VIEW-01 Task04/05 — 身份块（SSOT 列：accountName/avatarUrl）+ 失效原因：
          //   前端展示真实头像/账号名/平台 ID/最近验证；失效时身份保留 + 🟡 需重新验证 + 原因
          identity: {
            status: identityStatus,
            externalAccountId: account.externalAccountId || null,
            accountName: account.accountName || account.channelName || null,
            avatar: account.avatarUrl || accMeta.avatar || null,
            lastVerifiedAt,
            reason: identityReason,
            verifiedBy: accMeta.identitySnapshot?.via || (accMeta.lastVerifiedAt ? 'manual_bind' : null),
          },
          // AI-EMPLOYEE-OPERATION-REALITY-01 Task04 — 运营状态（最新真实指标快照）：
          //   无快照/失效 → status=unavailable + reason（禁止 0 冒充）；
          //   追溯链：ChannelAccount → BrowserWorkspace → Runtime → Platform（snapshot 含 workspaceId/agentId/source）
          metrics: (() => {
            const snap = latestMetricMap.get(account.id)
            if (!snap) return { status: 'unavailable', unavailableReason: '暂无指标采集（登录后 Alice 可读取）', collectedAt: null, metrics: null }
            return {
              status: snap.status,
              unavailableReason: snap.unavailableReason,
              collectedAt: snap.collectedAt ? new Date(snap.collectedAt).toISOString() : null,
              source: snap.source,
              workspaceId: snap.workspaceId,
              agentId: snap.agentId,
              metrics: {
                followerCount: snap.followerCount,
                likeCount: snap.likeCount,
                videoCount: snap.videoCount,
                recentViews: snap.recentViews,
                recentFollowerDelta: snap.recentFollowerDelta,
                interactionRate: snap.interactionRate,
              },
            }
          })(),
          agent: profile ? { id: profile.id, name: profile.name, role: profile.role, agentType: profile.agentType, businessType: profile.businessType } : null,
          lastOperation: trustedTraj[0] ? { action: trustedTraj[0].action, description: trustedTraj[0].description, createdAt: trustedTraj[0].createdAt } : null,
        })
      }
      return reply.send({ code: 0, data: rows })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })

  // SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task 03 — 授权流程状态机查询
  // GET /api/enterprise/workspaces/auth-session/:channelAccountId
  // 返回最近一次 BrowserAuthSession（INIT/OPEN_BROWSER/WAIT_USER_LOGIN/PLATFORM_VERIFY/AUTH_SUCCESS/FAILED/EXPIRED）
  app.get('/api/enterprise/workspaces/auth-session/:channelAccountId', async (request, reply) => {
    try {
      const { channelAccountId } = request.params as any
      const latest = await browserAuthSessionService.latest(channelAccountId)
      if (!latest) return reply.send({ code: 0, data: null })
      return reply.send({
        code: 0,
        data: {
          id: latest.id,
          channelAccountId: latest.channelAccountId,
          status: latest.status,
          verificationType: latest.verificationType,
          startedAt: latest.startedAt,
          completedAt: latest.completedAt,
          verifiedIdentity: latest.verifiedIdentity,
          metadata: latest.metadata,
          createdAt: latest.createdAt,
        },
      })
    } catch (e: any) {
      return reply.status(400).send({ code: 1, message: e.message })
    }
  })
}
