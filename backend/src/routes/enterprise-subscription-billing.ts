/**
 * routes/enterprise-subscription-billing.ts — 企业订阅支付（用户端）
 *
 * 功能：
 * - POST /api/enterprise/subscription/create-payment — 为订单生成支付凭据（微信/支付宝二维码）
 * - GET /api/enterprise/subscription/payment-status/:orderId — 轮询订单支付状态
 *
 * 支付流程参照：member.ts → /api/member/create-payment
 * 企业套餐数据只读，价格由管理员在后台 EnterprisePlan 配置
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'
import { toApiResponse } from '../contracts/runtime/toApiResponse.js'

/**
 * 验证用户对组织的访问权限，支持多种 ID 格式：
 * 1. govOrganization.id（后端标准）
 * 2. enterpriseProfile.id（企业资料 UUID）
 * 3. 遗留 Organization.id（orgMember 表使用）
 * 4. 直接 orgMember 匹配
 */
async function isOrgAuthorized(userId: string, orgId: string): Promise<string | null> {
  const userOrgId = await getOrganizationIdForUser(userId)

  // 1. 精确匹配 govOrganization
  if (userOrgId && userOrgId === orgId) return userOrgId

  // 2. enterpriseProfile.id → 解析回 organizationId
  const ep = await prisma.enterpriseProfile.findUnique({ where: { id: orgId } })
  if (ep && userOrgId && ep.organizationId === userOrgId) return userOrgId
  if (ep) {
    const om = await prisma.orgMember.findFirst({ where: { userId, organizationId: ep.organizationId } })
    if (om) return ep.organizationId
  }

  // 3. 遗留 Organization 表
  const legacyOrg = await prisma.organization.findUnique({ where: { id: orgId } })
  if (legacyOrg) {
    const om = await prisma.orgMember.findFirst({ where: { userId, organizationId: orgId } })
    if (om) return orgId
  }

  // 4. 直接查 orgMember
  const omDirect = await prisma.orgMember.findFirst({ where: { userId, organizationId: orgId } })
  if (omDirect) return orgId

  return null
}

