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

export async function browserWorkspaceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  const ctx = (request: any) => {
    const user = request.user as any
    return {
      tenantId: user?.tenantId || user?.id || 'default',
      organizationId: user?.organizationId || user?.orgId || user?.tenantId || user?.id || 'default',
    }
  }

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
      const sessionId = `workspace:${ws.channelAccountId}`
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
      const sessionId = `workspace:${ws.channelAccountId}`
      await browserWorkspaceService.transition(id, ['CREATED', 'READY', 'ERROR', 'RUNNING'], 'RUNNING')
      await browserRuntime.startWorkspace(sessionId, ws.profilePath, { headless: false })
      // SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task 02/04 — workspace 启动后导航到平台登录页/创作者中心
      // （拿账号 channelType 决定目标；当前仅抖音真实接入）
      try {
        const { prisma } = await import('../utils/index.js')
        const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: ws.channelAccountId } })
        if (account?.channelType === 'douyin') {
          const nav = await browserRuntime.navigate(sessionId, 'https://creator.douyin.com/', { headless: false })
          if (nav.success) {
            console.log(`[BrowserWorkspace] 已导航到抖音创作者中心 ${sessionId}`)
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
      const sessionId = `workspace:${ws.channelAccountId}`
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
      const sessionId = `workspace:${ws.channelAccountId}`
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
      const sessionId = `workspace:${ws.channelAccountId}`
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
      const sessionId = `workspace:${ws.channelAccountId}`
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
  app.get('/api/enterprise/workspaces/owner-view', async (request, reply) => {
    try {
      const { prisma } = await import('../utils/index.js')
      const query: any = (request.query as any) || {}
      const businessType = query.businessType || 'media'
      const { organizationId } = ctx(request)

      // 域过滤第一层：workspace 必须属于 media 域
      // org 过滤：admin 超管（无 organizationId）看全部 media workspace；普通用户严格按 org 隔离
      const wsWhere: any = { businessType }
      if (organizationId && organizationId !== 'default') {
        wsWhere.organizationId = organizationId
      }
      const wsList = await prisma.browserWorkspace.findMany({ where: wsWhere })
      const wsIds = wsList.map((w: any) => w.id)
      if (!wsIds.length) return reply.send({ code: 0, data: [] })

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
          select: { id: true, channelType: true, channelName: true, connectionStatus: true },
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
        rows.push({
          workspaceId: ws.id,
          workspaceStatus: ws.status,
          online: ['RUNNING', 'READY'].includes(ws.status),
          lastHealthCheckAt: ws.lastHealthCheckAt,
          businessType: ws.businessType,
          platform: account.channelType || null,
          platformName: account.channelName || null,
          accountConnection: account.connectionStatus || null,
          agent: profile ? { id: profile.id, name: profile.name, role: profile.role, agentType: profile.agentType, businessType: profile.businessType } : null,
          lastOperation: traj[0] ? { action: traj[0].action, description: traj[0].description, createdAt: traj[0].createdAt } : null,
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
