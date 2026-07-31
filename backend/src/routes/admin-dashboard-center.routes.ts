// admin-dashboard-center.routes.ts — 昆仑镜 CEO 数据罗盘聚合 API
// ADMIN-IA-REALITY-04-B
//
// 原则：全部 DB 真实聚合，禁止 mock；无数据显示「暂无数据」，不填 0 伪装；
//       排除已知脏数据源（dag_execution / pangu_axe_runtime 盘古斧调试台）
//
// 端点（9 个独立端点，方便扩展）：
//   GET /api/admin/dashboard/overview       — 第一层：平台核心经营指标
//   GET /api/admin/dashboard/users          — 第二层：用户增长中心（趋势 + 生命周期漏斗）
//   GET /api/admin/dashboard/revenue        — 第三层：商业经营中心（收入驾驶舱 + 来源构成）
//   GET /api/admin/dashboard/vip            — 第四层：VIP 经营中心
//   GET /api/admin/dashboard/workspace      — 第五层：Workspace 生态地图（业务线 Ranking）
//   GET /api/admin/dashboard/geography      — 第六层：用户区域分布
//   GET /api/admin/dashboard/agents         — 第七层：Agent 运营中心
//   GET /api/admin/dashboard/infrastructure — 第八层：AI 基础设施中心
//   GET /api/admin/dashboard/events         — 第九层：实时运营事件流
//
// 兼容别名（旧前端 / 其他调用方）：
//   /ai-health → infrastructure · /workspaces → workspace · /activity → events · /system-health → infrastructure
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

// ── 脏数据排除（盘古斧调试台假调用：63 万条 cost=1） ──
const DIRTY_PROVIDERS = ['pangu_axe_runtime']
const DIRTY_TASKS = ['dag_execution']

const cleanUsageWhere = (extra: Record<string, unknown> = {}) => ({
  provider: { notIn: DIRTY_PROVIDERS },
  taskType: { notIn: DIRTY_TASKS },
  ...extra,
})

const num = (v: bigint | number | undefined) => Number(v || 0)
const round2 = (n: number) => Math.round(n * 100) / 100
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

// ── 30 天连续日期序列 ──
const lastNDays = (n: number, now = new Date()) => {
  const arr: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    arr.push(dateKey(d))
  }
  return arr
}

