/**
 * Enterprise Readonly — 企业侧只读查询（展示框架的真实数据源）
 *
 * Sprint-MEDIA-UX-01: 新媒体工作台「执行记录/能力目录」展示的真实数据源
 * - 只读，不写任何数据
 * - 归属强制：organizationId 来自 JWT 身份解析，禁止跨企业查询
 * - 复用 agent_outcome（统一结果层 SSOT）+ usage_logs（成本归因）+ CapabilityContract（能力目录）
 * - 无数据显示空数组，前端展示空态（禁 mock）
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'

/** Unified identity resolver: get orgId from JWT user. */
async function resolveOrgId(request: any): Promise<string> {
  const user = request.user as any
  const userId = user?.id
  if (!userId) return ''

  // SPRINT-MEDIA-IDENTITY-ALIGN-01 T03: 优先 JWT 注入的 organizationId（新 token 零查库）
  if (user.organizationId) {
    return user.organizationId
  }

  if (user?.tenantId && user.tenantId !== userId) {
    return user.tenantId
  }

  try {
    const orgId = await getOrganizationIdForUser(userId)
    return orgId || ''
  } catch {
    return userId
  }
}

export async function registerEnterpriseOutcomeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  /**
   * GET /api/enterprise/outcomes
   * 企业侧真实执行结果（agent_outcome）+ 成本归因（usage_logs）
   *
   * Query:
   *   workspace (可选) 过滤业务线，如 media / recruitment / career；缺省查企业全部
   *   days      (可选) 时间窗口，默认 30
   *   limit     (可选) 条数上限，默认 20
   */
  app.get('/', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrgId(request)
      if (!organizationId) {
        return reply.code(401).send({ code: 401, message: '无企业身份，无法查询执行记录' })
      }

      const query = request.query as { workspace?: string; days?: string; limit?: string }
      const workspace = query.workspace?.trim() || undefined
      const days = Math.min(Math.max(parseInt(query.days || '30', 10) || 30, 1), 365)
      const limit = Math.min(Math.max(parseInt(query.limit || '20', 10) || 20, 1), 100)
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      const where: any = {
        organizationId: organizationId as any,
        createdAt: { gte: since },
      }
      if (workspace) where.workspace = workspace

      const [items, byTypeAgg, usageAgg] = await Promise.all([
        prisma.agentOutcome.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true,
            workspace: true,
            outcomeType: true,
            metricValue: true,
            metadata: true,
            createdAt: true,
            agentInstanceId: true,
          },
        }),
        prisma.agentOutcome.groupBy({
          by: ['outcomeType'],
          where,
          _count: { _all: true },
          _sum: { metricValue: true },
        }),
        prisma.usageLog.aggregate({
          where: { organizationId: organizationId as any, createdAt: { gte: since } },
          _sum: { cost: true },
          _count: { _all: true },
        }),
      ])

      const byType = byTypeAgg
        .map((g: any) => ({
          outcomeType: g.outcomeType,
          count: g._count?._all ?? 0,
          metricSum: g._sum?.metricValue ?? 0,
        }))
        .sort((a: any, b: any) => b.count - a.count)

      return reply.send({
        code: 0,
        data: {
          generatedAt: new Date().toISOString(),
          windowDays: days,
          workspace: workspace || 'all',
          total: items.length,
          items,
          byType,
          usage: {
            totalCost: usageAgg._sum.cost ?? 0,
            executions: usageAgg._count._all,
          },
        },
      })
    } catch (err: any) {
      request.log?.error?.(err)
      return reply.code(500).send({ code: 500, message: '查询执行记录失败', detail: String(err?.message || err).slice(0, 200) })
    }
  })
}

/**
 * Sprint-MEDIA-UX-02: 新媒体运营中心聚合视图（只读）
 * GET /api/enterprise/media/overview
 *
 * 真实数据源：
 *  - EnterpriseAgentInstance + EnterpriseAgentProfile（AI 员工状态）
 *  - AgentSchedule（今日/未来任务）
 *  - AgentOutcome（今日/近 7 天执行结果）
 *  - UsageLog（今日成本）
 *  - 行业雷达：无真实数据源 → supported:false（前端显示待激活，禁 mock）
 */
