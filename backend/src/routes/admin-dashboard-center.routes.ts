// admin-dashboard-center.routes.ts — 昆仑镜 AI Operating Center 数据罗盘聚合 API
// ADMIN-IA-REALITY-04 T01
//
// 原则：全部 DB 聚合，不允许 mock；排除已知脏数据源（dag_execution / pangu_axe_runtime）
//
// 端点：
//   GET /api/admin/dashboard/overview      — 平台健康总览（用户/企业/AI/Agent 四卡 + 时间序列）
//   GET /api/admin/dashboard/ai-health     — AI 基础设施健康（Model Provider / Runtime / API）
//   GET /api/admin/dashboard/workspaces    — Workspace 运营地图（业务线排行）
//   GET /api/admin/dashboard/agents        — AI 员工运营中心（Agent 排行）
//   GET /api/admin/dashboard/revenue       — 商业数据（收入/订阅/转化漏斗）
//   GET /api/admin/dashboard/activity      — 实时事件流（最近 20 条）
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

// ── 脏数据排除（盘古斧调试台假调用：cost=1 且 63 万条） ──
const DIRTY_PROVIDERS = ['pangu_axe_runtime']
const DIRTY_TASKS = ['dag_execution']

const cleanUsageWhere = (extra: Record<string, unknown> = {}) => ({
  provider: { notIn: DIRTY_PROVIDERS },
  taskType: { notIn: DIRTY_TASKS },
  ...extra,
})

const num = (v: bigint | number | undefined) => Number(v || 0)

