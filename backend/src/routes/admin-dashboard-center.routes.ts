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

  // ═══ 1. 平台健康总览 ═══
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

    return {
      code: 0,
      data: {
        generatedAt: now.toISOString(),
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

  // ═══ 2. AI 基础设施健康 ═══
  app.get('/api/admin/dashboard/ai-health', { preHandler: [requireAdmin] }, async () => {
    const [providers, models, activeAgents, agentStates, usageToday] = await Promise.all([
      prisma.aiProvider.findMany({ orderBy: { createdAt: 'asc' } }).catch(() => []),
      prisma.aiModel.findMany({ take: 50, orderBy: { createdAt: 'desc' } }).catch(() => []),
      prisma.enterpriseAgentInstance.findMany({
        select: { id: true, runtimeStatus: true, lifecycleState: true, totalTasks: true, totalErrors: true, lastActiveAt: true },
      }).catch(() => []),
      prisma.enterpriseAgentInstance.groupBy({ by: ['lifecycleState'], _count: { id: true } }).catch(() => []),
      prisma.usageLog.groupBy({ by: ['provider'], where: cleanUsageWhere({ createdAt: { gte: new Date(Date.now() - 86400000) } }), _count: { id: true }, _sum: { cost: true } }),
    ])

    const providerStats = new Map(usageToday.map((r) => [r.provider, { calls: r._count.id, cost: r._sum.cost || 0 }]))

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

  // ═══ 3. Workspace 运营地图 ═══
  app.get('/api/admin/dashboard/workspaces', { preHandler: [requireAdmin] }, async () => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [usageByTask, workspaces, users] = await Promise.all([
      prisma.usageLog.groupBy({
        by: ['taskType'],
        where: cleanUsageWhere({ createdAt: { gte: startOfMonth } }),
        _count: { id: true },
        _sum: { cost: true },
        orderBy: { _count: { id: 'desc' } },
        take: 15,
      }),
      prisma.workspace.groupBy({ by: ['workspaceType'], _count: { id: true } }).catch(() => []),
      prisma.user.count(),
    ])

    // taskType 前缀 → 业务线标签
    const bizLabel = (t: string): { biz: string; label: string } => {
      if (t.startsWith('hdz_')) return { biz: 'shortdrama', label: 'AI 短剧' }
      if (t.startsWith('enterprise_agent_recruitment')) return { biz: 'recruitment', label: '招聘' }
      if (t.startsWith('enterprise_agent_career')) return { biz: 'career', label: '职业' }
      if (t.startsWith('enterprise_agent_')) return { biz: 'enterprise', label: '企业员工' }
      if (t.includes('novel')) return { biz: 'novel', label: '小说' }
      if (t.includes('geo')) return { biz: 'geo', label: 'GEO' }
      if (t.includes('music')) return { biz: 'music', label: '音乐' }
      return { biz: 'other', label: '其他' }
    }

    const agg = new Map<string, { label: string; calls: number; cost: number }>()
    for (const r of usageByTask) {
      const { label } = bizLabel(r.taskType)
      const cur = agg.get(label) || { label, calls: 0, cost: 0 }
      cur.calls += r._count.id
      cur.cost += r._sum.cost || 0
      agg.set(label, cur)
    }

    return {
      code: 0,
      data: {
        totalUsers: users,
        workspaceTypes: workspaces.map((w) => ({ type: w.workspaceType || 'unknown', count: w._count.id })),
        ranking: Array.from(agg.values())
          .sort((a, b) => b.calls - a.calls)
          .map((r) => ({ ...r, cost: Math.round(r.cost * 100) / 100 })),
      },
    }
  })

  // ═══ 4. AI 员工运营中心 ═══
  app.get('/api/admin/dashboard/agents', { preHandler: [requireAdmin] }, async () => {
    const [instances, auditByAgent] = await Promise.all([
      prisma.enterpriseAgentInstance.findMany({
        select: { id: true, agentId: true, employeeId: true, runtimeStatus: true, totalTasks: true, totalErrors: true, lastActiveAt: true, createdAt: true },
        orderBy: { totalTasks: 'desc' },
        take: 20,
      }).catch(() => []),
      prisma.agentAuditTrail.groupBy({
        by: ['agentId'],
        _count: { id: true },
        _sum: { cost: true },
      }).catch(() => []),
    ])

    const auditMap = new Map(auditByAgent.map((r) => [r.agentId, { tasks: r._count.id, cost: r._sum.cost || 0 }]))

    return {
      code: 0,
      data: {
        agents: instances.map((a) => {
          const audit = auditMap.get(a.agentId)
          const total = a.totalTasks || 0
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
          }
        }),
      },
    }
  })

  // ═══ 5. 商业数据 ═══
  app.get('/api/admin/dashboard/revenue', { preHandler: [requireAdmin] }, async () => {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [todayOrders, monthOrders, allOrders, vipUsers, subscriptions, plans, monthVipNew] = await Promise.all([
      prisma.paymentOrder.findMany({ where: { status: 'paid', payTime: { gte: startOfDay } }, select: { amount: true, currency: true } }),
      prisma.paymentOrder.findMany({ where: { status: 'paid', payTime: { gte: startOfMonth } }, select: { amount: true, currency: true } }),
      prisma.paymentOrder.findMany({ where: { status: 'paid' }, select: { amount: true, currency: true, payTime: true } }),
      prisma.user.count({ where: { memberTier: { not: 'free' } } }),
      prisma.subscription.findMany({ include: { plan: true } }).catch(() => []),
      prisma.subscriptionPlan.findMany({ where: { status: 'active' } }).catch(() => []),
      prisma.user.count({ where: { memberTier: { not: 'free' }, updatedAt: { gte: startOfMonth } } }),
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
        // 转化漏斗（注册 → 付费 → VIP）
        funnel: {
          registered: await prisma.user.count(),
          paidUsers: await prisma.paymentOrder.groupBy({ by: ['userId'], where: { status: 'paid' } }).then((r) => r.length),
          vipUsers: vipUsers,
        },
      },
    }
  })

  // ═══ 6. 实时事件流 ═══
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