export default async function enterpriseSubscriptionBillingRoutes(app: FastifyInstance) {
  // 所有路由需要 JWT 认证
  app.addHook('preHandler', app.authenticate)

  // ─────────────────────────────────────────────
  // GET /api/enterprise/subscription/plans
  // 套餐列表（兼容旧路径，前端 pricing.vue 使用）
  // ─────────────────────────────────────────────
  app.get('/api/enterprise/subscription/plans', async (_request, reply) => {
    try {
      const plans = await prisma.enterprisePlan.findMany({
        where: { enabled: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true, name: true, displayName: true, description: true,
          price: true, yearlyPrice: true, originalPrice: true, currency: true,
          maxEmployees: true, maxChannels: true, maxMembers: true,
          storageLimit: true, requireOwnLLMKey: true, allowedProviders: true,
          quotaPolicy: true, features: true, sortOrder: true,
        },
      })
      return toApiResponse({ success: true, data: plans })
    } catch (err: any) {
      return reply.status(500).send(toApiResponse({ success: false, message: err.message }))
    }
  })

  // ─────────────────────────────────────────────
  // GET /api/enterprise/subscription/available-plans
  // 可用套餐列表（只读）
  // ─────────────────────────────────────────────
  app.get('/api/enterprise/subscription/available-plans', async (_request, reply) => {
    try {
      const plans = await prisma.enterprisePlan.findMany({
        where: { enabled: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          displayName: true,
          description: true,
          price: true,
          yearlyPrice: true,
          originalPrice: true,
          currency: true,
          maxEmployees: true,
          maxChannels: true,
          maxMembers: true,
          storageLimit: true,
          requireOwnLLMKey: true,
          allowedProviders: true,
          quotaPolicy: true,
          features: true,
          sortOrder: true,
        },
      })
      return toApiResponse(plans)
    } catch (err: any) {
      return reply.status(500).send(toApiResponse({ success: false, message: err.message }))
    }
  })

  // ─────────────────────────────────────────────
  // GET /api/enterprise/subscription/current
  // 当前企业订阅状态（含权益摘要）
  // ─────────────────────────────────────────────
  app.get('/api/enterprise/subscription/current', async (request, reply) => {
    try {
      const userId = (request.user as any)?.userId || (request.user as any)?.id
      if (!userId) return reply.status(401).send(toApiResponse({ success: false, message: '未登录' }))

      // 查找用户所属的 workspace Organization
      const userOrgMember = await prisma.orgMember.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      })
      const orgId = userOrgMember?.organizationId
      if (!orgId) return reply.status(404).send(toApiResponse({ success: false, message: '未找到企业' }))

      const sub = await prisma.enterpriseSubscription.findUnique({
        where: { organizationId: orgId },
        include: {
          plan: { select: { name: true, displayName: true, price: true, yearlyPrice: true } },
          entitlement: true,
        },
      })

      if (!sub) {
        return toApiResponse({
            hasSubscription: false,
            status: null,
            organizationId: orgId,
        })
      }

      const now = new Date()
      const expireAt = new Date(sub.expireAt)
      const daysLeft = Math.max(0, Math.ceil((expireAt.getTime() - now.getTime()) / 86400000))

      return toApiResponse({
          hasSubscription: true,
          id: sub.id,
          status: sub.status,
          planId: sub.planId,
          planName: sub.snapshotName || sub.plan?.displayName,
          planTier: sub.plan?.name,
          price: sub.snapshotPrice ?? sub.plan?.price,
          cycle: sub.snapshotCycle || 'monthly',
          maxEmployees: sub.snapshotMaxEmployees,
          maxChannels: sub.snapshotMaxChannels,
          maxMembers: sub.snapshotMaxMembers,
          features: sub.snapshotFeatures,
          startAt: sub.startAt,
          expireAt: sub.expireAt,
          daysLeft,
          autoRenew: sub.autoRenew,
          entitlement: sub.entitlement ? {
            maxAgents: sub.entitlement.maxAgents,
            maxChannels: sub.entitlement.maxChannels,
            maxMembers: sub.entitlement.maxMembers,
            storageLimit: sub.entitlement.storageLimit,
            capabilityCodes: sub.entitlement.capabilityCodes,
          } : null,
      })
    } catch (err: any) {
      return reply.status(500).send(toApiResponse({ success: false, message: err.message }))
    }
  })

  // ─────────────────────────────────────────────
  // POST /api/enterprise/subscription/create-order
  // 创建订阅订单（选择套餐后生成 pending 订单）
  // ─────────────────────────────────────────────
  app.post('/api/enterprise/subscription/create-order', async (request, reply) => {
    try {
      const userId = (request.user as any)?.userId || (request.user as any)?.id
      if (!userId) return reply.status(401).send(toApiResponse({ success: false, message: '未登录' }))

      // 从 OrgMember 查找用户在 Organization 表中的真实企业 ID
      const orgMember = await prisma.orgMember.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      })
      const orgId = orgMember?.organizationId
      if (!orgId) return reply.status(404).send(toApiResponse({ success: false, message: '未找到企业，请先创建企业' }))

      const { planId, cycle } = request.body as any
      if (!planId) {
        return reply.status(400).send(toApiResponse({ success: false, message: '缺少 planId' }))
      }

      const plan = await prisma.enterprisePlan.findUnique({ where: { id: planId } })
      if (!plan || !plan.enabled) {
        return reply.status(404).send(toApiResponse({ success: false, message: '套餐不存在或已停用' }))
      }

      const selectedCycle = cycle === 'yearly' ? 'yearly' : 'monthly'
      const price = selectedCycle === 'yearly' ? plan.yearlyPrice : plan.price
      const periodDays = selectedCycle === 'yearly' ? 365 : 30

      // 生成订单号
      const crypto = await import('crypto')
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const rand = crypto.randomBytes(4).toString('hex').toUpperCase()
      const orderNo = `ENT${date}${rand}`

      // 获取可用支付方式（返回给前端让用户选择）
      const secretMethods = await prisma.paymentSecret.findMany({ where: { enabled: true } })
      const hasAlipaySecret = secretMethods.some(s => {
        if (s.channel !== 'alipay') return false
        const config = (typeof s.config === 'string' ? JSON.parse(s.config) : s.config) || {}
        return config.appId && config.privateKey
      })
      const hasWechatSecret = secretMethods.some(s => {
        if (s.channel !== 'wechat') return false
        const config = (typeof s.config === 'string' ? JSON.parse(s.config) : s.config) || {}
        return config.appId && config.mchId && config.apiV3Key
      })

      if (!hasAlipaySecret && !hasWechatSecret) {
        return reply.status(400).send(toApiResponse({ success: false, message: '暂无可用支付方式，请联系管理员配置支付密钥' }))
      }

      // 创建支付订单
      const order = await prisma.$transaction(async (tx) => {
        // 检查是否有活跃订阅
        const existing = await tx.enterpriseSubscription.findUnique({ where: { organizationId: orgId } })
        if (existing && existing.status === 'active') {
          // 已存在活跃订阅 → 当作升级处理
        }

        // 创建支付订单
        const newOrder = await tx.paymentOrder.create({
          data: {
            organizationId: orgId,
            userId,
            orderNo,
            amount: price / 100, // 分转元
            currency: plan.currency,
            coins: 0,
            method: 'pending',
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
              snapshotCycle: selectedCycle,
              snapshotMaxEmployees: plan.maxEmployees,
              snapshotMaxChannels: plan.maxChannels,
              snapshotMaxMembers: plan.maxMembers,
              snapshotFeatures: plan.features as any,
              expireAt: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000),
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
              snapshotCycle: selectedCycle,
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

      // 支付方式列表
      const methods: any[] = []
      if (hasAlipaySecret) {
        methods.push({ id: 'alipay', channel: 'alipay', name: '支付宝支付', icon: '💳', isSecret: true })
      }
      if (hasWechatSecret) {
        methods.push({ id: 'wechat', channel: 'wechat', name: '微信支付', icon: '💚', isSecret: true })
      }

      return toApiResponse({
        needPay: true,
        orderId: order.id,
        orderNo: order.orderNo,
        amount: order.amount,
        currency: order.currency,
        planName: plan.displayName,
        planId: plan.id,
        cycle: selectedCycle,
        periodDays,
        methods,
      })
    } catch (err: any) {
      return reply.status(500).send(toApiResponse({ success: false, message: err.message }))
    }
  })

  // ─────────────────────────────────────────────
  // POST /api/enterprise/subscription/create-payment
  // 为已创建的订单生成支付凭据（微信/支付宝二维码）
  //
  // 参照：member.ts → /api/member/create-payment
  // ─────────────────────────────────────────────
  app.post('/api/enterprise/subscription/create-payment', async (request, reply) => {
    try {
      const userId = (request.user as any)?.userId || (request.user as any)?.id
      if (!userId) return reply.status(401).send(toApiResponse({ success: false, message: '未登录' }))

      const { orderId, channel } = request.body as any
      if (!orderId || !channel) {
        return reply.status(400).send(toApiResponse({ success: false, message: 'orderId 和 channel 必填' }))
      }
      if (!['wechat', 'alipay'].includes(channel)) {
        return reply.status(400).send(toApiResponse({ success: false, message: '无效的支付方式，仅支持 wechat 和 alipay' }))
      }

      // 查找订单
      const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
      if (!order) {
        return reply.status(404).send(toApiResponse({ success: false, message: '订单不存在' }))
      }
      if (order.userId !== userId) {
        return reply.status(403).send(toApiResponse({ success: false, message: '无权操作此订单' }))
      }
      if (order.status !== 'pending') {
        return reply.status(400).send(toApiResponse({ success: false, message: '订单状态异常，无法支付' }))
      }

      const metadata = (order.metadata as any) || {}
      const planName = metadata.planName || '企业订阅'
      const cycle = metadata.cycle || 'monthly'

      if (channel === 'alipay') {
        // 支付宝扫码支付
        const subject = `企业订阅套餐 - ${planName}（${cycle === 'yearly' ? '年付' : '月付'}）`
        const { createAlipayPagePayUrl } = await import('../services/alipay.service.js')
        const notifyUrl = `https://aigc.fushtn.com/api/payment/alipay/notify`
        const returnUrl = `https://aigc.fushtn.com/enterprise/membership`

        const { payUrl, qrCode } = await createAlipayPagePayUrl({
          outTradeNo: order.orderNo,
          subject,
          totalAmount: order.amount,
          returnUrl,
          notifyUrl,
        })

        // 更新订单支付方式
        await prisma.paymentOrder.update({
          where: { id: orderId },
          data: { method: 'alipay_secret' },
        })

        if (qrCode) {
          // 当面付二维码模式
          return toApiResponse({
            paymentType: 'alipay_qr',
            qrCode,
            orderNo: order.orderNo,
          })
        }

        // 回退到跳转收银台（生成支付链接二维码）
        return toApiResponse({
          paymentType: 'alipay_page',
          payUrl,
          orderNo: order.orderNo,
        })
      }

      if (channel === 'wechat') {
        // 微信 NATIVE 扫码支付
        const description = `企业订阅套餐 - ${planName}（${cycle === 'yearly' ? '年付' : '月付'}）`
        const { createWxpayNativeQrCode } = await import('../services/wxpay.service.js')
        const notifyUrl = `https://aigc.fushtn.com/api/payment/wxpay/notify`

        const { codeUrl } = await createWxpayNativeQrCode({
          outTradeNo: order.orderNo,
          description,
          totalAmount: order.amount,
          notifyUrl,
        })

        // 更新订单支付方式
        await prisma.paymentOrder.update({
          where: { id: orderId },
          data: { method: 'wxpay_native' },
        })

        return toApiResponse({
          paymentType: 'wxpay_qr',
          codeUrl,
          orderNo: order.orderNo,
        })
      }

      return reply.status(400).send(toApiResponse({ success: false, message: '不支持的支付方式' }))
    } catch (err: any) {
      console.error('[enterprise-subscription-billing] 创建支付失败:', err.message)
      return reply.status(500).send(toApiResponse({ success: false, message: err.message || '创建支付失败' }))
    }
  })

  // ─────────────────────────────────────────────
  // GET /api/enterprise/subscription/payment-status/:orderId
  // 轮询订单支付状态
  //
  // 参照：member.ts → /api/payment/alipay/status/:orderId
  // ─────────────────────────────────────────────
  app.get('/api/enterprise/subscription/payment-status/:orderId', async (request, reply) => {
    try {
      const userId = (request.user as any)?.userId || (request.user as any)?.id
      if (!userId) return reply.status(401).send(toApiResponse({ success: false, message: '未登录' }))

      const { orderId } = request.params as any
      if (!orderId) {
        return reply.status(400).send(toApiResponse({ success: false, message: '缺少 orderId' }))
      }

      const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
      if (!order) {
        return reply.status(404).send(toApiResponse({ success: false, message: '订单不存在' }))
      }
      if (order.userId !== userId) {
        return reply.status(403).send(toApiResponse({ success: false, message: '无权访问此订单' }))
      }

      const status = order.status
      const isPaid = status === 'paid' || status === 'completed'

      return toApiResponse({
        success: true,
        data: {
          status,
          isPaid,
          payTime: order.payTime,
          orderNo: order.orderNo,
          amount: order.amount,
        },
      })
    } catch (err: any) {
      return reply.status(500).send(toApiResponse({ success: false, message: err.message }))
    }
  })

  // ─────────────────────────────────────────────
  // POST /api/enterprise/subscription/activate
  // 支付成功后激活订阅
  // ─────────────────────────────────────────────
  app.post('/api/enterprise/subscription/activate', async (request, reply) => {
    try {
      const userId = (request.user as any)?.userId || (request.user as any)?.id
      if (!userId) return reply.status(401).send(toApiResponse({ success: false, message: '未登录' }))

      // 查找用户所属的 workspace Organization
      const userOrgMember = await prisma.orgMember.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      })
      const orgId = userOrgMember?.organizationId
      if (!orgId) return reply.status(404).send(toApiResponse({ success: false, message: '未找到企业' }))

      const { orderId } = request.body as any
      if (!orderId) {
        return reply.status(400).send(toApiResponse({ success: false, message: '缺少 orderId' }))
      }

      // 验证订单
      const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
      if (!order) return reply.status(404).send(toApiResponse({ success: false, message: '订单不存在' }))
      if (order.organizationId !== orgId) {
        return reply.status(403).send(toApiResponse({ success: false, message: '订单不属于当前企业' }))
      }
      if (order.status !== 'paid' && order.status !== 'completed') {
        return reply.status(400).send(toApiResponse({ success: false, message: '订单未支付，请先完成支付' }))
      }

      const metadata = (order.metadata as any) || {}
      const periodDays = metadata.periodDays || 30

      // 激活订阅
      await prisma.enterpriseSubscription.updateMany({
        where: { organizationId: orgId, orderId },
        data: {
          status: 'active',
          startAt: new Date(),
          expireAt: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000),
        },
      })

      // 同步创建 Entitlement
      const subscription = await prisma.enterpriseSubscription.findUnique({ where: { organizationId: orgId } })
      if (subscription) {
        const { entitlementService } = await import('../services/enterprise/enterprise-entitlement.service.js')
        await entitlementService.createFromSubscription(orgId, subscription.id)

        // SPRINT-IDENTITY-REALITY-01 T03: 订阅激活 → AI 员工自动到岗（套餐 employees 配置）
        try {
          const { enterpriseEmployeeProvisionService } = await import('../services/enterprise/enterprise-employee-provision.service.js')
          const provisionResult = await enterpriseEmployeeProvisionService.provisionEmployeesForPlan(orgId, subscription.planId)
          console.log(`[Activate] Provision result: ${JSON.stringify(provisionResult)}`)
        } catch (provisionErr: any) {
          console.warn(`[Activate] Provision failed (非阻塞): ${provisionErr.message}`)
        }
      }

      const updated = await prisma.enterpriseSubscription.findUnique({
        where: { organizationId: orgId },
        include: { entitlement: true },
      })

      return toApiResponse({
        status: updated?.status,
        startAt: updated?.startAt,
        expireAt: updated?.expireAt,
        entitlement: updated?.entitlement ? {
          maxAgents: updated.entitlement.maxAgents,
          maxChannels: updated.entitlement.maxChannels,
          maxMembers: updated.entitlement.maxMembers,
          capabilityCodes: updated.entitlement.capabilityCodes,
        } : null,
      })
    } catch (err: any) {
      return reply.status(500).send(toApiResponse({ success: false, message: err.message }))
    }
  })

  // ─────────────────────────────────────────────
  // POST /api/enterprise/subscription/cancel
  // 取消订阅
  // ─────────────────────────────────────────────
  app.post('/api/enterprise/subscription/cancel', async (request, reply) => {
    try {
      const userId = (request.user as any)?.userId || (request.user as any)?.id
      if (!userId) return reply.status(401).send(toApiResponse({ success: false, message: '未登录' }))

      // 查找用户所属的 workspace Organization
      const userOrgMember = await prisma.orgMember.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      })
      const orgId = userOrgMember?.organizationId
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

  // ─────────────────────────────────────────────
  // GET /api/enterprise/:orgId/billing/overview
  // 工作区账单概览页 — 返回订阅 + 用量 + 套餐列表 + 订单
  // ─────────────────────────────────────────────
  app.get('/api/enterprise/:orgId/billing/overview', async (request, reply) => {
    try {
      const userId = (request.user as any)?.userId || (request.user as any)?.id
      if (!userId) return reply.status(401).send(toApiResponse({ success: false, message: '未登录' }))

      const { orgId } = request.params as any
      if (!orgId) return reply.status(400).send(toApiResponse({ success: false, message: '缺少组织ID' }))

      // 验证用户属于该组织
      const authedOrg = await isOrgAuthorized(userId, orgId)
      if (!authedOrg) {
        return reply.status(403).send(toApiResponse({ success: false, message: '无权访问此组织账单' }))
      }
      const resolvedOrgId = authedOrg

      // 获取当前订阅
      const sub = await prisma.enterpriseSubscription.findUnique({
        where: { organizationId: resolvedOrgId },
        include: { plan: true },
      })

      // 获取可用的套餐列表
      const plans = await prisma.enterprisePlan.findMany({
        where: { enabled: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          displayName: true,
          description: true,
          price: true,
          yearlyPrice: true,
          originalPrice: true,
          maxEmployees: true,
          maxChannels: true,
          maxMembers: true,
          storageLimit: true,
          features: true,
          sortOrder: true,
        },
      })

      // 获取最近订单
      const recentOrders = await prisma.paymentOrder.findMany({
        where: { organizationId: resolvedOrgId, type: 'enterprise_subscription' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          orderNo: true,
          amount: true,
          status: true,
          createdAt: true,
          metadata: true,
        },
      })

      // 计算用量（从实际数据聚合）
      const agentCount = await prisma.enterpriseAgentInstance.count({ where: { organizationId: resolvedOrgId } }).catch(() => 0)
      // 渠道数通过 AgentChannelBinding 聚合
      const channelCount = await prisma.agentChannelBinding.count({
        where: { agent: { organizationId: resolvedOrgId } },
      }).catch(() => 0) || 0
      // 成员数通过 GovUser 的 tenantId 关联获取
      const org = await prisma.govOrganization.findUnique({ where: { id: resolvedOrgId } })
      const memberCount = org?.tenantId
        ? await prisma.govUser.count({ where: { tenantId: org.tenantId } }).catch(() => 0)
        : 0

      return toApiResponse({
          subscription: sub ? {
            planId: sub.planId,
            planName: sub.snapshotName || sub.plan?.displayName,
            planPrice: sub.snapshotPrice ?? sub.plan?.price ?? 0,
            billingCycle: sub.snapshotCycle || 'monthly',
            status: sub.status,
            startAt: sub.startAt,
            expireAt: sub.expireAt,
            autoRenew: sub.autoRenew,
          } : null,
          usage: {
            aiEmployeeCount: agentCount,
            channelCount,
            memberCount,
            resumeCount: 0,
            pipelineCount: 0,
            offerCount: 0,
          },
          limits: sub ? {
            maxEmployees: sub.snapshotMaxEmployees,
            maxChannels: sub.snapshotMaxChannels,
            maxMembers: sub.snapshotMaxMembers,
            storageLimit: (sub.plan as any)?.storageLimit || 5,
          } : { maxEmployees: 2, maxChannels: 1, maxMembers: 5, storageLimit: 5 },
          availablePlans: plans.map(p => ({
            ...p,
            billingCycle: p.yearlyPrice && p.yearlyPrice > 0 ? 'yearly' : 'monthly',
          })),
          recentOrders: recentOrders.map(o => ({
            id: o.id,
            orderNo: o.orderNo,
            planType: (o.metadata as any)?.planName || '企业订阅',
            amount: o.amount,
            status: o.status,
            createdAt: o.createdAt,
          })),
      })
    } catch (err: any) {
      return reply.status(500).send(toApiResponse({ success: false, message: err.message }))
    }
  })

  // ─────────────────────────────────────────────
  // POST /api/enterprise/:orgId/billing/upgrade
  // 工作区账单页 — 创建升级订单
  // ─────────────────────────────────────────────
  app.post('/api/enterprise/:orgId/billing/upgrade', async (request, reply) => {
    try {
      const userId = (request.user as any)?.userId || (request.user as any)?.id
      if (!userId) return reply.status(401).send(toApiResponse({ success: false, message: '未登录' }))

      const { orgId } = request.params as any
      const { planId } = request.body as any

      if (!orgId || !planId) {
        return reply.status(400).send(toApiResponse({ success: false, message: '参数不完整' }))
      }

      // 验证用户属于该组织（支持多 ID 格式）
      const authedOrg = await isOrgAuthorized(userId, orgId)
      if (!authedOrg) {
        return reply.status(403).send(toApiResponse({ success: false, message: '无权操作此组织' }))
      }

      // 查找套餐
      const plan = await prisma.enterprisePlan.findUnique({ where: { id: planId } })
      if (!plan || !plan.enabled) {
        return reply.status(404).send(toApiResponse({ success: false, message: '套餐不存在或已停用' }))
      }

      const cycle = plan.yearlyPrice && plan.yearlyPrice > 0 ? 'yearly' : 'monthly'
      const price = cycle === 'yearly' ? plan.yearlyPrice : plan.price
      const periodDays = cycle === 'yearly' ? 365 : 30

      // 生成订单号
      const crypto = await import('crypto')
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const rand = crypto.randomBytes(4).toString('hex').toUpperCase()
      const orderNo = `ENT${date}${rand}`

      // 创建订单
      const order = await prisma.$transaction(async (tx) => {
        const newOrder = await tx.paymentOrder.create({
          data: {
            organizationId: orgId,
            userId,
            orderNo,
            amount: price / 100,
            currency: plan.currency,
            coins: 0,
            method: 'pending',
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

        // 更新订阅状态
        const existing = await tx.enterpriseSubscription.findUnique({ where: { organizationId: orgId } })
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
              expireAt: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000),
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

      return toApiResponse({
        success: true,
        data: {
          orderId: order.id,
          orderNo: order.orderNo,
          amount: order.amount,
          message: '订单创建成功，请前往支付',
        },
      })
    } catch (err: any) {
      return reply.status(500).send(toApiResponse({ success: false, message: err.message }))
    }
  })
}
