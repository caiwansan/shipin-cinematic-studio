// routes/enterprise-subscription.ts — 企业订阅购买 + 支付绑定 + Plan Snapshot
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'
import { toApiResponse } from '../contracts/runtime/toApiResponse.js'
import crypto from 'crypto'
import { ttfvEventService } from '../services/enterprise/ttfv-event.service.js'
import { enterpriseEventCollector } from '../services/enterprise/enterprise-event-collector.service.js'

export default async function enterpriseSubscriptionRoutes(app: FastifyInstance) {

  // JWT 认证 — 所有企业订阅端点必须验证
  app.addHook('preHandler', app.authenticate);

  // GET /api/enterprise/subscription/plans — 客户端套餐列表
  app.get('/api/enterprise/subscription/plans', async (request, reply) => {
    try {
      const plans = await prisma.enterprisePlan.findMany({
        where: { enabled: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true, name: true, displayName: true, description: true,
          price: true, yearlyPrice: true, originalPrice: true, currency: true,
          maxEmployees: true, maxChannels: true, maxMembers: true,
          features: true, sortOrder: true,
        },
      })
      // TTFV: 记录定价页浏览（已登录且已创建企业时）
      try {
        const user = request.user as any
        if (user?.id) {
          const orgId = await getOrganizationIdForUser(user.id)
          if (orgId) {
            const planIds = plans.map((p: any) => p.id).join(',')
            await ttfvEventService.trackPricingViewed(orgId, user.id, planIds, 'ALL')
          }
        }
      } catch {
        // 静默失败，不影响主响应
      }

      return toApiResponse({ success: true, data: plans })
    } catch (err: any) {
      return reply.status(500).send(toApiResponse({ success: false, message: err.message }))
    }
  })

  // GET /api/enterprise/subscription — 当前企业订阅状态
  app.get('/api/enterprise/subscription', async (request, reply) => {
    try {
      const userId = (request.user as any)?.userId || (request.user as any)?.id
      if (!userId) return reply.status(401).send(toApiResponse({ success: false, message: '未登录' }))
      const orgId = await getOrganizationIdForUser(userId)
      if (!orgId) return reply.status(404).send(toApiResponse({ success: false, message: '未找到企业' }))

      const sub = await prisma.enterpriseSubscription.findUnique({
        where: { organizationId: orgId },
        include: { plan: true },
      })

      if (!sub) return toApiResponse({ success: true, data: null })

      return toApiResponse({
        success: true,
        data: {
          id: sub.id,
          status: sub.status,
          planId: sub.planId,
          planName: sub.snapshotName,
          price: sub.snapshotPrice,
          cycle: sub.snapshotCycle,
          maxEmployees: sub.snapshotMaxEmployees,
          maxChannels: sub.snapshotMaxChannels,
          maxMembers: sub.snapshotMaxMembers,
          features: sub.snapshotFeatures,
          startAt: sub.startAt,
          expireAt: sub.expireAt,
          autoRenew: sub.autoRenew,
        },
      })
    } catch (err: any) {
      return reply.status(500).send(toApiResponse({ success: false, message: err.message }))
    }
  })

  // GET /api/enterprise/subscription/current — 当前企业订阅状态（精简版）
  app.get('/api/enterprise/subscription/current', async (request, reply) => {
    try {
      const userId = (request.user as any)?.userId || (request.user as any)?.id
      if (!userId) return reply.status(401).send(toApiResponse({ success: false, message: '未登录' }))
      const orgId = await getOrganizationIdForUser(userId)
      if (!orgId) return reply.status(404).send(toApiResponse({ success: false, message: '未找到企业' }))

      const sub = await prisma.enterpriseSubscription.findUnique({
        where: { organizationId: orgId },
        include: { plan: true },
      })

      if (!sub) return toApiResponse({ success: true, data: null })

      return toApiResponse({
        success: true,
        data: {
          plan: {
            name: sub.snapshotName,
            displayName: sub.snapshotName,
            status: sub.status,
          },
          subscription: {
            startDate: sub.startAt,
            endDate: sub.expireAt,
            status: sub.status,
            autoRenew: sub.autoRenew,
          },
        },
      })
    } catch (err: any) {
      return reply.status(500).send(toApiResponse({ success: false, message: err.message }))
    }
  })

  // POST /api/enterprise/subscription/create-order — 创建订阅订单
  app.post('/api/enterprise/subscription/create-order', async (request, reply) => {
    try {
      const userId = (request.user as any)?.userId
      if (!userId) return reply.status(401).send(toApiResponse({ success: false, message: '未登录' }))
      const orgId = await getOrganizationIdForUser(userId)
      if (!orgId) return reply.status(404).send(toApiResponse({ success: false, message: '未找到企业' }))

      const { planId, cycle } = request.body as any
      if (!planId || !cycle) {
        return reply.status(400).send(toApiResponse({ success: false, message: '缺少 planId 或 cycle' }))
      }

      const plan = await prisma.enterprisePlan.findUnique({ where: { id: planId } })
      if (!plan || !plan.enabled) {
        return reply.status(404).send(toApiResponse({ success: false, message: '套餐不存在或已停用' }))
      }

      const price = cycle === 'yearly' ? plan.yearlyPrice : plan.price
      const periodDays = cycle === 'yearly' ? 365 : 30

      // 生成订单号
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const rand = crypto.randomBytes(4).toString('hex').toUpperCase()
      const orderNo = `ENT${date}${rand}`

      // SECURITY HARDENING (BUG-05): 使用事务 + 唯一约束防止竞态条件
      // 唯一索引 enterprise_subscription_org_active 确保同一组织不能有多个 pending/active 订阅
      let order: any
      try {
        order = await prisma.$transaction(async (tx) => {
          // 在事务内重新检查（防止并发通过初检查）
          const existing = await tx.enterpriseSubscription.findUnique({ where: { organizationId: orgId } })
          if (existing && existing.status === 'active') {
            throw new Error('SUBSCRIPTION_ACTIVE_EXISTS')
          }

          // 创建支付订单
          const newOrder = await tx.paymentOrder.create({
            data: {
              organizationId: orgId,
              userId,
              orderNo,
              amount: price / 100, // 分转元
              currency: plan.currency,
              type: 'enterprise_subscription',
              status: 'pending',
              metadata: {
                planId,
                planName: plan.displayName,
                cycle,
                periodDays,
                maxEmployees: plan.maxEmployees,
                maxChannels: plan.maxChannels,
                maxMembers: plan.maxMembers,
                features: plan.features,
              },
            },
          })

          // 创建或更新 pending 订阅
          if (existing) {
            await tx.enterpriseSubscription.update({
              where: { id: existing.id },
              data: {
                planId,
                orderId: newOrder.id,
                status: 'pending',
                snapshotName: plan.displayName,
                snapshotPrice: price,
                snapshotCycle: cycle,
                snapshotMaxEmployees: plan.maxEmployees,
                snapshotMaxChannels: plan.maxChannels,
                snapshotMaxMembers: plan.maxMembers,
                snapshotFeatures: plan.features as any,
              },
            })
          } else {
            await tx.enterpriseSubscription.create({
              data: {
                organizationId: orgId,
                planId,
                orderId: newOrder.id,
                status: 'pending',
                snapshotName: plan.displayName,
                snapshotPrice: price,
                snapshotCycle: cycle,
                snapshotMaxEmployees: plan.maxEmployees,
                snapshotMaxChannels: plan.maxChannels,
                snapshotMaxMembers: plan.maxMembers,
                snapshotFeatures: plan.features as any,
                expireAt: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000),
              },
            })
          }

          return newOrder
        })
      } catch (txErr: any) {
        if (txErr.message === 'SUBSCRIPTION_ACTIVE_EXISTS') {
          return reply.status(400).send(toApiResponse({ success: false, message: '已有活跃订阅，请先取消或等待过期' }))
        }
        // 唯一约束冲突（并发创建）
        if (txErr.code === 'P2002') {
          return reply.status(409).send(toApiResponse({ success: false, message: '订阅正在创建中，请稍后' }))
        }
        throw txErr
      }

      // TTFV: 记录支付创建事件
      await ttfvEventService.trackPaymentCreated(orgId, planId, plan.displayName, cycle, price, order.id)

      return toApiResponse({
        success: true,
        data: {
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          planName: plan.displayName,
          cycle,
          periodDays,
        },
      })
    } catch (err: any) {
      return reply.status(500).send(toApiResponse({ success: false, message: err.message }))
    }
  })

  // POST /api/enterprise/subscription/activate — 支付成功后激活订阅
  app.post('/api/enterprise/subscription/activate', async (request, reply) => {
    try {
      const userId = (request.user as any)?.userId
      if (!userId) return reply.status(401).send(toApiResponse({ success: false, message: '未登录' }))
      const orgId = await getOrganizationIdForUser(userId)
      if (!orgId) return reply.status(404).send(toApiResponse({ success: false, message: '未找到企业' }))

      const { orderId } = request.body as any
      if (!orderId) return reply.status(400).send(toApiResponse({ success: false, message: '缺少 orderId' }))

      // 验证订单
      const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
      if (!order) return reply.status(404).send(toApiResponse({ success: false, message: '订单不存在' }))
      if (order.organizationId !== orgId) {
        return reply.status(403).send(toApiResponse({ success: false, message: '订单不属于当前企业' }))
      }
      if (order.status !== 'paid' && order.status !== 'completed') {
        return reply.status(400).send(toApiResponse({ success: false, message: '订单未支付' }))
      }

      // 激活订阅
      const periodDays = (order.metadata as any)?.periodDays || 30
      const sub = await prisma.enterpriseSubscription.updateMany({
        where: { organizationId: orgId, orderId },
        data: {
          status: 'active',
          startAt: new Date(),
          expireAt: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000),
        },
      })

      if (sub.count === 0) {
        return reply.status(404).send(toApiResponse({ success: false, message: '订阅不存在' }))
      }

      // TTFV: 记录支付成功 + 订阅激活（从订单和订阅快照获取信息）
      const subscription = await prisma.enterpriseSubscription.findUnique({ where: { organizationId: orgId } })
      const paymentAmount = Math.round((order.amount || 0) * 100)
      await ttfvEventService.trackPaymentSuccess(orgId, subscription?.id || '', orderId, paymentAmount, subscription?.snapshotName || '', subscription?.snapshotCycle || 'monthly')
      await ttfvEventService.trackSubscriptionActive(orgId, subscription?.snapshotName || '', subscription?.snapshotMaxEmployees || 2, subscription?.snapshotMaxChannels || 1)

      const updated = await prisma.enterpriseSubscription.findUnique({ where: { organizationId: orgId } })
      return toApiResponse({ success: true, data: updated })
    } catch (err: any) {
      return reply.status(500).send(toApiResponse({ success: false, message: err.message }))
    }
  })

  // POST /api/enterprise/subscription/cancel — 取消订阅
  app.post('/api/enterprise/subscription/cancel', async (request, reply) => {
    try {
      const userId = (request.user as any)?.userId
      if (!userId) return reply.status(401).send(toApiResponse({ success: false, message: '未登录' }))
      const orgId = await getOrganizationIdForUser(userId)
      if (!orgId) return reply.status(404).send(toApiResponse({ success: false, message: '未找到企业' }))

      const sub = await prisma.enterpriseSubscription.findUnique({ where: { organizationId: orgId } })
      if (!sub) return reply.status(404).send(toApiResponse({ success: false, message: '订阅不存在' }))

      await prisma.enterpriseSubscription.update({
        where: { id: sub.id },
        data: { status: 'cancelled', autoRenew: false },
      })

      return toApiResponse({ success: true, message: '订阅已取消' })
    } catch (err: any) {
      return reply.status(500).send(toApiResponse({ success: false, message: err.message }))
    }
  })
}