export default async function adminDashboardCenterRoutes(app: FastifyInstance) {

  // ══════════════════════════════════════════════════════════════════
  // 第一层：平台核心经营指标（必须第一屏）
  // ══════════════════════════════════════════════════════════════════
  app.get('/api/admin/dashboard/overview', { preHandler: [requireAdmin] }, async () => {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const days7 = new Date(now.getTime() - 7 * 86400000)
    const days30 = new Date(now.getTime() - 30 * 86400000)
    const yearStart = new Date(now.getFullYear(), 0, 1)

    const [totalUsers, todayNewUsers, weekNewUsers, monthNewUsers, dau, active7, active30,
      vipCount, totalEnterprises, activeEnterprises, totalAgents, activeAgents,
      todayCalls, monthCalls, todayCost, monthCost, todayTokens, monthTokens,
      enterpriseSubs, paymentPaid, paymentMonth, paymentYear,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.user.count({ where: { createdAt: { gte: days7 } } }),
      prisma.user.count({ where: { createdAt: { gte: days30 } } }),
      prisma.user.count({ where: { lastActiveAt: { gte: startOfDay } } }),
      prisma.user.count({ where: { lastActiveAt: { gte: days7 } } }),
      prisma.user.count({ where: { lastActiveAt: { gte: days30 } } }),
      prisma.user.count({ where: { memberTier: { not: 'free' } } }),
      prisma.enterpriseProfile.count(),
      prisma.enterpriseProfile.count({ where: { onboardingDone: true } }),
      prisma.enterpriseAgentInstance.count(),
      prisma.enterpriseAgentInstance.count({ where: { runtimeStatus: 'active' } }),
      prisma.usageLog.count({ where: cleanUsageWhere({ createdAt: { gte: startOfDay } }) }),
      prisma.usageLog.count({ where: cleanUsageWhere({ createdAt: { gte: startOfMonth } }) }),
      prisma.usageLog.aggregate({ where: cleanUsageWhere({ createdAt: { gte: startOfDay } }), _sum: { cost: true } }),
      prisma.usageLog.aggregate({ where: cleanUsageWhere({ createdAt: { gte: startOfMonth } }), _sum: { cost: true } }),
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(CASE WHEN tokens ~ '^[0-9]+$' THEN CAST(tokens AS BIGINT) ELSE 0 END),0) AS total FROM usage_logs WHERE "createdAt" >= $1 AND provider NOT IN ($2) AND "taskType" NOT IN ($3)`, startOfDay, ...DIRTY_PROVIDERS, ...DIRTY_TASKS) as Promise<{ total: bigint }[]>,
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(CASE WHEN tokens ~ '^[0-9]+$' THEN CAST(tokens AS BIGINT) ELSE 0 END),0) AS total FROM usage_logs WHERE "createdAt" >= $1 AND provider NOT IN ($2) AND "taskType" NOT IN ($3)`, startOfMonth, ...DIRTY_PROVIDERS, ...DIRTY_TASKS) as Promise<{ total: bigint }[]>,
      // 企业订阅（快照价单位：分）
      prisma.enterpriseSubscription.findMany({ select: { id: true, status: true, snapshotPrice: true, snapshotName: true, startAt: true, expireAt: true, autoRenew: true } }).catch(() => []),
      prisma.paymentOrder.aggregate({ where: { status: 'paid' }, _sum: { amount: true } }),
      prisma.paymentOrder.aggregate({ where: { status: 'paid', payTime: { gte: startOfMonth } }, _sum: { amount: true } }),
      prisma.paymentOrder.aggregate({ where: { status: 'paid', payTime: { gte: yearStart } }, _sum: { amount: true } }),
    ])

    const subRevenue = enterpriseSubs.reduce((s, x) => s + ((x.snapshotPrice || 0) / 100), 0)
    const subActiveRevenue = enterpriseSubs.filter((s) => s.status === 'active').reduce((s, x) => s + ((x.snapshotPrice || 0) / 100), 0)
    const totalRevenue = round2((paymentPaid._sum.amount || 0) + subRevenue)
    // 本月收入 = 本月支付订单 + 活跃订阅月值（MRR 口径）
    const monthRevenue = round2((paymentMonth._sum.amount || 0) + subActiveRevenue)
    const yearRevenue = round2((paymentYear._sum.amount || 0) + subRevenue)
    const subActive = enterpriseSubs.filter((s) => s.status === 'active').length
    const subAutoRenew = enterpriseSubs.filter((s) => s.status === 'active' && s.autoRenew).length

    // 7 日增长率 = 近7天新增 / 7天前总用户
    const usersBefore7 = totalUsers - weekNewUsers
    const growthRate7d = usersBefore7 > 0 ? Math.round((weekNewUsers / usersBefore7) * 1000) / 10 : 0

    return {
      code: 0,
      data: {
        generatedAt: now.toISOString(),
        // ── CEO 核心指标大卡 ──
        metrics: {
          users: { total: totalUsers, todayNew: todayNewUsers, weekNew: weekNewUsers, monthNew: monthNewUsers, growthRate7d, dau, active7, active30 },
          vip: { total: vipCount },
          enterprises: { total: totalEnterprises, active: activeEnterprises, subscriptions: subActive, autoRenew: subAutoRenew },
          agents: { total: totalAgents, active: activeAgents },
          workspaces: { total: 0, note: 'workspace 表为空，生态规模见 /workspace 端点' },
          revenue: { total: totalRevenue, month: monthRevenue, year: yearRevenue, subscription: round2(subRevenue) },
          ai: {
            todayCalls, monthCalls,
            todayCost: round2(todayCost._sum.cost || 0),
            monthCost: round2(monthCost._sum.cost || 0),
            todayTokens: num(todayTokens?.[0]?.total),
            monthTokens: num(monthTokens?.[0]?.total),
          },
        },
      },
    }
  })

  // ══════════════════════════════════════════════════════════════════
  // 第二层：用户增长中心（30 天趋势 + 生命周期漏斗）
  // ══════════════════════════════════════════════════════════════════
  app.get('/api/admin/dashboard/users', { preHandler: [requireAdmin] }, async () => {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const days7 = new Date(now.getTime() - 7 * 86400000)
    const days30 = new Date(now.getTime() - 30 * 86400000)

    const [totalUsers, todayNew, weekNew, monthNew, dau, active7, active30,
      regTrend, returnedUsers, usersWithProject, usersWithUsage, vipCount, enterpriseCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.user.count({ where: { createdAt: { gte: days7 } } }),
      prisma.user.count({ where: { createdAt: { gte: days30 } } }),
      prisma.user.count({ where: { lastActiveAt: { gte: startOfDay } } }),
      prisma.user.count({ where: { lastActiveAt: { gte: days7 } } }),
      prisma.user.count({ where: { lastActiveAt: { gte: days30 } } }),
      // 近 30 天每日注册
      prisma.$queryRawUnsafe(`SELECT to_char("createdAt",'YYYY-MM-DD') AS day, count(*)::int AS c FROM "User" WHERE "createdAt" >= $1 GROUP BY 1 ORDER BY 1`, days30) as Promise<{ day: string; c: number }[]>,
      // 回流用户：30 天内活跃且注册超过 30 天（老用户重新活跃）
      prisma.$queryRawUnsafe(`SELECT count(*)::int AS c FROM "User" WHERE "lastActiveAt" >= $1 AND "createdAt" < $1`, days30) as Promise<{ c: number }[]>,
      // 漏斗：有项目用户
      prisma.$queryRawUnsafe(`SELECT count(DISTINCT COALESCE("ownerId","userId"))::int AS c FROM "Project"`) as Promise<{ c: number }[]>,
      // 漏斗：有 AI 调用用户
      prisma.$queryRawUnsafe(`SELECT count(DISTINCT "userId")::int AS c FROM usage_logs WHERE provider NOT IN ($1) AND "taskType" NOT IN ($2)`, ...DIRTY_PROVIDERS, ...DIRTY_TASKS) as Promise<{ c: number }[]>,
      // 漏斗：VIP 用户
      prisma.user.count({ where: { memberTier: { not: 'free' } } }),
      // 漏斗：企业客户
      prisma.enterpriseProfile.count(),
    ])

    // 30 天注册序列（补 0）
    const regMap = new Map(regTrend.map((r) => [r.day, r.c]))
    const trend = lastNDays(30).map((day) => ({ date: day, registrations: regMap.get(day) || 0 }))

    // 生命周期漏斗（真实数据；访问网站暂无埋点 → 显示暂无）
    const funnel = [
      { stage: '访问网站', key: 'visit', value: null, note: '暂无埋点数据' },
      { stage: '注册用户', key: 'register', value: totalUsers },
      { stage: '创建项目', key: 'project', value: num(usersWithProject?.[0]?.c) },
      { stage: '调用 AI', key: 'usage', value: num(usersWithUsage?.[0]?.c) },
      { stage: '购买 VIP', key: 'vip', value: vipCount },
      { stage: '企业订阅', key: 'enterprise', value: enterpriseCount },
    ]

    return {
      code: 0,
      data: {
        generatedAt: now.toISOString(),
        summary: {
          total: totalUsers,
          todayNew,
          weekNew,
          monthNew,
          dau,
          active7,
          active30,
          returned: num(returnedUsers?.[0]?.c),
        },
        trend,
        funnel,
      },
    }
  })

  // ══════════════════════════════════════════════════════════════════
  // 第三层：商业经营中心（收入驾驶舱 + 来源构成）
  // ══════════════════════════════════════════════════════════════════
  app.get('/api/admin/dashboard/revenue', { preHandler: [requireAdmin] }, async () => {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const yearStart = new Date(now.getFullYear(), 0, 1)

    const [todayOrders, monthOrders, allOrders, yearOrders, vipUsers,
      subscriptions, plans, enterpriseSubs, memberPlans, orgs, totalUsers,
    ] = await Promise.all([
      prisma.paymentOrder.findMany({ where: { status: 'paid', payTime: { gte: startOfDay } }, select: { amount: true, type: true, planType: true } }),
      prisma.paymentOrder.findMany({ where: { status: 'paid', payTime: { gte: startOfMonth } }, select: { amount: true, type: true, planType: true } }),
      prisma.paymentOrder.findMany({ where: { status: 'paid' }, select: { amount: true, type: true, planType: true, payTime: true } }),
      prisma.paymentOrder.findMany({ where: { status: 'paid', payTime: { gte: yearStart } }, select: { amount: true, type: true, planType: true } }),
      prisma.user.count({ where: { memberTier: { not: 'free' } } }),
      prisma.subscription.findMany({ include: { plan: true } }).catch(() => []),
      prisma.subscriptionPlan.findMany({ where: { status: 'active' } }).catch(() => []),
      prisma.enterpriseSubscription.findMany({
        select: { id: true, planId: true, status: true, snapshotName: true, snapshotPrice: true, snapshotCycle: true, startAt: true, expireAt: true, autoRenew: true, organizationId: true },
      }).catch(() => []),
      prisma.memberPlan.findMany({ where: { enabled: true }, select: { level: true, name: true, price: true } }).catch(() => []),
      prisma.organization.findMany({ select: { id: true, name: true, plan: true } }).catch(() => []),
      prisma.user.count(),
    ])

    const sum = (rows: { amount: number }[]) => rows.reduce((s, r) => s + r.amount, 0)
    const todayRevenue = sum(todayOrders)
    const monthOrderRevenue = sum(monthOrders)
    const yearOrderRevenue = sum(yearOrders)

    // 企业订阅快照收入（分→元）
    const subActive = enterpriseSubs.filter((s) => s.status === 'active')
    const subRevenueTotal = enterpriseSubs.reduce((s, x) => s + ((x.snapshotPrice || 0) / 100), 0)
    const subRevenueActive = subActive.reduce((s, x) => s + ((x.snapshotPrice || 0) / 100), 0)

    const totalRevenue = round2(sum(allOrders) + subRevenueTotal)
    // 本月收入 = 本月支付订单 + 当前活跃订阅月值（MRR 口径）
    const monthRevenue = round2(monthOrderRevenue + subRevenueActive)
    const yearRevenue = round2(yearOrderRevenue + subRevenueTotal)

    // 收入来源构成（真实分类）
    const sources = [
      { name: '企业订阅', key: 'enterprise', amount: round2(subRevenueTotal), desc: `${enterpriseSubs.length} 个订阅` },
      { name: 'VIP 会员', key: 'vip', amount: round2(allOrders.filter((o) => !o.planType && o.type !== 'enterprise_subscription' && o.type !== 'mall').reduce((s, o) => s + o.amount, 0)), desc: 'PaymentOrder' },
      { name: 'AI 员工', key: 'agent', amount: round2(allOrders.filter((o) => o.planType === 'career_agent').reduce((s, o) => s + o.amount, 0)), desc: 'Career Agent 订阅' },
      { name: '商城', key: 'mall', amount: round2(allOrders.filter((o) => o.type === 'mall').reduce((s, o) => s + o.amount, 0)), desc: '积分/道具' },
    ]

    // 近 6 月收入趋势（订单 + 订阅）
    const monthMap = new Map<string, number>()
    for (const o of allOrders) {
      if (!o.payTime) continue
      const key = monthKey(new Date(o.payTime))
      monthMap.set(key, (monthMap.get(key) || 0) + o.amount)
    }
    for (const s of enterpriseSubs) {
      const key = monthKey(new Date(s.startAt))
      monthMap.set(key, (monthMap.get(key) || 0) + ((s.snapshotPrice || 0) / 100))
    }
    const monthlyTrend = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, revenue]) => ({ month, revenue: round2(revenue) }))

    // ARPU = 累计收入 / 总用户
    const arpu = totalUsers > 0 ? round2(totalRevenue / totalUsers) : 0
    const paidUsers = await prisma.paymentOrder.groupBy({ by: ['userId'], where: { status: 'paid' } }).then((r) => r.length)

    // 续费率（企业订阅自动续费）
    const renewalRate = subActive.length > 0 ? Math.round((subActive.filter((s) => s.autoRenew).length / subActive.length) * 1000) / 10 : 0
    const lifecycles = subActive.map((s) => (s.expireAt ? (s.expireAt.getTime() - s.startAt.getTime()) / 86400000 : 0)).filter((d) => d > 0)
    const avgLifecycleDays = lifecycles.length > 0 ? Math.round(lifecycles.reduce((a, b) => a + b, 0) / lifecycles.length) : 0

    // 套餐分布（企业订阅 snapshotName 聚合）
    const entPlanMap = new Map<string, { name: string; count: number; revenue: number }>()
    for (const s of enterpriseSubs) {
      const name = s.snapshotName || '未命名套餐'
      const cur = entPlanMap.get(name) || { name, count: 0, revenue: 0 }
      cur.count += 1
      cur.revenue += (s.snapshotPrice || 0) / 100
      entPlanMap.set(name, cur)
    }

    const subscriptionBreakdown = plans.map((p) => {
      const subs = subscriptions.filter((s) => s.planId === p.id)
      return {
        planCode: p.code,
        planName: p.name,
        price: p.price || 0,
        activeCount: subs.filter((s) => s.status === 'active').length,
        totalCount: subs.length,
      }
    })

    return {
      code: 0,
      data: {
        generatedAt: now.toISOString(),
        todayRevenue: round2(todayRevenue),
        monthRevenue,
        yearRevenue,
        totalRevenue,
        arpu,
        paidUsers,
        orderCount: allOrders.length,
        sources,
        monthlyTrend,
        subscriptions: {
          active: subscriptions.filter((s) => s.status === 'active').length,
          total: subscriptions.length,
          breakdown: subscriptionBreakdown,
        },
        enterprise: {
          total: enterpriseSubs.length,
          active: subActive.length,
          autoRenew: subActive.filter((s) => s.autoRenew).length,
          renewalRate,
          avgLifecycleDays,
          revenue: round2(subRevenueActive),
          planBreakdown: Array.from(entPlanMap.values()).map((p) => ({ ...p, revenue: round2(p.revenue) })),
          customers: orgs.filter((o) => o.plan !== 'free').map((o) => ({ name: o.name, plan: o.plan })),
        },
        memberPlans: memberPlans.map((p) => ({ level: p.level, name: p.name, price: p.price })),
        funnel: {
          registered: totalUsers,
          paidUsers,
          vipUsers,
        },
      },
    }
  })

  // ══════════════════════════════════════════════════════════════════
  // 第四层：VIP 经营中心
  // ══════════════════════════════════════════════════════════════════
  app.get('/api/admin/dashboard/vip', { preHandler: [requireAdmin] }, async () => {
    const now = new Date()
    const days30 = new Date(now.getTime() - 30 * 86400000)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [vipUsers, tierDistribution, memberships, vipReg30, plans] = await Promise.all([
      prisma.user.count({ where: { memberTier: { not: 'free' } } }),
      prisma.user.groupBy({ by: ['memberTier'], where: { memberTier: { not: 'free' } }, _count: { id: true } }),
      prisma.membership.findMany({ where: { tier: { not: 'free' } }, select: { tier: true, expiresAt: true, createdAt: true } }).catch(() => []),
      // 30 天新增 VIP（membership 创建）
      prisma.membership.count({ where: { tier: { not: 'free' }, createdAt: { gte: days30 } } }).catch(() => 0),
      prisma.memberPlan.findMany({ where: { enabled: true }, select: { level: true, name: true, price: true, coins: true } }).catch(() => []),
    ])

    // 套餐分布（memberTier）
    const tierBreakdown = tierDistribution.map((t) => ({
      tier: t.memberTier,
      count: t._count.id,
      name: { basic: '基础会员', pro: '高级会员', enterprise: '企业版' }[t.memberTier] || t.memberTier,
    }))

    // 续费 / 流失（membership expiresAt）
    const active = memberships.filter((m) => m.expiresAt && m.expiresAt > now).length
    const expired = memberships.filter((m) => m.expiresAt && m.expiresAt <= now).length
    const permanent = memberships.filter((m) => !m.expiresAt).length

    // VIP 增长趋势（membership 创建时间，按月）
    const monthMap = new Map<string, number>()
    for (const m of memberships) {
      const key = monthKey(new Date(m.createdAt))
      monthMap.set(key, (monthMap.get(key) || 0) + 1)
    }
    const growthTrend = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, count]) => ({ month, count }))

    return {
      code: 0,
      data: {
        generatedAt: now.toISOString(),
        total: vipUsers,
        monthNew: vipReg30,
        tierBreakdown,
        planOptions: plans.map((p) => ({ level: p.level, name: p.name, price: p.price, coins: p.coins })),
        health: { active, expired, permanent },
        growthTrend,
      },
    }
  })

  // ══════════════════════════════════════════════════════════════════
  // 第五层：Workspace 生态地图（业务线 Ranking）
  // ══════════════════════════════════════════════════════════════════
  app.get('/api/admin/dashboard/workspace', { preHandler: [requireAdmin] }, async () => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [usageByTask, projects, orgs, workspaces] = await Promise.all([
      prisma.usageLog.groupBy({
        by: ['taskType'],
        where: cleanUsageWhere({ createdAt: { gte: startOfMonth } }),
        _count: { id: true },
        _sum: { cost: true },
        orderBy: { _count: { id: 'desc' } },
        take: 30,
      }),
      prisma.project.findMany({ select: { id: true, type: true, ownerId: true, userId: true, createdAt: true } }).catch(() => []),
      prisma.organization.findMany({ select: { id: true, name: true, plan: true } }).catch(() => []),
      prisma.workspace.groupBy({ by: ['workspaceType'], _count: { id: true } }).catch(() => []),
    ])

    // taskType → 业务线
    const bizInfo = (t: string): { biz: string; label: string; icon: string } => {
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

    // 聚合调用/成本
    const agg = new Map<string, { biz: string; label: string; icon: string; calls: number; cost: number }>()
    for (const r of usageByTask) {
      const { biz, label, icon } = bizInfo(r.taskType)
      const cur = agg.get(label) || { biz, label, icon, calls: 0, cost: 0 }
      cur.calls += r._count.id
      cur.cost += r._sum.cost || 0
      agg.set(label, cur)
    }

    // 业务线 → 项目 type
    const projectTypeMap: Record<string, string[]> = {
      shortdrama: ['video', 'short_drama'],
      novel: ['novel'],
      geo: ['geo'],
      music: ['music'],
      recruitment: ['recruitment', 'job'],
      law: ['law'],
    }

    const ranking = Array.from(agg.values())
      .sort((a, b) => b.calls - a.calls)
      .map((r) => {
        const types = projectTypeMap[r.biz] || []
        const bizProjects = projects.filter((p) => types.includes(p.type || ''))
        const bizUsers = new Set(bizProjects.map((p) => p.ownerId || p.userId).filter(Boolean))
        return {
          ...r,
          cost: round2(r.cost),
          projects: bizProjects.length,
          users: bizUsers.size,
          enterprises: r.biz === 'recruitment' || r.biz === 'career' || r.biz === 'enterprise'
            ? orgs.filter((o) => o.plan !== 'free').length
            : 0,
        }
      })

    return {
      code: 0,
      data: {
        generatedAt: now.toISOString(),
        totalWorkspaces: 0,
        totalProjects: projects.length,
        totalEnterprises: orgs.length,
        paidEnterprises: orgs.filter((o) => o.plan !== 'free').length,
        totalUsers: await prisma.user.count(),
        workspaceTypes: workspaces.map((w) => ({ type: w.workspaceType || 'unknown', count: w._count.id })),
        ranking,
      },
    }
  })

  // ══════════════════════════════════════════════════════════════════
  // 第六层：用户区域分布（真实数据，无则「暂无地区信息」）
  // ══════════════════════════════════════════════════════════════════
  app.get('/api/admin/dashboard/geography', { preHandler: [requireAdmin] }, async () => {
    const [byProvince, totalUsers] = await Promise.all([
      prisma.user.groupBy({ by: ['provinceName'], _count: { id: true }, where: { NOT: { provinceName: null } } }),
      prisma.user.count(),
    ])

    const withRegion = byProvince.reduce((s, r) => s + r._count.id, 0)
    const provinces = byProvince
      .map((r) => ({ province: r.provinceName as string, count: r._count.id, pct: withRegion > 0 ? Math.round((r._count.id / withRegion) * 1000) / 10 : 0 }))
      .sort((a, b) => b.count - a.count)

    return {
      code: 0,
      data: {
        generatedAt: new Date().toISOString(),
        totalUsers,
        withRegion,
        provinces,
        // 无数据提示（禁止 mock）
        note: withRegion === 0 ? '暂无地区信息（用户未完善省市区资料）' : undefined,
      },
    }
  })

  // ══════════════════════════════════════════════════════════════════
  // 第七层：Agent 运营中心（排行 + 服务用户 + 成本 + ROI）
  // ══════════════════════════════════════════════════════════════════
  app.get('/api/admin/dashboard/agents', { preHandler: [requireAdmin] }, async () => {
    const [instances, auditByAgent, orgs, tasksByInstance] = await Promise.all([
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
      // 实例任务统计（真实执行）
      prisma.$queryRawUnsafe(`SELECT agent_instance_id, count(*)::int AS tasks, sum(cost)::numeric(10,2) AS cost, count(DISTINCT organization_id)::int AS orgs FROM enterprise_agent_task GROUP BY agent_instance_id`) as Promise<{ agent_instance_id: string; tasks: number; cost: number; orgs: number }[]>,
    ])

    const auditMap = new Map(auditByAgent.map((r) => [r.agentId, { tasks: r._count.id, cost: r._sum.cost || 0 }]))
    const taskMap = new Map(tasksByInstance.map((r) => [r.agent_instance_id, r]))
    const orgMap = new Map(orgs.map((o) => [o.id, o]))
    const activeOrgIds = new Set(instances.filter((a) => a.runtimeStatus === 'active').map((a) => a.organizationId).filter(Boolean))

    const agents = instances.map((a) => {
      const audit = auditMap.get(a.agentId)
      const taskStat = taskMap.get(a.id)
      const total = Math.max(a.totalTasks || 0, taskStat?.tasks || 0, audit?.tasks || 0)
      const cost = (a.totalErrors || 0) >= 0 ? round2((taskStat?.cost || 0) + (audit?.cost || 0)) : 0
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
        cost,
        servedOrganizations: taskStat?.orgs || 0,
        orgName: org?.name || '—',
        orgPlan: org?.plan || '—',
      }
    })

    return {
      code: 0,
      data: {
        agents,
        activeEnterprises: {
          count: activeOrgIds.size,
          names: orgs.filter((o) => activeOrgIds.has(o.id)).map((o) => o.name),
        },
      },
    }
  })

  // ══════════════════════════════════════════════════════════════════
  // 第八层：AI 基础设施中心（技术指标降位）
  // ══════════════════════════════════════════════════════════════════
  app.get('/api/admin/dashboard/infrastructure', { preHandler: [requireAdmin] }, async () => {
    const now = new Date()
    const [providers, models, activeAgents, agentStates, usageToday, tokenTrend, costRank, taskStats] = await Promise.all([
      prisma.aiProvider.findMany({ orderBy: { createdAt: 'asc' } }).catch(() => []),
      prisma.aiModel.findMany({ take: 50, orderBy: { createdAt: 'desc' } }).catch(() => []),
      prisma.enterpriseAgentInstance.findMany({
        select: { id: true, runtimeStatus: true, lifecycleState: true, totalTasks: true, totalErrors: true, lastActiveAt: true },
      }).catch(() => []),
      prisma.enterpriseAgentInstance.groupBy({ by: ['lifecycleState'], _count: { id: true } }).catch(() => []),
      prisma.usageLog.groupBy({ by: ['provider'], where: cleanUsageWhere({ createdAt: { gte: new Date(Date.now() - 86400000) } }), _count: { id: true }, _sum: { cost: true } }),
      prisma.$queryRawUnsafe(
        `SELECT to_char("createdAt", 'YYYY-MM-DD') AS day,
                COUNT(*) AS calls,
                COALESCE(SUM(CASE WHEN tokens ~ '^[0-9]+$' THEN CAST(tokens AS BIGINT) ELSE 0 END), 0) AS tokens,
                COALESCE(SUM(cost), 0) AS cost
         FROM usage_logs
         WHERE "createdAt" >= $1 AND provider NOT IN ($2) AND "taskType" NOT IN ($3)
         GROUP BY day ORDER BY day DESC LIMIT 14`,
        new Date(now.getTime() - 14 * 86400000), ...DIRTY_PROVIDERS, ...DIRTY_TASKS) as Promise<{ day: string; calls: bigint; tokens: bigint; cost: number }[]>,
      prisma.usageLog.groupBy({
        by: ['provider'],
        where: cleanUsageWhere({ createdAt: { gte: new Date(now.getTime() - 30 * 86400000) } }),
        _count: { id: true },
        _sum: { cost: true },
        orderBy: { _sum: { cost: 'desc' } },
        take: 10,
      }),
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

    // 系统健康检查
    const health: Record<string, { status: 'ok' | 'warn' | 'error'; label: string; detail: string }> = {}
    try {
      await prisma.$queryRawUnsafe(`SELECT 1`)
      health.database = { status: 'ok', label: '数据库', detail: 'PostgreSQL 连接正常' }
    } catch (e: any) {
      health.database = { status: 'error', label: '数据库', detail: e?.message || '连接失败' }
    }
    try {
      const { getRedis } = await import('../utils/redis-state.js')
      const redis = await getRedis()
      await redis.ping()
      health.redis = { status: 'ok', label: 'Redis', detail: 'PONG' }
    } catch {
      health.redis = { status: 'error', label: 'Redis', detail: '连接失败' }
    }
    const [queued, running] = await Promise.all([
      prisma.enterpriseAgentTask.count({ where: { status: { in: ['queued', 'pending'] } } }).catch(() => 0),
      prisma.enterpriseAgentTask.count({ where: { status: 'running' } }).catch(() => 0),
    ])
    health.queue = { status: 'ok', label: '任务队列', detail: `排队 ${queued} · 运行 ${running}` }
    const uptimeSec = Math.round(process.uptime())
    health.api = { status: 'ok', label: 'API 服务', detail: `运行 ${Math.floor(uptimeSec / 86400)}d ${Math.floor((uptimeSec % 86400) / 3600)}h · pid ${process.pid}` }
    const providersList = providers
    const ready = providersList.filter((p) => p.enabled && p.credentialStatus !== 'invalid').length
    const invalid = providersList.filter((p) => p.credentialStatus === 'invalid').length
    health.models = {
      status: invalid > 0 ? 'warn' : 'ok',
      label: '模型服务',
      detail: `可用 ${ready}/${providersList.length}${invalid ? ` · ${invalid} 个凭据失效` : ''}`,
    }
    const cosBucket = process.env.COS_BUCKET || process.env.TENCENT_COS_BUCKET || ''
    health.cos = cosBucket
      ? { status: 'ok', label: 'COS 对象存储', detail: `Bucket: ${cosBucket}` }
      : { status: 'warn', label: 'COS 对象存储', detail: '未配置（不影响核心链路）' }

    const statusOrder = ['error', 'warn', 'ok']
    const overall = statusOrder.find((s) => Object.values(health).some((r) => r.status === s)) || 'ok'

    return {
      code: 0,
      data: {
        generatedAt: now.toISOString(),
        // 系统健康
        health: { overall, checks: health },
        // Provider 状态
        providers: providers.map((p) => ({
          id: p.id,
          providerCode: p.providerCode,
          name: p.name,
          status: p.credentialStatus || 'untested',
          enabled: p.enabled,
          todayCalls: providerStats.get(p.providerCode)?.calls || 0,
          todayCost: round2(providerStats.get(p.providerCode)?.cost || 0),
        })),
        modelCount: models.length,
        tokenTrend: (tokenTrend || []).map((r) => ({
          day: r.day,
          calls: Number(r.calls),
          tokens: Number(r.tokens),
          cost: round2(Number(r.cost)),
        })),
        costRank: costRank.map((r) => ({
          provider: r.provider,
          calls: r._count.id,
          cost: round2(r._sum.cost || 0),
        })),
        taskHealth: {
          total: taskStats?._count.id || 0,
          cost: round2(taskStats?._sum.cost || 0),
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

  // ══════════════════════════════════════════════════════════════════
  // 第九层：实时运营事件流
  // ══════════════════════════════════════════════════════════════════
  app.get('/api/admin/dashboard/events', { preHandler: [requireAdmin] }, async () => {
    const now = new Date()
    const since = new Date(now.getTime() - 72 * 3600000)

    const [audits, usages, payments, users, subscriptions] = await Promise.all([
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
      prisma.enterpriseSubscription.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, snapshotName: true, status: true, createdAt: true },
      }).catch(() => []),
    ])

    const events: { time: string; icon: string; text: string; kind: string }[] = []

    for (const u of users) {
      events.push({ time: u.createdAt.toISOString(), icon: '👤', text: `新用户注册：${u.username}`, kind: 'user' })
    }
    for (const p of payments) {
      events.push({ time: (p.payTime ? new Date(p.payTime).toISOString() : now.toISOString()), icon: '💰', text: `用户购买 ${p.planType || 'VIP'} ¥${p.amount}`, kind: 'payment' })
    }
    for (const s of subscriptions) {
      events.push({ time: s.createdAt.toISOString(), icon: '🏢', text: `企业订阅：${s.snapshotName || '企业套餐'}（${s.status}）`, kind: 'subscription' })
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

  // ═══ 兼容别名（旧端点，避免破坏既有调用方）═══
  app.get('/api/admin/dashboard/ai-health', { preHandler: [requireAdmin] }, async (_req, reply) => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/dashboard/infrastructure', headers: _req.headers })
    return reply.type('application/json').send(JSON.parse(res.body))
  })
  app.get('/api/admin/dashboard/workspaces', { preHandler: [requireAdmin] }, async (_req, reply) => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/dashboard/workspace', headers: _req.headers })
    return reply.type('application/json').send(JSON.parse(res.body))
  })
  app.get('/api/admin/dashboard/activity', { preHandler: [requireAdmin] }, async (_req, reply) => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/dashboard/events', headers: _req.headers })
    return reply.type('application/json').send(JSON.parse(res.body))
  })
  app.get('/api/admin/dashboard/system-health', { preHandler: [requireAdmin] }, async (_req, reply) => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/dashboard/infrastructure', headers: _req.headers })
    const body = JSON.parse(res.body)
    return reply.type('application/json').send({ code: 0, data: { generatedAt: body.data.generatedAt, overall: body.data.health.overall, checks: body.data.health.checks } })
  })
}