export async function registerMediaOverviewRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get('/', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrgId(request)
      if (!organizationId) {
        return reply.code(401).send({ code: 401, message: '无企业身份，无法查询运营中心' })
      }

      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const startOf7d = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000)
      const endOf7d = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000)

      // 1. AI 员工实例（真实状态）+ 档案
      const instances = await prisma.enterpriseAgentInstance.findMany({
        where: { organizationId: organizationId as any },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          employeeId: true,
          runtimeStatus: true,
          lifecycleState: true,
          lastActiveAt: true,
          totalTasks: true,
          totalErrors: true,
          createdAt: true,
        },
      })
      const profiles = instances.length
        ? await prisma.enterpriseAgentProfile.findMany({
            where: { id: { in: instances.map((i: any) => i.employeeId) } },
            select: { id: true, name: true, role: true, avatarUrl: true, businessType: true, status: true },
          })
        : []
      const profileMap = new Map(profiles.map((p: any) => [p.id, p]))

      const agents = instances.map((i: any) => {
        const p = profileMap.get(i.employeeId) || null
        return {
          instanceId: i.id,
          employeeId: i.employeeId,
          name: p?.name || '未命名员工',
          role: p?.role || p?.businessType || '未分配角色',
          avatar: p?.avatarUrl || null,
          runtimeStatus: i.runtimeStatus,
          lifecycleState: i.lifecycleState,
          lastActiveAt: i.lastActiveAt,
          totalTasks: i.totalTasks,
          totalErrors: i.totalErrors,
        }
      })

      // 2. 今日任务（schedule 今日待跑 + outcome 今日已完成）
      // 边界：企业无 AI 员工实例时，不跨企业查询 schedule（tenantId 归属不可推断）
      const tenantIds = [...new Set(instances.map((i: any) => i.tenantId).filter(Boolean))]
      const tenantWhere = tenantIds.length ? { tenantId: { in: tenantIds } } : { tenantId: '__no_tenant__' }
      const [todayOutcomes, todaySchedule, todayUsage] = await Promise.all([
        prisma.agentOutcome.groupBy({
          by: ['outcomeType'],
          where: { organizationId: organizationId as any, createdAt: { gte: startOfToday } },
          _count: { _all: true },
        }),
        prisma.agentSchedule.findMany({
          where: { ...tenantWhere, enabled: true, nextRunAt: { lte: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000) } },
          take: 20,
          orderBy: { nextRunAt: 'asc' },
          select: { id: true, agentId: true, scheduleType: true, taskType: true, nextRunAt: true, cronExpression: true },
        }),
        prisma.usageLog.aggregate({
          where: { organizationId: organizationId as any, createdAt: { gte: startOfToday } },
          _sum: { cost: true },
          _count: { _all: true },
        }),
      ])

      // 3. 近 7 天执行记录（日历落点）
      const recentOutcomes = await prisma.agentOutcome.findMany({
        where: { organizationId: organizationId as any, createdAt: { gte: startOf7d } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, outcomeType: true, metricValue: true, metadata: true, createdAt: true, agentInstanceId: true },
      })

      // 4. 未来 7 天排程（日历）
      const upcomingSchedules = await prisma.agentSchedule.findMany({
        where: { ...tenantWhere, enabled: true, nextRunAt: { gte: startOfToday, lte: endOf7d } },
        take: 50,
        orderBy: { nextRunAt: 'asc' },
        select: { id: true, agentId: true, taskType: true, nextRunAt: true },
      })

      // 5. 日历：7 天格（含今天）
      const calendar: any[] = []
      for (let d = 0; d < 7; d++) {
        const dayStart = new Date(startOfToday.getTime() + d * 24 * 60 * 60 * 1000)
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
        const items: { kind: 'outcome' | 'schedule'; outcomeType: string; time: string }[] = recentOutcomes
          .filter((o: any) => o.createdAt >= dayStart && o.createdAt < dayEnd)
          .map((o: any) => ({
            kind: 'outcome' as const,
            outcomeType: o.outcomeType,
            time: o.createdAt.toISOString(),
          }))
        upcomingSchedules
          .filter((s: any) => s.nextRunAt >= dayStart && s.nextRunAt < dayEnd)
          .forEach((s: any) => {
            items.push({ kind: 'schedule' as const, outcomeType: `schedule:${s.taskType}`, time: s.nextRunAt.toISOString() })
          })
        items.sort((a: any, b: any) => a.time.localeCompare(b.time))
        calendar.push({
          date: dayStart.toISOString().slice(0, 10),
          isToday: d === 0,
          items,
        })
      }

      // 6. 渠道连接（真实计数）
      // 新媒体渠道表（mediaPlatformAccount）待 Sprint-MEDIA-01 落地：
      // 表存在 → 真实 active 计数；未落地 → 诚实返回 0（当前无连接能力）
      let connectedChannels = 0
      try {
        const mediaAccountModel = (prisma as any).mediaPlatformAccount
        if (mediaAccountModel && typeof mediaAccountModel.count === 'function') {
          connectedChannels = await mediaAccountModel.count({
            where: { organizationId: organizationId as any, status: 'active' },
          })
        }
      } catch {
        connectedChannels = 0
      }

      // 7. 行业雷达：无真实数据源，诚实返回 supported:false
      const industryRadar = {
        supported: false,
        reason: '热点/竞品/规则数据源未接入。真实雷达将于 Sprint-MEDIA-03 数据源就绪后启用。',
        hot: [],
        competitor: [],
        rule: [],
        suggestion: [],
      }

      return reply.send({
        code: 0,
        data: {
          generatedAt: now.toISOString(),
          agents,
          today: {
            completed: todayOutcomes.reduce((s: number, g: any) => s + (g._count?._all ?? 0), 0),
            byType: todayOutcomes.map((g: any) => ({
              outcomeType: g.outcomeType,
              count: g._count?._all ?? 0,
            })),
            pendingSchedules: todaySchedule.length,
            scheduleItems: todaySchedule.map((s: any) => ({
              id: s.id,
              agentId: s.agentId,
              taskType: s.taskType,
              scheduleType: s.scheduleType,
              nextRunAt: s.nextRunAt,
            })),
          },
          calendar,
          recentOutcomes: recentOutcomes.slice(0, 10).map((o: any) => ({
            id: o.id,
            outcomeType: o.outcomeType,
            metricValue: o.metricValue,
            title: (o.metadata as any)?.title || null,
            createdAt: o.createdAt,
          })),
          usage: {
            todayCost: todayUsage._sum.cost ?? 0,
            executions: todayUsage._count._all,
          },
          channels: {
            connected: connectedChannels,
            total: 4,
            platforms: ['wechat', 'douyin', 'xiaohongshu', 'video'],
          },
          industryRadar,
        },
      })
    } catch (err: any) {
      request.log?.error?.(err)
      return reply.code(500).send({ code: 500, message: '查询运营中心失败', detail: String(err?.message || err).slice(0, 200) })
    }
  })
}
