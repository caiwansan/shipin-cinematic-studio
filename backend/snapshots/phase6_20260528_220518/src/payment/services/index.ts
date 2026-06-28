// ─── 支付服务（核心逻辑） ───
// 负责订单创建、状态管理、积分/会员激活

import { prisma } from '../../utils/index.js'
import { WechatPayProvider } from '../providers/wechat/index.js'
import { AlipayProvider } from '../providers/alipay/index.js'
import { getWechatConfig, getAlipayConfig } from '../config/index.js'
import { CreateOrderRequest, PayMethod } from '../types.js'
import * as crypto from 'crypto'

function generateOrderNo(type: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase()
  const prefix = type === 'subscription' ? 'SUB' : 'CZ'
  return `${prefix}${date}${rand}`
}

export class PaymentService {
  /** 创建支付订单 */
  async createOrder(userId: string, req: CreateOrderRequest) {
    const { type, payMethod, amount, credits, planType, description } = req
    const orderNo = generateOrderNo(type)

    // 计算金额
    let finalAmount = 0
    let finalCredits = 0

    if (type === 'credit') {
      // 积分充值：1元 = 100积分
      finalAmount = amount || 10
      finalCredits = credits || (finalAmount * 100)
    } else if (type === 'subscription') {
      // 会员订阅：从套餐定价获取
      const { PLAN_PRICES } = await import('../types.js')
      if (!planType || !PLAN_PRICES[planType]) {
        throw new Error('无效的订阅方案')
      }
      finalAmount = PLAN_PRICES[planType].price
    }

    // 创建数据库订单
    const order = await prisma.paymentOrder.create({
      data: {
        userId,
        orderNo,
        type,
        amount: finalAmount,
        method: payMethod,
        status: 'pending',
        coins: type === 'credit' ? finalCredits : 0,
        planType: type === 'subscription' ? planType : null,
      },
    })

    // 调用支付提供商
    if (payMethod === 'wechat') {
      return await this.createWechatOrder(order, description || `积分充值 ${finalCredits}分`)
    } else if (payMethod === 'alipay') {
      return await this.createAlipayOrder(order, description || `积分充值 ${finalCredits}分`)
    }

    throw new Error('不支持的支付方式')
  }

  /** 调用微信支付 */
  private async createWechatOrder(order: any, description: string) {
    const config = await getWechatConfig()
    if (!config) throw new Error('微信支付未配置')

    const provider = new WechatPayProvider(config)
    const result = await provider.createOrder({
      outTradeNo: order.orderNo,
      description,
      amount: order.amount,
      notifyUrl: config.notifyUrl,
    })

    // 更新预支付信息
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        prepayId: result.prepayId,
        qrCode: result.qrCode,
      },
    })

    return {
      orderId: order.id,
      orderNo: order.orderNo,
      amount: order.amount,
      type: order.type,
      status: 'pending',
      qrCode: result.qrCode,
      payMethod: 'wechat',
    }
  }

  /** 调用支付宝支付 */
  private async createAlipayOrder(order: any, description: string) {
    const config = await getAlipayConfig()
    if (!config) throw new Error('支付宝未配置')

    const provider = new AlipayProvider(config)
    const result = await provider.createOrder({
      outTradeNo: order.orderNo,
      description,
      amount: order.amount,
      notifyUrl: config.notifyUrl,
      returnUrl: config.returnUrl,
    })

    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { payUrl: result.payUrl },
    })

    return {
      orderId: order.id,
      orderNo: order.orderNo,
      amount: order.amount,
      type: order.type,
      status: 'pending',
      payUrl: result.payUrl,
      payMethod: 'alipay',
    }
  }

  /** 处理支付成功回调 */
  async handlePaymentSuccess(orderNo: string, tradeNo: string, payTime: Date, rawData: any) {
    const order = await prisma.paymentOrder.findUnique({ where: { orderNo } })
    if (!order) throw new Error('订单不存在')
    if (order.status === 'paid') return { alreadyPaid: true } // 幂等处理

    // 更新订单为已支付
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: 'paid',
        outTradeNo: tradeNo,
        payTime,
        rawNotify: rawData ? JSON.stringify(rawData) : null,
      },
    })

    // 根据订单类型执行业务逻辑
    if (order.type === 'credit') {
      await this.activateCreditOrder(order)
    } else if (order.type === 'subscription') {
      await this.activateSubscriptionOrder(order)
    }

    return { alreadyPaid: false }
  }

  /** 积分充值到账 */
  private async activateCreditOrder(order: any) {
    const userId = order.userId
    const coins = order.coins

    // 加积分
    await prisma.user.update({
      where: { id: userId },
      data: { coins: { increment: coins } },
    })

    // 记流水
    await prisma.coinLog.create({
      data: {
        userId,
        amount: coins,
        type: 'recharge',
        remark: `微信/支付宝支付充值 ${coins} 积分 (¥${order.amount})`,
        relatedId: order.id,
      },
    })

    // 更新会员积分
    const membership = await prisma.membership.findUnique({ where: { userId } })
    if (membership) {
      await prisma.membership.update({
        where: { userId },
        data: { credits: { increment: coins } },
      })
    }
  }

  /** 会员订阅激活 */
  private async activateSubscriptionOrder(order: any) {
    const userId = order.userId
    const { PLAN_PRICES } = await import('../types.js')
    if (!order.planType) return

    const plan = PLAN_PRICES[order.planType as keyof typeof PLAN_PRICES]
    const now = new Date()
    const extraDays = plan ? plan.days : 30

    const membership = await prisma.membership.findUnique({ where: { userId } })
    if (membership) {
      const base = membership.expiresAt && membership.expiresAt > now ? membership.expiresAt : now
      const newExpire = new Date(base.getTime() + extraDays * 24 * 60 * 60 * 1000)
      await prisma.membership.update({
        where: { userId },
        data: {
          tier: 'premium',
          expiresAt: newExpire,
          credits: { increment: 500 },
        },
      })
    } else {
      const newExpire = new Date(now.getTime() + extraDays * 24 * 60 * 60 * 1000)
      await prisma.membership.create({
        data: {
          userId,
          tier: 'premium',
          expiresAt: newExpire,
          credits: 500,
          agentLevel: 'none',
        },
      })
    }
  }

  /** 查询订单状态 */
  async queryOrderStatus(orderId: string) {
    const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
    if (!order) throw new Error('订单不存在')
    return {
      id: order.id,
      orderNo: order.orderNo,
      status: order.status,
      type: order.type,
      amount: order.amount,
      coins: order.coins,
      payMethod: (order as any).method,
      createdAt: order.createdAt,
      paidAt: (order as any).payTime,
    }
  }
}

export const paymentService = new PaymentService()