export default async function adminDashboardCenterRoutes(app: FastifyInstance) {

  // ═══ 1. 平台健康总览（第一层：核心经营指标）═══
  app.get('/api/admin/dashboard/overview', { preHandler: [requireAdmin] }, async () => {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const days30 = new Date(now.getTime() - 30 * 86400000)

    const [
      totalUsers,
      todayNewUsers,
      monthNewUsers,
      dau,
      vipCount,
      paidUsers,
      totalEnterprises,
      activeEnterprises,
      totalAgents,
      activeAgents,
      agentTasks,
      agentErrors,
      todayCalls,
      monthCalls,
      totalCalls,
      todayCost,
      monthCost,
      totalCost,
      todayTokens,
      monthTokens,
      totalTokens,
      callTrend,
      usageByTask,
      workspaceCount,
      totalRevenue,
      monthRevenue,
      enterpriseSubs,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.user.count({ where: { lastActiveAt: { gte: startOfDay } } }),
      prisma.user.count({ where: { memberTier: { not: 'free' } } }),
      prisma.paymentOrder.count({ where: { status: 'paid' } }),
      prisma.enterpriseProfile.count(),
      prisma.enterpriseProfile.count({ where: { onboardingDone: true } }),
      prisma.enterpriseAgentInstance.count(),
      prisma.enterpriseAgentInstance.count({ where: { runtimeStatus: 'active' } }),
      prisma.enterpriseAgentTask.count().catch(() => 0),
      prisma.enterpriseAgentTask.count({ where: { status: { in: ['failed', 'error'] } } }).catch(() => 0),
      prisma.usageLog.count({ where: cleanUsageWhere({ createdAt: { gte: startOfDay } }) }),
      prisma.usageLog.count({ where: cleanUsageWhere({ createdAt: { gte: startOfMonth } }) }),
      prisma.usageLog.count({ where: cleanUsageWhere() }),
      prisma.usageLog.aggregate({ where: cleanUsageWhere({ createdAt: { gte: startOfDay } }), _sum: { cost: true } }),
      prisma.usageLog.aggregate({ where: cleanUsageWhere({ createdAt: { gte: startOfMonth } }), _sum: { cost: true } }),
      prisma.usageLog.aggregate({ where: cleanUsageWhere(), _sum: { cost: true } }),
      // tokens 是 String 列，用 raw 查询求和
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(CASE WHEN tokens ~ '^[0-9]+$' THEN CAST(tokens AS BIGINT) ELSE 0 END), 0) AS total FROM usage_logs WHERE "createdAt" >= $1 AND provider NOT IN ($2) AND "taskType" NOT IN ($3)`, startOfDay, ...DIRTY_PROVIDERS, ...DIRTY_TASKS) as Promise<{ total: bigint | number }[]>,
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(CASE WHEN tokens ~ '^[0-9]+$' THEN CAST(tokens AS BIGINT) ELSE 0 END), 0) AS total FROM usage_logs WHERE "createdAt" >= $1 AND provider NOT IN ($2) AND "taskType" NOT IN ($3)`, startOfMonth, ...DIRTY_PROVIDERS, ...DIRTY_TASKS) as Promise<{ total: bigint | number }[]>,
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(CASE WHEN tokens ~ '^[0-9]+$' THEN CAST(tokens AS BIGINT) ELSE 0 END), 0) AS total FROM usage_logs WHERE provider NOT IN ($1) AND "taskType" NOT IN ($2)`, ...DIRTY_PROVIDERS, ...DIRTY_TASKS) as Promise<{ total: bigint | number }[]>,
      // 近 14 天调用趋势
      prisma.usageLog.groupBy({
        by: ['createdAt'],
        where: cleanUsageWhere({ createdAt: { gte: new Date(now.getTime() - 14 * 86400000) } }),
        _count: { id: true },
        _sum: { cost: true },
      }),
      // 今日业务线分布（TOP 8）
      prisma.usageLog.groupBy({
        by: ['taskType'],
        where: cleanUsageWhere({ createdAt: { gte: startOfMonth } }),
        _count: { id: true },
        _sum: { cost: true },
        orderBy: { _count: { id: 'desc' } },
        take: 8,
      }),
      // Workspace 数量（第一层指标）
      prisma.workspace.count(),
      // 累计收入：支付订单（paid）+ 企业订阅快照价
      prisma.paymentOrder.aggregate({ where: { status: 'paid' }, _sum: { amount: true } }),
      prisma.paymentOrder.aggregate({ where: { status: 'paid', payTime: { gte: startOfMonth } }, _sum: { amount: true } }),
      // 企业订阅
      prisma.enterpriseSubscription.findMany({
        select: { id: true, status: true, snapshotPrice: true, snapshotCycle: true, startAt: true, expireAt: true, autoRenew: true },
      }).catch(() => []),
    ])

    // 按天聚合趋势
    const trendMap = new Map<string, { date: string; calls: number; cost: number }>()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      trendMap.set(key, { date: key, calls: 0, cost: 0 })
    }
    for (const row of callTrend) {
      const d = row.createdAt as Date
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const t = trendMap.get(key)
      if (t) { t.calls += row._count.id; t.cost += row._sum.cost || 0 }
    }

    const successRate = agentTasks > 0 ? Math.round(((agentTasks - agentErrors) / agentTasks) * 1000) / 10 : 100

    // 企业订阅聚合：活跃数 / 续费开启数 / 本月新增
    const subActive = enterpriseSubs.filter((s) => s.status === 'active').length
    const subAutoRenew = enterpriseSubs.filter((s) => s.autoRenew && s.status === 'active').length
    const subMonthNew = enterpriseSubs.filter((s) => s.startAt >= startOfMonth).length
    const subRevenueTotal = enterpriseSubs.reduce((sum, s) => sum + ((s.snapshotPrice || 0) / 100), 0)

    return {
      code: 0,
      data: {
        generatedAt: now.toISOString(),
        // ── 第一层：核心经营指标（CEO 视角）──
        metrics: {
          users: { total: totalUsers, todayNew: todayNewUsers, monthNew: monthNewUsers, dau, vip: vipCount, paidUsers },
          enterprises: {
            total: totalEnterprises,
            active: activeEnterprises,
            subscriptions: subActive,
            autoRenew: subAutoRenew,
            monthNew: subMonthNew,
            subscriptionRevenue: Math.round(subRevenueTotal * 100) / 100,
          },
          revenue: {
            total: Math.round(((totalRevenue._sum.amount || 0) + subRevenueTotal) * 100) / 100,
            month: Math.round(((monthRevenue._sum.amount || 0) + subRevenueTotal) * 100) / 100,
            orders: (totalRevenue._sum.amount || 0),
            subscriptions: subRevenueTotal,
          },
          agents: { total: totalAgents, active: activeAgents },
          workspaces: { total: workspaceCount, orgs: totalEnterprises },
          ai: {
            todayCalls,
            monthCalls,
            totalCalls,
            todayCost: Math.round((todayCost._sum.cost || 0) * 100) / 100,
            monthCost: Math.round((monthCost._sum.cost || 0) * 100) / 100,
            totalCost: Math.round((totalCost._sum.cost || 0) * 100) / 100,
            todayTokens: num(todayTokens?.[0]?.total),
            monthTokens: num(monthTokens?.[0]?.total),
            totalTokens: num(totalTokens?.[0]?.total),
          },
        },
        // 兼容旧字段（T01 前端）
        users: {
          total: totalUsers,
          todayNew: todayNewUsers,
          monthNew: monthNewUsers,
          dau,
          vip: vipCount,
          paidUsers,
        },
        enterprises: {
          total: totalEnterprises,
          active: activeEnterprises,
          agents: totalAgents,
          activeAgents,
        },
        ai: {
          todayCalls,
          monthCalls,
          totalCalls,
          todayCost: Math.round((todayCost._sum.cost || 0) * 100) / 100,
          monthCost: Math.round((monthCost._sum.cost || 0) * 100) / 100,
          totalCost: Math.round((totalCost._sum.cost || 0) * 100) / 100,
          todayTokens: num(todayTokens?.[0]?.total),
          monthTokens: num(monthTokens?.[0]?.total),
          totalTokens: num(totalTokens?.[0]?.total),
        },
        agents: {
          total: totalAgents,
          active: activeAgents,
          tasks: agentTasks,
          errors: agentErrors,
          successRate,
        },
        trend: Array.from(trendMap.values()),
        topTasks: usageByTask.map((r) => ({
          taskType: r.taskType,
          calls: r._count.id,
          cost: Math.round((r._sum.cost || 0) * 100) / 100,
        })),
      },
    }
  })

  // ═══ 2. AI 基础设施（第二层）═══
  app.get('/api/admin/dashboard/ai-health', { preHandler: [requireAdmin] }, async () => {
    const now = new Date()
    const [providers, models, activeAgents, agentStates, usageToday, tokenTrend, costRank, taskStats] = await Promise.all([
      prisma.aiProvider.findMany({ orderBy: { createdAt: 'asc' } }).catch(() => []),
      prisma.aiModel.findMany({ take: 50, orderBy: { createdAt: 'desc' } }).catch(() => []),
      prisma.enterpriseAgentInstance.findMany({
        select: { id: true, runtimeStatus: true, lifecycleState: true, totalTasks: true, totalErrors: true, lastActiveAt: true },
      }).catch(() => []),
      prisma.enterpriseAgentInstance.groupBy({ by: ['lifecycleState'], _count: { id: true } }).catch(() => []),
      prisma.usageLog.groupBy({ by: ['provider'], where: cleanUsageWhere({ createdAt: { gte: new Date(Date.now() - 86400000) } }), _count: { id: true }, _sum: { cost: true } }),
      // Token 消耗趋势（近 14 天）
      prisma.$queryRawUnsafe(
        `SELECT to_char("createdAt", 'YYYY-MM-DD') AS day,
                COUNT(*) AS calls,
                COALESCE(SUM(CASE WHEN tokens ~ '^[0-9]+$' THEN CAST(tokens AS BIGINT) ELSE 0 END), 0) AS tokens,
                COALESCE(SUM(cost), 0) AS cost
         FROM usage_logs
         WHERE "createdAt" >= $1 AND provider NOT IN ($2) AND "taskType" NOT IN ($3)
         GROUP BY day ORDER BY day DESC LIMIT 14`,
        new Date(now.getTime() - 14 * 86400000), ...DIRTY_PROVIDERS, ...DIRTY_TASKS) as Promise<{ day: string; calls: bigint; tokens: bigint; cost: number }[]>,
      // 模型成本排行（近 30 天按 provider）
      prisma.usageLog.groupBy({
        by: ['provider'],
        where: cleanUsageWhere({ createdAt: { gte: new Date(now.getTime() - 30 * 86400000) } }),
        _count: { id: true },
        _sum: { cost: true },
        orderBy: { _sum: { cost: 'desc' } },
        take: 10,
      }),
      // Agent 任务成功率 + 平均响应时间
      prisma.enterpriseAgentTask.aggregate({
        _count: { id: true },
        _sum: { cost: true },
        _avg: { durationMs: true },
      }).catch(() => null),
    ])

    const providerStats = new Map(usageToday.map((r) => [r.provider, { calls: r._count.id, cost: r._sum.cost || 0 }]))
    const successRows = await prisma.enterpriseAgentTask.groupBy({
      by: ['status'],
      _count: { id: true },
    }).catch(() => [])
    const successTotal = successRows.reduce((s, r) => s + r._count.id, 0)
    const successOk = successRows.filter((r) => r.status === 'success' || r.status === 'completed').reduce((s, r) => s + r._count.id, 0)

    return {
      code: 0,
      data: {
        providers: providers.map((p) => ({
          id: p.id,
          providerCode: p.providerCode,
          name: p.name,
          status: p.credentialStatus || 'untested',
          enabled: p.enabled,
          todayCalls: providerStats.get(p.providerCode)?.calls || 0,
          todayCost: Math.round((providerStats.get(p.providerCode)?.cost || 0) * 100) / 100,
        })),
        modelCount: models.length,
        // Token 消耗趋势
        tokenTrend: (tokenTrend || []).map((r) => ({
          day: r.day,
          calls: Number(r.calls),
          tokens: Number(r.tokens),
          cost: Math.round(Number(r.cost) * 100) / 100,
        })),
        // 模型成本排行
        costRank: costRank.map((r) => ({
          provider: r.provider,
          calls: r._count.id,
          cost: Math.round((r._sum.cost || 0) * 100) / 100,
        })),
        // 模型成功率 + 平均响应时间
        taskHealth: {
          total: taskStats?._count.id || 0,
          cost: Math.round((taskStats?._sum.cost || 0) * 100) / 100,
          avgDurationMs: Math.round(taskStats?._avg.durationMs || 0),
          successRate: successTotal > 0 ? Math.round((successOk / successTotal) * 1000) / 10 : 100,
        },
        runtime: {
          agentInstances: activeAgents.length,
          active: activeAgents.filter((a) => a.runtimeStatus === 'active').length,
          paused: activeAgents.filter((a) => a.runtimeStatus === 'paused').length,
          stopped: activeAgents.filter((a) => a.runtimeStatus === 'stopped').length,
          lifecycleStates: agentStates.reduce<Record<string, number>>((acc, a) => {
            acc[a.lifecycleState] = (acc[a.lifecycleState] || 0) + 1
            return acc
          }, {}),
          totalTasks: activeAgents.reduce((s, a) => s + (a.totalTasks || 0), 0),
          totalErrors: activeAgents.reduce((s, a) => s + (a.totalErrors || 0), 0),
        },
        dirtyData: {
          dagExecutionCount: await prisma.usageLog.count({ where: { taskType: 'dag_execution' } }).catch(() => 0),
        },
      },
    }
  })

  // ═══ 3. Workspace 生态地图（第四层）═══
  app.get('/api/admin/dashboard/workspaces', { preHandler: [requireAdmin] }, async () => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [usageByTask, workspaces, users, projects, orgs] = await Promise.all([
      prisma.usageLog.groupBy({
        by: ['taskType'],
        where: cleanUsageWhere({ createdAt: { gte: startOfMonth } }),
        _count: { id: true },
        _sum: { cost: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),
      prisma.workspace.groupBy({ by: ['workspaceType'], _count: { id: true } }).catch(() => []),
      prisma.user.count(),
      prisma.project.groupBy({ by: ['type'], _count: { id: true } }).catch(() => []),
      prisma.organization.findMany({ select: { id: true, plan: true, name: true } }).catch(() => []),
    ])

    // taskType 前缀 → 业务线标签（生态地图卡片）
    const bizLabel = (t: string): { biz: string; label: string; icon: string } => {
      if (t.startsWith('hdz_')) return { biz: 'shortdrama', label: 'AI 短剧', icon: '🎬' }
      if (t.startsWith('enterprise_agent_recruitment')) return { biz: 'recruitment', label: '求职招聘', icon: '💼' }
      if (t.startsWith('enterprise_agent_career')) return { biz: 'career', label: '职业发展', icon: '🧭' }
      if (t.startsWith('enterprise_agent_')) return { biz: 'enterprise', label: '企业员工', icon: '🤖' }
      if (t.includes('novel')) return { biz: 'novel', label: '小说创作', icon: '📖' }
      if (t.includes('geo')) return { biz: 'geo', label: 'GEO 优化', icon: '📈' }
      if (t.includes('music')) return { biz: 'music', label: '音乐生成', icon: '🎵' }
      if (t.includes('law')) return { biz: 'law', label: '法律服务', icon: '⚖️' }
      return { biz: 'other', label: '其他', icon: '🧩' }
    }

    const agg = new Map<string, { biz: string; label: string; icon: string; calls: number; cost: number }>()
    for (const r of usageByTask) {
      const { biz, label, icon } = bizLabel(r.taskType)
      const cur = agg.get(label) || { biz, label, icon, calls: 0, cost: 0 }
      cur.calls += r._count.id
      cur.cost += r._sum.cost || 0
      agg.set(label, cur)
    }

    // 业务线 → 项目 type 映射（短剧=video+short_drama / 小说=novel / GEO=geo / 音乐=music）
    const projectTypeMap: Record<string, string[]> = {
      shortdrama: ['video', 'short_drama'],
      novel: ['novel'],
      geo: ['geo'],
      music: ['music'],
    }
    const projectCountByType = new Map(projects.map((p) => [p.type || 'custom', p._count.id]))

    const ecosystem = Array.from(agg.values())
      .sort((a, b) => b.calls - a.calls)
      .map((r) => ({
        ...r,
        cost: Math.round(r.cost * 100) / 100,
        projects: (projectTypeMap[r.biz] || []).reduce((s, t) => s + (projectCountByType.get(t) || 0), 0),
        enterprises: r.biz === 'recruitment' || r.biz === 'career' || r.biz === 'enterprise'
          ? orgs.filter((o) => o.plan !== 'free').length
          : 0,
      }))

    // Workspace 类型分布（workspace 表为空，按组织数 + 项目类型统计生态规模）
    const workspaceTypes = workspaces.map((w) => ({ type: w.workspaceType || 'unknown', count: w._count.id }))

    return {
      code: 0,
      data: {
        totalUsers: users,
        totalWorkspaces: workspaceTypes.reduce((s, w) => s + w.count, 0),
        totalProjects: projects.reduce((s, p) => s + p._count.id, 0),
        totalEnterprises: orgs.length,
        paidEnterprises: orgs.filter((o) => o.plan !== 'free').length,
        workspaceTypes,
        ranking: ecosystem,
      },
    }
  })

  // ═══ 4. AI 员工运营中心（第三层）═══
  app.get('/api/admin/dashboard/agents', { preHandler: [requireAdmin] }, async () => {
    const [instances, auditByAgent, orgs] = await Promise.all([
      prisma.enterpriseAgentInstance.findMany({
        select: { id: true, agentId: true, employeeId: true, runtimeStatus: true, totalTasks: true, totalErrors: true, lastActiveAt: true, createdAt: true, organizationId: true },
        orderBy: { totalTasks: 'desc' },
        take: 20,
      }).catch(() => []),
      prisma.agentAuditTrail.groupBy({
        by: ['agentId'],
        _count: { id: true },
        _sum: { cost: true },
      }).catch(() => []),
      prisma.organization.findMany({ select: { id: true, name: true, plan: true } }).catch(() => []),
    ])

    const auditMap = new Map(auditByAgent.map((r) => [r.agentId, { tasks: r._count.id, cost: r._sum.cost || 0 }]))
    const orgMap = new Map(orgs.map((o) => [o.id, o]))
    const activeOrgIds = new Set(instances.filter((a) => a.runtimeStatus === 'active').map((a) => a.organizationId).filter(Boolean))

    return {
      code: 0,
      data: {
        agents: instances.map((a) => {
          const audit = auditMap.get(a.agentId)
          const total = a.totalTasks || 0
          const org = a.organizationId ? orgMap.get(a.organizationId) : null
          return {
            id: a.id,
            agentId: a.agentId,
            employeeId: a.employeeId,
            status: a.runtimeStatus,
            totalTasks: total,
            totalErrors: a.totalErrors || 0,
            successRate: total > 0 ? Math.round(((total - (a.totalErrors || 0)) / total) * 1000) / 10 : 100,
            lastActiveAt: a.lastActiveAt,
            createdAt: a.createdAt,
            auditTasks: audit?.tasks || 0,
            auditCost: Math.round((audit?.cost || 0) * 100) / 100,
            // 第三层：Agent 活跃企业
            orgName: org?.name || '—',
            orgPlan: org?.plan || '—',
          }
        }),
        // Agent 活跃企业（去重）
        activeEnterprises: {
          count: activeOrgIds.size,
          names: orgs.filter((o) => activeOrgIds.has(o.id)).map((o) => o.name),
        },
      },
    }
  })

  // ═══ 5. 商业增长（第五层）═══
  app.get('/api/admin/dashboard/revenue', { preHandler: [requireAdmin] }, async () => {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [todayOrders, monthOrders, allOrders, vipUsers, subscriptions, plans, monthVipNew, enterpriseSubs, memberPlans, orgs] = await Promise.all([
      prisma.paymentOrder.findMany({ where: { status: 'paid', payTime: { gte: startOfDay } }, select: { amount: true, currency: true } }),
      prisma.paymentOrder.findMany({ where: { status: 'paid', payTime: { gte: startOfMonth } }, select: { amount: true, currency: true } }),
      prisma.paymentOrder.findMany({ where: { status: 'paid' }, select: { amount: true, currency: true, payTime: true } }),
      prisma.user.count({ where: { memberTier: { not: 'free' } } }),
      prisma.subscription.findMany({ include: { plan: true } }).catch(() => []),
      prisma.subscriptionPlan.findMany({ where: { status: 'active' } }).catch(() => []),
      prisma.user.count({ where: { memberTier: { not: 'free' }, updatedAt: { gte: startOfMonth } } }),
      // 企业订阅（快照价格单位为分）
      prisma.enterpriseSubscription.findMany({
        select: { id: true, planId: true, status: true, snapshotName: true, snapshotPrice: true, snapshotCycle: true, startAt: true, expireAt: true, autoRenew: true, organizationId: true },
      }).catch(() => []),
      // VIP 套餐分布
      prisma.memberPlan.findMany({ where: { enabled: true }, select: { level: true, name: true, price: true } }).catch(() => []),
      // 企业
      prisma.organization.findMany({ select: { id: true, name: true, plan: true } }).catch(() => []),
    ])

    const sum = (rows: { amount: number }[]) => rows.reduce((s, r) => s + r.amount, 0)
    const monthRevenue = sum(monthOrders)
    const todayRevenue = sum(todayOrders)

    // 近 6 月收入（按 payTime）
    const monthMap = new Map<string, number>()
    for (const o of allOrders) {
      if (!o.payTime) continue
      const d = new Date(o.payTime)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthMap.set(key, (monthMap.get(key) || 0) + o.amount)
    }
    const monthlyTrend = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, revenue]) => ({ month, revenue: Math.round(revenue * 100) / 100 }))

    const subscriptionBreakdown = plans.map((p) => {
      const subs = subscriptions.filter((s) => s.planId === p.id)
      return {
        planCode: p.code,
        planName: p.name,
        price: p.price || 0,
        currency: p.currency,
        billingCycle: p.billingCycle,
        activeCount: subs.filter((s) => s.status === 'active').length,
        totalCount: subs.length,
      }
    })

    // ── 企业订阅趋势（按开始月份，快照价分→元）──
    const entMonthMap = new Map<string, number>()
    for (const s of enterpriseSubs) {
      if (!s.snapshotPrice) continue
      const d = new Date(s.startAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      entMonthMap.set(key, (entMonthMap.get(key) || 0) + (s.snapshotPrice / 100))
    }
    const enterpriseTrend = Array.from(entMonthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, revenue]) => ({ month, revenue: Math.round(revenue * 100) / 100 }))

    // ── 续费率：活跃订阅中开启自动续费的比例 ──
    const entActive = enterpriseSubs.filter((s) => s.status === 'active')
    const entAutoRenew = entActive.filter((s) => s.autoRenew).length
    const renewalRate = entActive.length > 0 ? Math.round((entAutoRenew / entActive.length) * 1000) / 10 : 0

    // ── 企业订阅套餐分布（snapshotName 聚合）──
    const entPlanMap = new Map<string, { name: string; count: number; revenue: number }>()
    for (const s of enterpriseSubs) {
      const name = s.snapshotName || '未命名套餐'
      const cur = entPlanMap.get(name) || { name, count: 0, revenue: 0 }
      cur.count += 1
      cur.revenue += (s.snapshotPrice || 0) / 100
      entPlanMap.set(name, cur)
    }
    const enterprisePlanBreakdown = Array.from(entPlanMap.values()).map((p) => ({
      ...p,
      revenue: Math.round(p.revenue * 100) / 100,
    }))

    // ── 企业客户生命周期（平均订阅时长）──
    const lifecycles = entActive.map((s) => (s.expireAt ? (s.expireAt.getTime() - s.startAt.getTime()) / 86400000 : 0)).filter((d) => d > 0)
    const avgLifecycleDays = lifecycles.length > 0 ? Math.round(lifecycles.reduce((a, b) => a + b, 0) / lifecycles.length) : 0

    return {
      code: 0,
      data: {
        todayRevenue: Math.round(todayRevenue * 100) / 100,
        monthRevenue: Math.round(monthRevenue * 100) / 100,
        totalRevenue: Math.round(sum(allOrders) * 100) / 100,
        orderCount: allOrders.length,
        monthlyTrend,
        vip: { count: vipUsers, monthNew: monthVipNew },
        subscriptions: {
          active: subscriptions.filter((s) => s.status === 'active').length,
          total: subscriptions.length,
          breakdown: subscriptionBreakdown,
        },
        // 第五层：企业订阅
        enterprise: {
          total: enterpriseSubs.length,
          active: entActive.length,
          autoRenew: entAutoRenew,
          renewalRate,
          avgLifecycleDays,
          revenue: Math.round(entActive.reduce((s, sub) => s + ((sub.snapshotPrice || 0) / 100), 0) * 100) / 100,
          trend: enterpriseTrend,
          planBreakdown: enterprisePlanBreakdown,
          customers: orgs.filter((o) => o.plan !== 'free').map((o) => ({ name: o.name, plan: o.plan })),
        },
        // VIP 套餐分布
        memberPlans: memberPlans.map((p) => ({ level: p.level, name: p.name, price: p.price })),
        // 转化漏斗（注册 → 付费 → VIP）
        funnel: {
          registered: await prisma.user.count(),
          paidUsers: await prisma.paymentOrder.groupBy({ by: ['userId'], where: { status: 'paid' } }).then((r) => r.length),
          vipUsers: vipUsers,
        },
      },
    }
  })

  // ═══ 7. 系统健康（第六层）═══
  app.get('/api/admin/dashboard/system-health', { preHandler: [requireAdmin] }, async () => {
    const now = new Date()
    const results: Record<string, { status: 'ok' | 'warn' | 'error'; label: string; detail: string }> = {}

    // 1. 数据库
    try {
      await prisma.$queryRawUnsafe(`SELECT 1`)
      results.database = { status: 'ok', label: '数据库', detail: 'PostgreSQL 连接正常' }
    } catch (e: any) {
      results.database = { status: 'error', label: '数据库', detail: e?.message || '连接失败' }
    }

    // 2. Redis
    try {
      const { getRedis } = await import('../utils/redis-state.js')
      const redis = await getRedis()
      await redis.ping()
      results.redis = { status: 'ok', label: 'Redis', detail: 'PONG' }
    } catch (e: any) {
      results.redis = { status: 'error', label: 'Redis', detail: e?.message || '连接失败' }
    }

    // 3. 任务队列（排队中/运行中任务数）
    try {
      const [queued, running] = await Promise.all([
        prisma.enterpriseAgentTask.count({ where: { status: { in: ['queued', 'pending'] } } }).catch(() => 0),
        prisma.enterpriseAgentTask.count({ where: { status: 'running' } }).catch(() => 0),
      ])
      results.queue = { status: 'ok', label: '任务队列', detail: `排队 ${queued} · 运行 ${running}` }
    } catch (e: any) {
      results.queue = { status: 'warn', label: '任务队列', detail: e?.message || '未知' }
    }

    // 4. API 服务（进程存活 + 启动时长）
    try {
      const uptimeSec = Math.round(process.uptime())
      const days = Math.floor(uptimeSec / 86400)
      const hrs = Math.floor((uptimeSec % 86400) / 3600)
      results.api = { status: 'ok', label: 'API 服务', detail: `运行 ${days}d ${hrs}h · pid ${process.pid}` }
    } catch {
      results.api = { status: 'error', label: 'API 服务', detail: '未知' }
    }

    // 5. 模型服务（Provider 凭据状态）
    try {
      const providers = await prisma.aiProvider.findMany({ select: { providerCode: true, credentialStatus: true, enabled: true } }).catch(() => [])
      const ready = providers.filter((p) => p.enabled && p.credentialStatus !== 'invalid').length
      const invalid = providers.filter((p) => p.credentialStatus === 'invalid').length
      results.models = {
        status: invalid > 0 ? 'warn' : 'ok',
        label: '模型服务',
        detail: `可用 ${ready}/${providers.length}${invalid ? ` · ${invalid} 个凭据失效` : ''}`,
      }
    } catch (e: any) {
      results.models = { status: 'warn', label: '模型服务', detail: e?.message || '未知' }
    }

    // 6. COS 对象存储（未配置则 warn）
    const cosBucket = process.env.COS_BUCKET || process.env.TENCENT_COS_BUCKET || ''
    results.cos = cosBucket
      ? { status: 'ok', label: 'COS 对象存储', detail: `Bucket: ${cosBucket}` }
      : { status: 'warn', label: 'COS 对象存储', detail: '未配置（不影响核心链路）' }

    const statusOrder = ['error', 'warn', 'ok']
    const overall = statusOrder.find((s) => Object.values(results).some((r) => r.status === s)) || 'ok'

    return {
      code: 0,
      data: {
        generatedAt: now.toISOString(),
        overall,
        checks: results,
      },
    }
  })

  // ═══ 8. 实时事件流 ═══
  app.get('/api/admin/dashboard/activity', { preHandler: [requireAdmin] }, async () => {
    const now = new Date()
    const since = new Date(now.getTime() - 72 * 3600000)

    const [audits, usages, payments, users] = await Promise.all([
      prisma.agentAuditTrail.findMany({
        where: { createdAt: { gte: since }, action: { notIn: ['system.startup_recovery'] } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, action: true, agentId: true, cost: true, createdAt: true },
      }).catch(() => []),
      prisma.usageLog.findMany({
        where: cleanUsageWhere({ createdAt: { gte: since } }),
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, taskType: true, provider: true, cost: true, createdAt: true },
      }),
      prisma.paymentOrder.findMany({
        where: { status: 'paid', payTime: { gte: since } },
        orderBy: { payTime: 'desc' },
        take: 4,
        select: { id: true, amount: true, planType: true, payTime: true },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, username: true, createdAt: true },
      }),
    ])

    const events: { time: string; icon: string; text: string; kind: string }[] = []

    for (const u of users) {
      events.push({ time: u.createdAt.toISOString(), icon: '👤', text: `新用户注册：${u.username}`, kind: 'user' })
    }
    for (const p of payments) {
      events.push({ time: (p.payTime ? new Date(p.payTime).toISOString() : now.toISOString()), icon: '💰', text: `用户购买 ${p.planType || 'VIP'} ¥${p.amount}`, kind: 'payment' })
    }
    for (const u of usages) {
      events.push({ time: u.createdAt.toISOString(), icon: '🤖', text: `${u.taskType} 调用成功（${u.provider}）`, kind: 'usage' })
    }
    for (const a of audits) {
      events.push({ time: a.createdAt.toISOString(), icon: '⚙️', text: `${a.action}${a.agentId ? ` · ${a.agentId}` : ''}`, kind: 'audit' })
    }

    events.sort((a, b) => b.time.localeCompare(a.time))

    return { code: 0, data: { events: events.slice(0, 20) } }
  })
}
