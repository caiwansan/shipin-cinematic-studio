// routes/admin-customer-validation.ts — BETA-03 Customer Validation Dashboard
// 企业客户验证运营看板：注册→购买→激活→价值→续费 全链路

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'
import { toApiResponse } from '../contracts/runtime/toApiResponse.js'

export default async function adminCustomerValidationRoutes(app: FastifyInstance) {

  // ── 客户验证总览 ──
  app.get('/api/admin/enterprise/validation/overview', { preHandler: [requireAdmin] }, async () => {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // 注册企业数（通过 govOrganization 统计）
    const totalEnterprises = await prisma.govOrganization.count()
    const newEnterprises7d = await prisma.govOrganization.count({ where: { createdAt: { gte: sevenDaysAgo } } })
    const newEnterprises30d = await prisma.govOrganization.count({ where: { createdAt: { gte: thirtyDaysAgo } } })

    // 订阅统计
    const totalSubscriptions = await prisma.enterpriseSubscription.count()
    const activeSubscriptions = await prisma.enterpriseSubscription.count({ where: { status: 'active' } })
    const pendingSubscriptions = await prisma.enterpriseSubscription.count({ where: { status: 'pending' } })
    const cancelledSubscriptions = await prisma.enterpriseSubscription.count({ where: { status: 'cancelled' } })

    // AI 员工统计
    const totalEmployees = await prisma.enterpriseAgentProfile.count()
    const activeEmployees = await prisma.enterpriseAgentProfile.count({ where: { status: 'active' } })

    // Outcome 统计
    const totalOutcomes = await prisma.outcomeRecord.count()
    const verifiedOutcomes = await prisma.outcomeRecord.count({ where: { status: 'VERIFIED' } })
    const outcomes7d = await prisma.outcomeRecord.count({ where: { createdAt: { gte: sevenDaysAgo } } })

    // 收入统计（分）
    const totalRevenue = await prisma.paymentOrder.aggregate({
      _sum: { amount: true },
      where: { status: 'paid' },
    })

    return toApiResponse({
      enterprises: { total: totalEnterprises, new7d: newEnterprises7d, new30d: newEnterprises30d },
      subscriptions: { total: totalSubscriptions, active: activeSubscriptions, pending: pendingSubscriptions, cancelled: cancelledSubscriptions },
      employees: { total: totalEmployees, active: activeEmployees },
      outcomes: { total: totalOutcomes, verified: verifiedOutcomes, new7d: outcomes7d },
      revenue: { totalCents: totalRevenue._sum.amount || 0 },
    })
  })

  // ── 企业漏斗 ──
  app.get('/api/admin/enterprise/validation/funnel', { preHandler: [requireAdmin] }, async () => {
    const stages = [
      { key: 'registered', label: '注册企业', count: 0 },
      { key: 'subscribed', label: '购买订阅', count: 0 },
      { key: 'activated', label: '创建AI员工', count: 0 },
      { key: 'first_task', label: '首次任务', count: 0 },
      { key: 'first_outcome', label: '首次Outcome', count: 0 },
      { key: 'active_7d', label: '7日活跃', count: 0 },
    ]

    // 注册企业
    stages[0].count = await prisma.govOrganization.count()

    // 购买订阅
    stages[1].count = await prisma.enterpriseSubscription.count()

    // 创建AI员工
    stages[2].count = await prisma.enterpriseAgentProfile.count()

    // 首次任务（通过 AgentAuditTrail 统计）
    stages[3].count = await prisma.agentAuditTrail.count({ where: { action: 'enterprise.employee.first_task_started' } })

    // 首次Outcome
    stages[4].count = await prisma.agentAuditTrail.count({ where: { action: 'enterprise.employee.first_outcome_created' } })

    // 7日活跃（简化：最近7天有 Outcome 的企业数）
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentOutcomes = await prisma.outcomeRecord.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { organizationId: true },
      distinct: ['organizationId'],
    })
    stages[5].count = recentOutcomes.length

    const baseCount = Math.max(stages[0].count, 1)
    const funnel = stages.map((s) => ({
      ...s,
      rate: Math.round((s.count / baseCount) * 100),
    }))

    return toApiResponse({ funnel })
  })

  // ── AI 员工价值排行 ──
  app.get('/api/admin/enterprise/validation/employee-ranking', { preHandler: [requireAdmin] }, async () => {
    // EnterpriseAgentProfile 没有 outcomes 关联，通过 OutcomeRecord 手动统计
    const employees = await prisma.enterpriseAgentProfile.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        organizationId: true,
        status: true,
        createdAt: true,
      },
      take: 50,
    })

    // 批量统计每个员工的 Outcome 数
    const outcomeCounts = await prisma.outcomeRecord.groupBy({
      by: ['agentId'],
      _count: { id: true },
    })
    const outcomeMap = new Map(outcomeCounts.map((o) => [o.agentId, o._count.id]))

    const ranking = employees
      .map((e) => ({
        rank: 0,
        id: e.id,
        name: e.name,
        role: e.role,
        organizationId: e.organizationId,
        status: e.status,
        outcomeCount: outcomeMap.get(e.id) || 0,
        createdAt: e.createdAt,
      }))
      .sort((a, b) => b.outcomeCount - a.outcomeCount)
      .slice(0, 20)
      .map((e, i) => ({ ...e, rank: i + 1 }))

    return toApiResponse({ ranking })
  })

  // ── 企业健康度（流失预警）──
  app.get('/api/admin/enterprise/validation/health', { preHandler: [requireAdmin] }, async () => {
    const now = new Date()

    // GovOrganization 没有直接 subscription 关联，需手动匹配
    const enterprises = await prisma.govOrganization.findMany({
      select: { id: true, name: true, createdAt: true },
    })

    const subscriptions = await prisma.enterpriseSubscription.findMany({
      select: { organizationId: true, status: true, expireAt: true },
    })
    const subMap = new Map(subscriptions.map((s) => [s.organizationId, s]))

    const health = enterprises.map((e) => {
      const sub = subMap.get(e.id)
      const hasSubscription = !!sub
      const isExpired = sub?.expireAt && new Date(sub.expireAt) < now
      const hasEmployees = false // 需通过其他方式统计

      let healthStatus: 'healthy' | 'at_risk' | 'dormant' | 'churned' = 'healthy'
      if (sub?.status === 'cancelled') healthStatus = 'churned'
      else if (isExpired) healthStatus = 'at_risk'
      else if (!hasSubscription) healthStatus = 'dormant'

      return {
        id: e.id,
        name: e.name,
        status: healthStatus,
        subscriptionStatus: sub?.status || 'none',
        employeeCount: 0,
        outcomeCount: 0,
        createdAt: e.createdAt,
      }
    })

    return toApiResponse({
      health,
      summary: {
        healthy: health.filter((h) => h.status === 'healthy').length,
        atRisk: health.filter((h) => h.status === 'at_risk').length,
        dormant: health.filter((h) => h.status === 'dormant').length,
        churned: health.filter((h) => h.status === 'churned').length,
      },
    })
  })

  // ── 转化案例 ──
  app.get('/api/admin/enterprise/validation/case-studies', { preHandler: [requireAdmin] }, async () => {
    // 找出有 VERIFIED Outcome 的企业作为潜在案例
    const verifiedOutcomes = await prisma.outcomeRecord.findMany({
      where: { status: 'VERIFIED' },
      select: {
        organizationId: true,
        description: true,
        type: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const orgIds = [...new Set(verifiedOutcomes.map((o) => o.organizationId))]
    const orgs = await prisma.govOrganization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true },
    })
    const orgMap = new Map(orgs.map((o) => [o.id, o.name]))

    const cases = verifiedOutcomes.map((o, i) => ({
      id: `case-${i + 1}`,
      organizationId: o.organizationId,
      organizationName: orgMap.get(o.organizationId) || 'Unknown',
      outcomeType: o.type,
      description: o.description,
      createdAt: o.createdAt,
      status: 'draft',
    }))

    return toApiResponse({ cases })
  })

  // ── 每日趋势 ──
  app.get('/api/admin/enterprise/validation/trend', { preHandler: [requireAdmin] }, async () => {
    const days = 30
    const now = new Date()
    const trends: Array<{ date: string; enterprises: number; subscriptions: number; outcomes: number }> = []

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)

      const enterprises = await prisma.govOrganization.count({ where: { createdAt: { gte: startOfDay, lt: endOfDay } } })
      const subscriptions = await prisma.enterpriseSubscription.count({ where: { createdAt: { gte: startOfDay, lt: endOfDay } } })
      const outcomes = await prisma.outcomeRecord.count({ where: { createdAt: { gte: startOfDay, lt: endOfDay } } })

      trends.push({
        date: startOfDay.toISOString().slice(0, 10),
        enterprises,
        subscriptions,
        outcomes,
      })
    }

    return toApiResponse({ trends })
  })
}
