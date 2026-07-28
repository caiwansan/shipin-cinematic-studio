/**
 * routes/enterprise-billing-extended.ts — 企业订阅中心扩展
 * Sprint-03: 套餐订阅页面 + Admin 企业招聘管理
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export async function enterpriseBillingExtendedRoutes(app: FastifyInstance) {

  // Sprint-04: 移除 503 维护模式，恢复 Billing API
  // app.addHook('onRequest', async (_request, reply) => {
  //   return reply.status(503).send({ error: 'Enterprise recruitment module is under maintenance', module: 'enterprise-billing-extended', status: 'maintenance' })
  // })

  // ─── 企业订阅中心（企业用户视角）───

  // GET /api/enterprise/:tenantId/billing/overview — 完整概览（套餐+用量+权益）
  app.get('/api/enterprise/:tenantId/billing/overview', async (request, reply) => {
    const { tenantId } = request.params as any

    // 当前订阅
    const sub = await prisma.enterpriseSubscription.findFirst({
      where: { organizationId: tenantId },
      include: { plan: true },
    })

    // 实际用量
    const [memberCount, aiEmployeeCount, channelCount, resumeCount, pipelineCount, offerCount] = await Promise.all([
      prisma.orgMember.count({ where: { organizationId: tenantId } }),
      prisma.enterpriseAgentInstance.count({ where: { tenantId } }),
      prisma.enterpriseChannelAccount.count({ where: { tenantId } }),
      prisma.resume.count({ where: { workspaceId: tenantId } }),
      prisma.recruitmentPipeline.count({ where: { workspaceId: tenantId } }),
      prisma.recruitmentPipeline.count({ where: { workspaceId: tenantId, stage: 'offer' } }),
    ])

    // 最近订单（从 RechargeOrder 获取）
    const recentOrders = await prisma.paymentOrder.findMany({
      where: { userId: tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true, orderNo: true, amount: true, status: true, planType: true, createdAt: true,
      },
    })

    // 所有可用套餐
    const availablePlans = await prisma.enterprisePlan.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: 'asc' },
    })

    return reply.send({
      success: true,
      data: {
        subscription: sub ? {
          id: sub.id,
          planId: sub.planId,
          planName: sub.plan.displayName,
          planPrice: sub.plan.price,
          billingCycle: sub.plan.billingCycle,
          status: sub.status,
          expireAt: sub.expireAt,
          autoRenew: sub.autoRenew,
        } : null,
        usage: {
          memberCount,
          aiEmployeeCount,
          channelCount,
          resumeCount,
          pipelineCount,
          offerCount,
        },
        limits: sub ? {
          maxEmployees: sub.plan.maxEmployees,
          maxChannels: sub.plan.maxChannels,
          maxMembers: sub.plan.maxMembers,
          storageLimit: sub.plan.storageLimit,
          requireOwnLLMKey: sub.plan.requireOwnLLMKey,
          features: sub.plan.features,
        } : {
          maxEmployees: 0,
          maxChannels: 0,
          maxMembers: 0,
          storageLimit: 0,
          requireOwnLLMKey: true,
          features: [],
        },
        recentOrders,
        availablePlans: availablePlans.map(p => ({
          id: p.id,
          name: p.name,
          displayName: p.displayName,
          description: p.description,
          price: p.price,
          currency: p.currency,
          billingCycle: p.billingCycle,
          maxEmployees: p.maxEmployees,
          maxChannels: p.maxChannels,
          maxMembers: p.maxMembers,
          storageLimit: p.storageLimit,
          features: p.features,
        })),
      },
    })
  })

  // POST /api/enterprise/:tenantId/billing/upgrade — 创建升级订单（Sprint-05: 复用昆仑镜统一支付）
  app.post('/api/enterprise/:tenantId/billing/upgrade', async (request, reply) => {
    const { tenantId } = request.params as any
    const { planId, cycle } = request.body as any

    if (!planId) {
      return reply.status(400).send({ success: false, message: 'planId 为必填' })
    }

    const plan = await prisma.enterprisePlan.findUnique({ where: { id: planId } })
    if (!plan || !plan.enabled) {
      return reply.status(404).send({ success: false, message: '套餐不存在或已停用' })
    }

    const selectedCycle = cycle === 'yearly' ? 'yearly' : 'monthly'
    const price = selectedCycle === 'yearly' ? plan.yearlyPrice : plan.price
    const periodDays = selectedCycle === 'yearly' ? 365 : 30

    // 创建支付订单（复用昆仑镜支付系统）
    const orderNo = `ENT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    const order = await prisma.paymentOrder.create({
      data: {
        organizationId: tenantId,
        userId: tenantId,
        orderNo,
        amount: price / 100, // 分转元
        currency: plan.currency,
        type: 'enterprise_subscription',
        status: 'pending',
        metadata: {
          planId,
          planName: plan.displayName,
          cycle: selectedCycle,
          periodDays,
          maxEmployees: plan.maxEmployees,
          maxChannels: plan.maxChannels,
          maxMembers: plan.maxMembers,
          features: plan.features,
        },
      },
    })

    return reply.send({
      success: true,
      data: {
        orderId: order.id,
        orderNo: order.orderNo,
        amount: order.amount,
        currency: order.currency,
        planName: plan.displayName,
        cycle: selectedCycle,
        periodDays,
      },
    })
  })

  // ─── Admin 企业招聘管理 ───

  // GET /api/admin/enterprises/:id/recruitment — 企业招聘数据
  app.get('/api/admin/enterprises/:id/recruitment', { preHandler: (req, reply, done) => {
    // 复用 requireAdmin
    const adminReq = req as any
    if (!adminReq.user?.isAdmin && !adminReq.user?.isSuperAdmin) {
      return reply.status(403).send({ success: false, message: '无权限' })
    }
    done()
  }}, async (request, reply) => {
    const { id } = request.params as any

    const org = await prisma.organization.findUnique({ where: { id } })
    if (!org) return reply.status(404).send({ success: false, message: '企业不存在' })

    // 招聘数据统计
    const [resumeCount, candidateCount, pipelineByStage, offerCount, interviewCount] = await Promise.all([
      prisma.resume.count({ where: { workspaceId: id } }),
      prisma.recruitmentPipeline.count({ where: { workspaceId: id } }),
      prisma.recruitmentPipeline.groupBy({
        by: ['stage'],
        where: { workspaceId: id },
        _count: { stage: true },
      }),
      prisma.recruitmentPipeline.count({ where: { workspaceId: id, stage: 'offer' } }),
      prisma.interview.count({ where: { tenantId: id } }),
    ])

    // 订阅状态
    const sub = await prisma.enterpriseSubscription.findFirst({
      where: { organizationId: id },
      include: { plan: true },
    })

    // 最近招聘活动
    const recentActivities = await prisma.pipelineEvent.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        pipeline: { select: { candidateName: true, stage: true } },
      },
    })

    return reply.send({
      success: true,
      data: {
        organization: {
          id: org.id,
          name: org.name,
          plan: org.plan,
          createdAt: org.createdAt,
        },
        recruitment: {
          resumeCount,
          candidateCount,
          offerCount,
          interviewCount,
          stageCounts: pipelineByStage.reduce((acc, item) => {
            acc[item.stage] = item._count.stage
            return acc
          }, {} as Record<string, number>),
        },
        subscription: sub ? {
          planName: sub.plan.displayName,
          status: sub.status,
          expireAt: sub.expireAt,
        } : null,
        recentActivities: recentActivities.map(a => ({
          id: a.id,
          type: a.type,
          candidateName: a.pipeline?.candidateName,
          fromStage: a.fromStage,
          toStage: a.toStage,
          createdAt: a.createdAt,
        })),
      },
    })
  })

  // PATCH /api/admin/enterprises/:id/freeze — 冻结企业
  app.patch('/api/admin/enterprises/:id/freeze', { preHandler: (req, reply, done) => {
    const adminReq = req as any
    if (!adminReq.user?.isAdmin && !adminReq.user?.isSuperAdmin) {
      return reply.status(403).send({ success: false, message: '无权限' })
    }
    done()
  }}, async (request, reply) => {
    const { id } = request.params as any
    const { reason } = request.body as any

    const org = await prisma.organization.findUnique({ where: { id } })
    if (!org) return reply.status(404).send({ success: false, message: '企业不存在' })

    // 更新订阅状态为 suspended
    await prisma.enterpriseSubscription.updateMany({
      where: { organizationId: id },
      data: { status: 'suspended' },
    })

    // 记录审计日志
    await prisma.agentAuditTrail.create({
      data: {
        tenantId: id,
        action: 'admin.enterprise.FREEZE',
        resource: 'organization',
        metadata: JSON.stringify({
          reason: reason || '管理员冻结',
          adminId: (request as any).user?.id || 'unknown',
          timestamp: new Date().toISOString(),
        }),
      },
    })

    return reply.send({ success: true, message: '企业已冻结' })
  })

  // PATCH /api/admin/enterprises/:id/unfreeze — 恢复企业
  app.patch('/api/admin/enterprises/:id/unfreeze', { preHandler: (req, reply, done) => {
    const adminReq = req as any
    if (!adminReq.user?.isAdmin && !adminReq.user?.isSuperAdmin) {
      return reply.status(403).send({ success: false, message: '无权限' })
    }
    done()
  }}, async (request, reply) => {
    const { id } = request.params as any
    const { reason } = request.body as any

    const org = await prisma.organization.findUnique({ where: { id } })
    if (!org) return reply.status(404).send({ success: false, message: '企业不存在' })

    await prisma.enterpriseSubscription.updateMany({
      where: { organizationId: id },
      data: { status: 'active' },
    })

    await prisma.agentAuditTrail.create({
      data: {
        tenantId: id,
        action: 'admin.enterprise.UNFREEZE',
        resource: 'organization',
        metadata: JSON.stringify({
          reason: reason || '管理员恢复',
          adminId: (request as any).user?.id || 'unknown',
          timestamp: new Date().toISOString(),
        }),
      },
    })

    return reply.send({ success: true, message: '企业已恢复' })
  })

  // GET /api/admin/enterprises/:id/recruitment/logs — 招聘操作日志
  app.get('/api/admin/enterprises/:id/recruitment/logs', { preHandler: (req, reply, done) => {
    const adminReq = req as any
    if (!adminReq.user?.isAdmin && !adminReq.user?.isSuperAdmin) {
      return reply.status(403).send({ success: false, message: '无权限' })
    }
    done()
  }}, async (request, reply) => {
    const { id } = request.params as any
    const { limit = 50, offset = 0 } = request.query as any

    const logs = await prisma.agentAuditTrail.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit) || 50,
      skip: parseInt(offset) || 0,
    })

    const total = await prisma.agentAuditTrail.count({ where: { tenantId: id } })

    return reply.send({
      success: true,
      data: logs.map(log => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
        createdAt: log.createdAt,
      })),
      total,
    })
  })
}

export default enterpriseBillingExtendedRoutes
