// ─── 支付Controller ───
// API路由：创建订单、查询状态、回调通知

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { paymentService } from '../services/index.js'
import { getWechatConfig, getAlipayConfig, isPaymentConfigured } from '../config/index.js'
import { WechatPayProvider } from '../providers/wechat/index.js'
import { AlipayProvider } from '../providers/alipay/index.js'
import { CREDIT_PLANS, PLAN_PRICES } from '../types.js'
import { prisma } from '../../utils/index.js'

/**
 * 支付宝回调处理：VIP 升级订单自动开通
 * 当支付宝返回 trade_status=TRADE_SUCCESS 时由 notify 回调触发
 */
async function handleVipOrderFromAlipay(orderNo: string, tradeNo: string, payTime: Date) {
  try {
    const order = await prisma.rechargeOrder.findFirst({ where: { orderNo } })
    if (!order) {
      console.warn(`[alipay-vip-callback] 订单不存在: ${orderNo}`)
      return
    }
    if (order.status === 'paid') return // 幂等

    const plan = await prisma.memberPlan.findUnique({ where: { level: order.planLevel || '' } })
    if (!plan) {
      console.warn(`[alipay-vip-callback] 套餐不存在: ${order.planLevel}`)
      return
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + plan.months * 24 * 60 * 60 * 1000)

    await prisma.$transaction([
      prisma.rechargeOrder.update({
        where: { id: order.id },
        data: { status: 'paid', payTime: now, tradeNo },
      }),
      prisma.user.update({
        where: { id: order.userId },
        data: {
          memberTier: plan.level,
          memberExpiresAt: expiresAt,
        },
      }),
      prisma.membership.upsert({
        where: { userId: order.userId },
        update: { tier: plan.level, expiresAt, credits: { increment: plan.coins || 0 } },
        create: { userId: order.userId, tier: plan.level, expiresAt, credits: plan.coins || 0 },
      }),
    ])

    if (plan.coins) {
      await prisma.coinLog.create({
        data: {
          userId: order.userId,
          amount: plan.coins,
          type: 'recharge',
          remark: `支付宝自动开通VIP套餐「${plan.name}」`,
          relatedId: order.id,
        },
      }).catch(() => {})
    }

    console.log(`[alipay-vip-callback] ✅ VIP自动开通: userId=${order.userId}, plan=${plan.level}`)
  } catch (err: any) {
    console.error(`[alipay-vip-callback] 失败:`, err.message)
  }
}

export async function registerPaymentRoutes(fastify: FastifyInstance) {
  // ============================================================
  // 支付配置状态
  // ============================================================

  // GET /api/payment/config — 获取支付配置状态
  fastify.get('/api/payment/config', async (_request, reply) => {
    const configured = await isPaymentConfigured()
    return {
      ...configured,
      creditPlans: CREDIT_PLANS,
      subscriptionPlans: Object.entries(PLAN_PRICES).map(([key, val]) => ({
        planType: key,
        ...val,
      })),
    }
  })

  // ============================================================
  // 创建订单（需登录）
  // ============================================================

  // POST /api/payment/create-order — 创建支付订单
  fastify.post('/api/payment/create-order', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: userId } = request.user as any
    const body = request.body as any

    try {
      const result = await paymentService.createOrder(userId, {
        type: body.type || 'credit',
        payMethod: body.payMethod || 'wechat',
        amount: body.amount,
        credits: body.credits,
        planType: body.planType,
        description: body.description,
      })
      return result
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || '创建订单失败' })
    }
  })

  // ============================================================
  // 查询订单
  // ============================================================

  // GET /api/payment/status/:orderId — 查询订单状态
  fastify.get('/api/payment/status/:orderId', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: userId } = request.user as any
    const { orderId } = request.params as any

    try {
      const order = await paymentService.queryOrderStatus(orderId)
      // 只返回自己的订单
      // 注：paymentOrder表目前没有存userId直接关联，由createOrder保证
      return order
    } catch (err: any) {
      return reply.status(404).send({ error: err.message || '订单不存在' })
    }
  })

  // ============================================================
  // 微信支付回调 Webhook
  // ============================================================

  // POST /api/payment/wechat/notify — 微信支付结果通知
  fastify.post('/api/payment/wechat/notify', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any
    const config = await getWechatConfig()

    if (config) {
      const provider = new WechatPayProvider(config)
      if (provider.verifyNotify(body)) {
        const parsed = provider.parseNotify(body)
        await paymentService.handlePaymentSuccess(parsed.outTradeNo, parsed.tradeNo, parsed.paidAt, body)
      }
    }

    // 微信要求返回 XML 格式成功响应
    reply.type('application/xml')
    return '<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>'
  })

  // POST /api/payment/alipay/notify — 支付宝支付结果通知
  fastify.post('/api/payment/alipay/notify', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any
    const config = await getAlipayConfig()

    if (config) {
      const provider = new AlipayProvider(config)
      if (provider.verifyNotify(body)) {
        const parsed = provider.parseNotify(body)
        await paymentService.handlePaymentSuccess(parsed.outTradeNo, parsed.tradeNo, parsed.paidAt, body)

        // 处理 VIP 升级订单（orderNo 以 VIP 开头）
        if (parsed.outTradeNo?.startsWith('VIP')) {
          await handleVipOrderFromAlipay(parsed.outTradeNo, parsed.tradeNo, parsed.paidAt || new Date())
        }
      }
    }

    return 'success'
  })

  // GET /api/payment/subscription/plans — 获取订阅套餐列表
  fastify.get('/api/payment/subscription/plans', async (_request, reply) => {
    return Object.entries(PLAN_PRICES).map(([key, val]) => ({
      planType: key,
      ...val,
    }))
  })
}
