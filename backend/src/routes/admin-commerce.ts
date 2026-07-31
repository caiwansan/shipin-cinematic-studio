/**
 * routes/admin-commerce.ts — 商业控制面板（Commerce Control Plane）
 *
 * Sprint-09.7: 从 admin-recruitment.ts / admin-enterprise-plans.ts / admin-subscription-v2.ts 合并
 *
 * SSOT 原则：
 * - EnterprisePlan: 唯一写入口
 * - EnterpriseSubscription: Admin 视角（查看所有 + 暂停/恢复/取消/换套餐）
 * - Revenue/Customers: 平台级商业分析
 *
 * 企业自服务入口保留在：
 *   /api/enterprise/subscription/*
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'
import { toApiResponse } from '../contracts/runtime/toApiResponse.js'
import { isValidUUID } from '../lib/uuid-validate.js'

export default async function adminCommerceRoutes(app: FastifyInstance) {

  // ─────────────────────────────────────────
  // 辅助函数
  // ─────────────────────────────────────────

  async function logAdminAction(adminId: string, organizationId: string, action: string, before: any, after: any, reason?: string) {
    await prisma.agentAuditTrail.create({
      data: {
        tenantId: organizationId,
        action: `admin.commerce.${action}`,
        resource: 'enterprise_subscription',
        metadata: JSON.stringify({ adminId, organizationId, before, after, reason: reason || '管理员操作', timestamp: new Date().toISOString() }),
      },
    })
  }

  // ─────────────────────────────────────────
  // 商业总览
  // ─────────────────────────────────────────

  app.get('/api/admin/commerce/overview', { preHandler: [requireAdmin] }, async (_request, reply) => {
    try {
      const [totalPlans, activeSubs, totalEnterprises, totalAgents] = await Promise.all([
        prisma.enterprisePlan.count({ where: { enabled: true } }),
        prisma.enterpriseSubscription.count({ where: { status: 'active' } }),
        prisma.govOrganization.count(),
        prisma.enterpriseAgentInstance.count(),
      ])

      const [monthlyRev, yearlyRev] = await Promise.all([
        prisma.enterpriseSubscription.aggregate({ where: { status: 'active', snapshotCycle: 'monthly' }, _sum: { snapshotPrice: true } }),
        prisma.enterpriseSubscription.aggregate({ where: { status: 'active', snapshotCycle: 'yearly' }, _sum: { snapshotPrice: true } }),
      ])
      const mrr = (monthlyRev._sum?.snapshotPrice || 0) + Math.floor((yearlyRev._sum?.snapshotPrice || 0) / 12)

      return reply.send({
        success: true,
        data: {
          stats: {
            totalPlans,
            activeSubscriptions: activeSubs,
            totalEnterprises,
            totalAgents,
            mrr,
            arr: mrr * 12,
          },
          summary: 'Commerce Control Plane',
        },
      })
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch commerce overview', message: error.message })
    }
  })

  // ─────────────────────────────────────────
  // 套餐管理 (EnterprisePlan SSOT)
  // ─────────────────────────────────────────

  // GET /api/admin/commerce/plans — 列表
  app.get('/api/admin/commerce/plans', { preHandler: [requireAdmin] }, async () => {
    const plans = await prisma.enterprisePlan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { subscriptions: true } } },
    })
    return { success: true, data: plans }
  })

  // POST /api/admin/commerce/plans — 创建
  app.post('/api/admin/commerce/plans', { preHandler: [requireAdmin] }, async (request, reply) => {
    const b = request.body as any
    if (!b.name || !b.displayName) {
      return reply.status(400).send({ success: false, message: 'name 和 displayName 为必填' })
    }
    if (b.price === undefined || b.price < 0) {
      return reply.status(400).send({ success: false, message: 'price 必须 ≥ 0' })
    }
    const plan = await prisma.enterprisePlan.create({
      data: {
        name: b.name,
        displayName: b.displayName,
        description: b.description || null,
        price: b.price,
        yearlyPrice: b.yearlyPrice ?? b.price * 10,
        originalPrice: b.originalPrice ?? b.price,
        currency: b.currency || 'CNY',
        billingCycle: b.billingCycle || 'monthly',
        maxEmployees: b.maxEmployees ?? 2,
        maxChannels: b.maxChannels ?? 1,
        maxMembers: b.maxMembers ?? 5,
        storageLimit: b.storageLimit ?? 5,
        requireOwnLLMKey: b.requireOwnLLMKey !== undefined ? b.requireOwnLLMKey : true,
        allowedProviders: b.allowedProviders ?? ['deepseek', 'openai', 'claude', 'zhipu'],
        quotaPolicy: b.quotaPolicy || 'unlimited',
        features: b.features ?? [],
        capabilityCodes: b.capabilityCodes !== undefined ? b.capabilityCodes : [],
        enabled: b.enabled !== undefined ? b.enabled : true,
        sortOrder: b.sortOrder ?? 0,
      },
    })
    return { success: true, data: plan }
  })

  // PUT /api/admin/commerce/plans/:id — 更新
  app.put('/api/admin/commerce/plans/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    const b = request.body as any
    const data: any = {}
    const fields = ['name','displayName','description','price','yearlyPrice','originalPrice','currency','billingCycle','maxEmployees','maxChannels','maxMembers','storageLimit','requireOwnLLMKey','allowedProviders','quotaPolicy','features','capabilityCodes','enabled','sortOrder'] as const
    for (const f of fields) {
      if (b[f] !== undefined) data[f] = b[f]
    }
    const plan = await prisma.enterprisePlan.update({ where: { id }, data })
    return { success: true, data: plan }
  })

  // DELETE /api/admin/commerce/plans/:id — 删除
  // Sprint-RECRUITMENT-REALITY-03 T03: 删除保护 — 有历史订阅的套餐禁止硬删
  app.delete('/api/admin/commerce/plans/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    const plan = await prisma.enterprisePlan.findUnique({
      where: { id },
      include: { _count: { select: { subscriptions: true } } },
    })
    if (!plan) return reply.status(404).send(toApiResponse({ success: false, message: '套餐不存在' }))
    if (plan._count.subscriptions > 0) {
      return reply.status(400).send(toApiResponse({ success: false, message: '该套餐存在历史订阅，禁止硬删；请使用「停用」按钮（toggle）保留历史' }))
    }
    await prisma.enterprisePlan.delete({ where: { id } })
    return toApiResponse({ success: true })
  })

  // PATCH /api/admin/commerce/plans/:id/toggle — 启用/停用
  app.patch('/api/admin/commerce/plans/:id/toggle', { preHandler: [requireAdmin] }, async (request) => {
    const { id } = request.params as any
    const plan = await prisma.enterprisePlan.findUnique({ where: { id } })
    if (!plan) return { success: false, message: '套餐不存在' }
    const updated = await prisma.enterprisePlan.update({ where: { id }, data: { enabled: !plan.enabled } })
    return { success: true, data: { id: updated.id, enabled: updated.enabled } }
  })

  // ─────────────────────────────────────────
  // 订阅管理 (Admin 视角) — 合并 v1 + v2
  // ─────────────────────────────────────────

  // GET /api/admin/commerce/subscriptions — 所有企业订阅
  app.get('/api/admin/commerce/subscriptions', { preHandler: [requireAdmin] }, async (request) => {
    const { status } = request.query as any
    const page = Math.max(1, parseInt((request.query as any).page as string, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt((request.query as any).limit as string, 10) || 20))
    const where: any = {}
    if (status) where.status = status
    const [subscriptions, total] = await Promise.all([
      prisma.enterpriseSubscription.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: { plan: true, organization: { select: { id: true, name: true, slug: true } } },
      }),
      prisma.enterpriseSubscription.count({ where }),
    ])
    return { success: true, data: subscriptions, total, page, limit }
  })

  // GET /api/admin/commerce/subscriptions/:id — 订阅详情
  app.get('/api/admin/commerce/subscriptions/:id', { preHandler: [requireAdmin] }, async (request) => {
    const { id } = request.params as any
    const sub = await prisma.enterpriseSubscription.findUnique({
      where: { id },
      include: { plan: true, organization: { include: { profile: true } }, entitlement: true },
    })
    return { success: true, data: sub }
  })

  // PATCH /api/admin/commerce/subscriptions/:id/status — 状态变更
  app.patch('/api/admin/commerce/subscriptions/:id/status', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    const { status, reason } = request.body as any
    if (!status || !['active', 'suspended', 'cancelled', 'expired'].includes(status)) {
      return reply.status(400).send({ success: false, message: '无效状态' })
    }
    const sub = await prisma.enterpriseSubscription.findUnique({ where: { id } })
    if (!sub) return reply.status(404).send({ success: false, message: '订阅不存在' })
    await prisma.enterpriseSubscription.update({ where: { id }, data: { status } })
    const { entitlementService } = await import('../services/enterprise/enterprise-entitlement.service.js')
    if (status === 'active') {
      await entitlementService.createFromSubscription(sub.organizationId, sub.id)
    } else {
      await entitlementService.setStatus(sub.organizationId, status === 'suspended' ? 'suspended' : 'expired', reason || `Admin ${status}`)
    }
    return { success: true, message: `订阅已${status === 'active' ? '激活' : status === 'suspended' ? '冻结' : '变更'}` }
  })

  // PATCH /api/admin/commerce/subscriptions/:id/pause — 暂停
  app.patch('/api/admin/commerce/subscriptions/:id/pause', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    if (!isValidUUID(id)) return reply.status(400).send(toApiResponse({ success: false, message: '无效的订阅 ID' }))
    const { reason } = request.body as any
    const sub = await prisma.enterpriseSubscription.findUnique({ where: { id } })
    if (!sub) return reply.status(404).send(toApiResponse({ success: false, message: '订阅不存在' }))
    const adminId = (request.user as any)?.id || (request.user as any)?.userId || 'unknown'
    await prisma.enterpriseSubscription.update({ where: { id }, data: { status: 'paused' } })
    await logAdminAction(adminId, sub.organizationId, 'PAUSE', { status: sub.status }, { status: 'paused' }, reason)
    return toApiResponse({ success: true, message: '订阅已暂停' })
  })

  // PATCH /api/admin/commerce/subscriptions/:id/resume — 恢复
  app.patch('/api/admin/commerce/subscriptions/:id/resume', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    if (!isValidUUID(id)) return reply.status(400).send(toApiResponse({ success: false, message: '无效的订阅 ID' }))
    const { reason } = request.body as any
    const sub = await prisma.enterpriseSubscription.findUnique({ where: { id } })
    if (!sub) return reply.status(404).send(toApiResponse({ success: false, message: '订阅不存在' }))
    const adminId = (request.user as any)?.id || (request.user as any)?.userId || 'unknown'
    await prisma.enterpriseSubscription.update({ where: { id }, data: { status: 'active' } })
    await logAdminAction(adminId, sub.organizationId, 'RESUME', { status: sub.status }, { status: 'active' }, reason)
    return toApiResponse({ success: true, message: '订阅已恢复' })
  })

  // PATCH /api/admin/commerce/subscriptions/:id/cancel — 取消
  app.patch('/api/admin/commerce/subscriptions/:id/cancel', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    if (!isValidUUID(id)) return reply.status(400).send(toApiResponse({ success: false, message: '无效的订阅 ID' }))
    const { reason } = request.body as any
    const sub = await prisma.enterpriseSubscription.findUnique({ where: { id } })
    if (!sub) return reply.status(404).send(toApiResponse({ success: false, message: '订阅不存在' }))
    const adminId = (request.user as any)?.id || (request.user as any)?.userId || 'unknown'
    await prisma.enterpriseSubscription.update({ where: { id }, data: { status: 'cancelled', autoRenew: false } })
    await logAdminAction(adminId, sub.organizationId, 'CANCEL', { status: sub.status }, { status: 'cancelled' }, reason)
    return toApiResponse({ success: true, message: '订阅已取消' })
  })

  // PATCH /api/admin/commerce/subscriptions/:id/change-plan — 换套餐
  app.patch('/api/admin/commerce/subscriptions/:id/change-plan', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    if (!isValidUUID(id)) return reply.status(400).send(toApiResponse({ success: false, message: '无效的订阅 ID' }))
    const { planId, reason } = request.body as any
    const sub = await prisma.enterpriseSubscription.findUnique({ where: { id } })
    if (!sub) return reply.status(404).send(toApiResponse({ success: false, message: '订阅不存在' }))
    const newPlan = await prisma.enterprisePlan.findUnique({ where: { id: planId } })
    if (!newPlan) return reply.status(404).send(toApiResponse({ success: false, message: '目标套餐不存在' }))
    const adminId = (request.user as any)?.id || (request.user as any)?.userId || 'unknown'
    const oldSnapshot = { planId: sub.planId, name: sub.snapshotName, price: sub.snapshotPrice, cycle: sub.snapshotCycle }
    const newSnapshot = { planId: newPlan.id, name: newPlan.displayName, price: newPlan.price, cycle: newPlan.billingCycle }
    await prisma.enterpriseSubscription.update({
      where: { id },
      data: {
        planId,
        snapshotName: newPlan.displayName,
        snapshotPrice: newPlan.price,
        snapshotCycle: newPlan.billingCycle,
        snapshotMaxEmployees: newPlan.maxEmployees,
        snapshotMaxChannels: newPlan.maxChannels,
        snapshotMaxMembers: newPlan.maxMembers,
        snapshotFeatures: newPlan.features as any,
      },
    })
    await logAdminAction(adminId, sub.organizationId, 'CHANGE_PLAN', oldSnapshot, newSnapshot, reason)

    // Sprint-11C.4: 换套餐时同步 Entitlement（含 capabilityCodes）
    const { entitlementService } = await import('../services/enterprise/enterprise-entitlement.service.js')
    await entitlementService.createFromSubscription(sub.organizationId, sub.id)

    return toApiResponse({ success: true, message: '套餐已变更' })
  })

  // ─────────────────────────────────────────
  // 订阅统计 & 收入
  // ─────────────────────────────────────────

  // GET /api/admin/commerce/subscription-stats — MRR/ARR
  app.get('/api/admin/commerce/subscription-stats', { preHandler: [requireAdmin] }, async () => {
    const [total, active, paused, expired, cancelled, monthlyRev, yearlyRev] = await Promise.all([
      prisma.enterpriseSubscription.count(),
      prisma.enterpriseSubscription.count({ where: { status: 'active' } }),
      prisma.enterpriseSubscription.count({ where: { status: 'paused' } }),
      prisma.enterpriseSubscription.count({ where: { status: 'expired' } }),
      prisma.enterpriseSubscription.count({ where: { status: 'cancelled' } }),
      prisma.enterpriseSubscription.aggregate({ where: { status: 'active', snapshotCycle: 'monthly' }, _sum: { snapshotPrice: true } }),
      prisma.enterpriseSubscription.aggregate({ where: { status: 'active', snapshotCycle: 'yearly' }, _sum: { snapshotPrice: true } }),
    ])
    const mrr = (monthlyRev._sum.snapshotPrice || 0) + Math.floor((yearlyRev._sum.snapshotPrice || 0) / 12)
    return toApiResponse({
      success: true,
      data: { total, active, paused, expired, cancelled, mrr, arr: mrr * 12,
        monthlySubs: monthlyRev._sum.snapshotPrice || 0,
        yearlySubs: yearlyRev._sum.snapshotPrice || 0 },
    })
  })

  // GET /api/admin/commerce/revenue — 收入分析
  app.get('/api/admin/commerce/revenue', { preHandler: [requireAdmin] }, async () => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const [totalMRR, planDistribution, monthlyRevenueData, totalRevenue] = await Promise.all([
      // MRR
      (async () => {
        const m = await prisma.enterpriseSubscription.aggregate({ where: { status: 'active', snapshotCycle: 'monthly' }, _sum: { snapshotPrice: true } })
        const y = await prisma.enterpriseSubscription.aggregate({ where: { status: 'active', snapshotCycle: 'yearly' }, _sum: { snapshotPrice: true } })
        return (m._sum.snapshotPrice || 0) + Math.floor((y._sum.snapshotPrice || 0) / 12)
      })(),
      // Plan distribution
      prisma.enterpriseSubscription.groupBy({
        by: ['planId'],
        where: { status: 'active' },
        _count: { id: true },
        _sum: { snapshotPrice: true },
      }),
      // Monthly aggregate
      prisma.usageLog.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { cost: true } }),
      // Total estimated
      prisma.enterpriseSubscription.aggregate({ _sum: { snapshotPrice: true } }),
    ])

    const plans = await prisma.enterprisePlan.findMany({ select: { id: true, name: true, displayName: true } })
    const planMap = new Map(plans.map(p => [p.id, p.displayName]))

    return {
      success: true,
      data: {
        mrr: totalMRR,
        arr: totalMRR * 12,
        monthUsageCost: monthlyRevenueData._sum.cost || 0,
        totalSubscriptionValue: totalRevenue._sum.snapshotPrice || 0,
        planDistribution: planDistribution.map(pd => ({
          planId: pd.planId,
          planName: planMap.get(pd.planId) || pd.planId,
          count: pd._count.id,
          revenue: pd._sum.snapshotPrice || 0,
        })),
        updatedAt: now.toISOString(),
      },
    }
  })

  // GET /api/admin/commerce/customers — 客户成功
  app.get('/api/admin/commerce/customers', { preHandler: [requireAdmin] }, async (request) => {
    const { page = 1, limit = 20, risk } = request.query as any
    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20))
    const skip = (pageNum - 1) * limitNum

    const subs = await prisma.enterpriseSubscription.findMany({
      where: { status: 'active' },
      include: {
        plan: true,
        organization: { include: { profile: true, _count: { select: { members: true } } } },
      },
      skip, take: limitNum,
    })

    const orgIds = subs.map(s => s.organizationId)
    const agentCounts = await prisma.enterpriseAgentInstance.groupBy({
      by: ['tenantId'], where: { tenantId: { in: orgIds } }, _count: { agentId: true },
    })
    const agentCountMap = new Map(agentCounts.map(a => [a.tenantId, a._count.agentId]))

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const auditThisMonth = await prisma.agentAuditTrail.groupBy({
      by: ['tenantId'], where: { tenantId: { in: orgIds }, createdAt: { gte: monthStart } },
      _sum: { cost: true, tokenUsage: true },
    })
    const auditMap = new Map(auditThisMonth.map(a => [a.tenantId, a]))

    const days30FromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const customers = subs.map(sub => {
      const orgId = sub.organizationId
      const audit = auditMap.get(orgId)
      const agentCount = agentCountMap.get(orgId) ?? 0
      const monthCost = Math.round((audit?._sum.cost ?? 0) * 100)
      const tokensUsed = audit?._sum.tokenUsage ?? 0
      const maxAgents = sub.snapshotMaxEmployees ?? sub.plan.maxEmployees
      const agentUsageRate = maxAgents > 0 ? Math.round((agentCount / maxAgents) * 100) : 0
      const daysToExpire = Math.ceil((sub.expireAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      let riskLevel = 'healthy'
      if (daysToExpire <= 30 && monthCost < 100) riskLevel = 'high'
      else if (agentUsageRate >= 90) riskLevel = 'high'
      else if (daysToExpire <= 60) riskLevel = 'medium'

      return {
        orgId, orgName: sub.organization.name, planName: sub.plan.displayName,
        agentCount, maxAgents, agentUsageRate, monthCost, tokensUsed,
        expireAt: sub.expireAt.toISOString(), daysToExpire, riskLevel,
      }
    })

    const filtered = risk ? customers.filter(c => c.riskLevel === risk) : customers
    const summary = {
      total: subs.length,
      highRisk: customers.filter(c => c.riskLevel === 'high').length,
      medium: customers.filter(c => c.riskLevel === 'medium').length,
      healthy: customers.filter(c => c.riskLevel === 'healthy').length,
    }

    return { success: true, data: filtered, summary, page: pageNum, limit: limitNum }
  })

  // ─────────────────────────────────────────
  // Sprint-10B: Usage Intelligence — Enterprise AI Employee Consumption
  // ─────────────────────────────────────────

  // GET /api/admin/commerce/usage/:orgId/summary — 企业用量汇总
  app.get('/api/admin/commerce/usage/:orgId/summary', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { orgId } = request.params as any
    if (!isValidUUID(orgId)) return reply.status(400).send({ success: false, message: '无效的 organizationId' })

    const { from, to } = request.query as any
    const { enterpriseUsageAnalytics } = await import('../services/enterprise/enterprise-usage-analytics.service.js')

    const summary = await enterpriseUsageAnalytics.getOrganizationUsage(orgId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    })

    return { success: true, data: summary }
  })

  // GET /api/admin/commerce/usage/:orgId/agents — 按 AI 员工用量
  app.get('/api/admin/commerce/usage/:orgId/agents', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { orgId } = request.params as any
    if (!isValidUUID(orgId)) return reply.status(400).send({ success: false, message: '无效的 organizationId' })

    const { from, to, agentInstanceId } = request.query as any
    const { enterpriseUsageAnalytics } = await import('../services/enterprise/enterprise-usage-analytics.service.js')

    if (agentInstanceId) {
      // 单个 AI 员工
      const usage = await enterpriseUsageAnalytics.getAgentUsage(agentInstanceId, {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      })
      return { success: true, data: usage }
    }

    // 企业下所有员工（从 getOrganizationUsage 提取 byAgent）
    const summary = await enterpriseUsageAnalytics.getOrganizationUsage(orgId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    })
    return { success: true, data: summary.byAgent }
  })

  // GET /api/admin/commerce/usage/:orgId/cost-trend — 成本趋势
  app.get('/api/admin/commerce/usage/:orgId/cost-trend', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { orgId } = request.params as any
    if (!isValidUUID(orgId)) return reply.status(400).send({ success: false, message: '无效的 organizationId' })

    const { from, to } = request.query as any
    const { enterpriseUsageAnalytics } = await import('../services/enterprise/enterprise-usage-analytics.service.js')

    const costSummary = await enterpriseUsageAnalytics.getCostSummary(orgId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    })

    return { success: true, data: costSummary }
  })

  // GET /api/admin/commerce/usage/:orgId/quota — 套餐额度使用状态
  app.get('/api/admin/commerce/usage/:orgId/quota', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { orgId } = request.params as any
    if (!isValidUUID(orgId)) return reply.status(400).send({ success: false, message: '无效的 organizationId' })

    const { enterpriseUsageAnalytics } = await import('../services/enterprise/enterprise-usage-analytics.service.js')

    const quota = await enterpriseUsageAnalytics.getQuotaConsumption(orgId)

    return { success: true, data: quota }
  })
}
