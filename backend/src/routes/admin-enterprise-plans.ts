/**
 * routes/admin-enterprise-plans.ts — 后台企业管理 - 套餐配置
 *
 * 产品原则：
 * - 禁止代码/前端写死套餐价格
 * - 所有套餐由管理员后台动态配置
 * - AI 模型成本由企业 BYOK 承担，昆仑镜不收模型调用费
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

export default async function adminEnterprisePlanRoutes(fastify: FastifyInstance) {

  // ───── 套餐 CRUD ─────

  // GET /api/admin/enterprise/plans — 所有套餐（含已停用）
  fastify.get('/api/admin/enterprise/plans', { preHandler: [requireAdmin] }, async () => {
    const plans = await prisma.enterprisePlan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { subscriptions: true } } },
    })
    return { success: true, data: plans }
  })

  // POST /api/admin/enterprise/plans — 创建套餐
  fastify.post('/api/admin/enterprise/plans', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  // PUT /api/admin/enterprise/plans/:id — 更新套餐
  fastify.put('/api/admin/enterprise/plans/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    const b = request.body as any

    const data: any = {}
    if (b.name !== undefined) data.name = b.name
    if (b.displayName !== undefined) data.displayName = b.displayName
    if (b.description !== undefined) data.description = b.description
    if (b.price !== undefined) data.price = b.price
    if (b.originalPrice !== undefined) data.originalPrice = b.originalPrice
    if (b.currency !== undefined) data.currency = b.currency
    if (b.billingCycle !== undefined) data.billingCycle = b.billingCycle
    if (b.maxEmployees !== undefined) data.maxEmployees = b.maxEmployees
    if (b.maxChannels !== undefined) data.maxChannels = b.maxChannels
    if (b.maxMembers !== undefined) data.maxMembers = b.maxMembers
    if (b.storageLimit !== undefined) data.storageLimit = b.storageLimit
    if (b.requireOwnLLMKey !== undefined) data.requireOwnLLMKey = b.requireOwnLLMKey
    if (b.allowedProviders !== undefined) data.allowedProviders = b.allowedProviders
    if (b.quotaPolicy !== undefined) data.quotaPolicy = b.quotaPolicy
    if (b.features !== undefined) data.features = b.features
    if (b.capabilityCodes !== undefined) data.capabilityCodes = b.capabilityCodes
    if (b.enabled !== undefined) data.enabled = b.enabled
    if (b.sortOrder !== undefined) data.sortOrder = b.sortOrder

    const plan = await prisma.enterprisePlan.update({ where: { id }, data })
    return { success: true, data: plan }
  })

  // DELETE /api/admin/enterprise/plans/:id — 删除套餐
  // Sprint-RECRUITMENT-REALITY-03 T03: 删除保护 — 有历史订阅的套餐禁止硬删
  fastify.delete('/api/admin/enterprise/plans/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    const plan = await prisma.enterprisePlan.findUnique({
      where: { id },
      include: { _count: { select: { subscriptions: true } } },
    })
    if (!plan) return reply.status(404).send({ success: false, message: '套餐不存在' })
    if (plan._count.subscriptions > 0) {
      return reply.status(400).send({ success: false, message: '该套餐存在历史订阅，禁止硬删；请使用「停用」按钮（toggle）保留历史' })
    }
    await prisma.enterprisePlan.delete({ where: { id } })
    return { success: true }
  })

  // PATCH /api/admin/enterprise/plans/:id/toggle — 启用/停用
  fastify.patch('/api/admin/enterprise/plans/:id/toggle', { preHandler: [requireAdmin] }, async (request) => {
    const { id } = request.params as any
    const plan = await prisma.enterprisePlan.findUnique({ where: { id } })
    if (!plan) return { success: false, message: '套餐不存在' }
    const updated = await prisma.enterprisePlan.update({
      where: { id },
      data: { enabled: !plan.enabled },
    })
    return { success: true, data: { id: updated.id, enabled: updated.enabled } }
  })

  // ───── 企业订阅管理 ─────

  // GET /api/admin/enterprise/subscriptions — 所有企业订阅列表
  fastify.get('/api/admin/enterprise/subscriptions', { preHandler: [requireAdmin] }, async (request) => {
    const { status } = request.query as any
    const page = Math.max(1, parseInt((request.query as any).page as string, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt((request.query as any).limit as string, 10) || 20))
    const where: any = {}
    if (status) where.status = status

    const [subscriptions, total] = await Promise.all([
      prisma.enterpriseSubscription.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          plan: true,
          organization: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.enterpriseSubscription.count({ where }),
    ])

    return { success: true, data: subscriptions, total, page, limit }
  })

  // GET /api/admin/enterprise/subscriptions/:id — 订阅详情
  fastify.get('/api/admin/enterprise/subscriptions/:id', { preHandler: [requireAdmin] }, async (request) => {
    const { id } = request.params as any
    const sub = await prisma.enterpriseSubscription.findUnique({
      where: { id },
      include: {
        plan: true,
        organization: { include: { profile: true, aiProviders: true } },
      },
    })
    return { success: true, data: sub }
  })

  // ───── 人工配置订阅（Sprint-RECRUITMENT-REALITY-03 T04）─────
  // 管理员直接给企业开通套餐：企业 → 套餐 → Subscription → Entitlement → AI 员工部署
  // 商业规则 SSOT：所有套餐来自 EnterprisePlan 表（DB），此处不写死任何套餐属性
  fastify.post('/api/admin/enterprise/subscriptions', { preHandler: [requireAdmin] }, async (request, reply) => {
    const b = request.body as any
    const { organizationId, planId } = b || {}
    if (!organizationId || !planId) {
      return reply.status(400).send({ success: false, message: 'organizationId 和 planId 为必填' })
    }

    const org = await prisma.organization.findUnique({ where: { id: organizationId } })
    if (!org) return reply.status(404).send({ success: false, message: '企业不存在' })

    const plan = await prisma.enterprisePlan.findUnique({ where: { id: planId } })
    if (!plan) return reply.status(404).send({ success: false, message: '套餐不存在' })
    if (!plan.enabled) {
      return reply.status(400).send({ success: false, message: `套餐「${plan.displayName}」已停用，新购买禁止；如需使用请先在套餐管理中启用` })
    }

    const existing = await prisma.enterpriseSubscription.findUnique({ where: { organizationId } })
    if (existing && existing.status === 'active') {
      return reply.status(400).send({ success: false, message: '该企业已有活跃订阅，请使用「换套餐」接口变更' })
    }

    const adminId = (request.user as any)?.id || (request.user as any)?.userId || 'unknown'
    const periodDays = b.periodDays || 30
    const now = new Date()
    const expireAt = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000)

    // 1. 创建/更新 Subscription（快照 = 购买时刻的套餐属性，历史保留）
    const subscription = existing
      ? await prisma.enterpriseSubscription.update({
          where: { id: existing.id },
          data: {
            planId,
            status: 'active',
            startAt: now,
            expireAt,
            autoRenew: true,
            snapshotName: plan.displayName,
            snapshotPrice: plan.price,
            snapshotCycle: plan.billingCycle,
            snapshotMaxEmployees: plan.maxEmployees,
            snapshotMaxChannels: plan.maxChannels,
            snapshotMaxMembers: plan.maxMembers,
            snapshotFeatures: plan.features as any,
          },
        })
      : await prisma.enterpriseSubscription.create({
          data: {
            organizationId,
            planId,
            status: 'active',
            startAt: now,
            expireAt,
            autoRenew: true,
            snapshotName: plan.displayName,
            snapshotPrice: plan.price,
            snapshotCycle: plan.billingCycle,
            snapshotMaxEmployees: plan.maxEmployees,
            snapshotMaxChannels: plan.maxChannels,
            snapshotMaxMembers: plan.maxMembers,
            snapshotFeatures: plan.features as any,
          },
        })

    // 2. 生成 Entitlement（能力授权）
    const { entitlementService } = await import('../services/enterprise/enterprise-entitlement.service.js')
    await entitlementService.createFromSubscription(organizationId, subscription.id)

    // 3. 部署 AI 员工（按套餐编制 provision）
    const { enterpriseEmployeeProvisionService } = await import('../services/enterprise/enterprise-employee-provision.service.js')
    await enterpriseEmployeeProvisionService.provisionEmployeesForPlan(organizationId, planId)

    // 4. 审计
    await prisma.agentAuditTrail.create({
      data: {
        tenantId: organizationId,
        action: 'admin.enterprise.GRANT_SUBSCRIPTION',
        resource: 'enterprise_subscription',
        metadata: JSON.stringify({
          adminId,
          organizationId,
          planId,
          planName: plan.displayName,
          before: existing ? { status: existing.status, planId: existing.planId } : null,
          after: { status: 'active', planId: plan.id, planName: plan.displayName },
          reason: b.reason || '管理员人工配置订阅',
          timestamp: new Date().toISOString(),
        }),
      },
    })

    return { success: true, message: '订阅已开通，AI 员工已部署', data: { subscriptionId: subscription.id, organizationId, planId, planName: plan.displayName } }
  })
}
