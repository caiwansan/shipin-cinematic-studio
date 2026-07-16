/**
 * routes/enterprise-billing.ts — 企业订阅中心（企业用户视角）
 *
 * 产品规则：
 * - 只读取管理员配置的套餐，不可写价格
 * - BYOK：引导企业接入自有模型 Key
 * - 支付方式复用 RechargeOrder 支付体系
 *
 * 鉴权：JWT + tenantOwnershipGuard
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { tenantOwnershipGuard } from '../enterprise/reality/tenant-guard.js'

export async function enterpriseBillingRoutes(app: FastifyInstance) {
  // JWT 鉴权 + 租户越权防护
  app.addHook('preHandler', app.authenticate)
  app.addHook('preHandler', tenantOwnershipGuard)

  // GET /api/enterprise/:tenantId/billing/plans — 可用套餐（只读）
  app.get('/api/enterprise/:tenantId/billing/plans', async (request, reply) => {
    const plans = await prisma.enterprisePlan.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true, name: true, displayName: true, description: true,
        price: true, originalPrice: true, currency: true, billingCycle: true,
        maxEmployees: true, maxChannels: true, maxMembers: true,
        storageLimit: true, requireOwnLLMKey: true,
        allowedProviders: true, quotaPolicy: true, features: true,
      },
    })
    return reply.send({ success: true, data: plans })
  })

  // GET /api/enterprise/:tenantId/billing/subscription — 当前订阅详情
  app.get('/api/enterprise/:tenantId/billing/subscription', async (request, reply) => {
    const { tenantId } = request.params as any
    const sub = await prisma.enterpriseSubscription.findFirst({
      where: { organizationId: tenantId },
      include: { plan: true },
    })
    return reply.send({ success: true, data: sub })
  })

  // GET /api/enterprise/:tenantId/billing/status — 订阅状态卡片（仪表盘用）
  app.get('/api/enterprise/:tenantId/billing/status', async (request, reply) => {
    const { tenantId } = request.params as any
    const sub = await prisma.enterpriseSubscription.findFirst({
      where: { organizationId: tenantId },
      include: { plan: true },
    })

    if (!sub) {
      return reply.send({ success: true, data: { hasSubscription: false } })
    }

    const now = new Date()
    const expireAt = new Date(sub.expireAt)
    const daysLeft = Math.max(0, Math.ceil((expireAt.getTime() - now.getTime()) / 86400000))

    return reply.send({
      success: true,
      data: {
        hasSubscription: true,
        planName: sub.plan.displayName,
        planId: sub.plan.id,
        status: sub.status,
        expireAt: sub.expireAt,
        daysLeft,
        maxEmployees: sub.plan.maxEmployees,
        maxChannels: sub.plan.maxChannels,
        maxMembers: sub.plan.maxMembers,
        requireOwnLLMKey: sub.plan.requireOwnLLMKey,
      },
    })
  })
}

export default enterpriseBillingRoutes
