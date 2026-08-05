import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { toApiResponse } from '../contracts/runtime/toApiResponse.js';

// ============================================
// MEMBER-CENTER-02 会员中心资产（我的订单 / 我的钻石 / 我的团队）
// ============================================

export default async function userAssetsRoutes(fastify: FastifyInstance) {
  // GET /api/user/orders — 我的订单（充值/VIP/消费）
  fastify.get('/api/user/orders', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const userId = user.id || user.userId
    const { limit = '50', offset = '0' } = request.query as any

    const [orders, total] = await Promise.all([
      prisma.paymentOrder.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(limit) || 50, 200),
        skip: Number(offset) || 0,
      }),
      prisma.paymentOrder.count({ where: { userId } }),
    ])

    const statusMap: Record<string, string> = {
      pending: '待支付',
      paid: '已完成',
      approved: '已完成',
      rejected: '已驳回',
      expired: '已过期',
      refunded: '已退款',
    }

    const typeMap: Record<string, string> = {
      credit: '积分充值',
      vip: 'VIP 开通',
      recharge: '充值',
    }

    return toApiResponse({
      total,
      orders: orders.map(o => ({
        id: o.id,
        orderNo: o.orderNo,
        type: o.type,
        typeLabel: typeMap[o.type] || o.planType || o.type,
        amount: o.amount,
        coins: o.coins,
        method: o.method,
        status: o.status,
        statusLabel: statusMap[o.status] || o.status,
        planType: o.planType,
        payTime: o.payTime,
        createdAt: o.createdAt,
      })),
    }) satisfies ApiResponse<unknown>
  })

  // GET /api/user/diamonds — 我的钻石（充值钻石 + 收益钻石）
  fastify.get('/api/user/diamonds', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const userId = user.id || user.userId

    // 充值钻石 = 所有已支付充值订单的 coins 总和（1 元 = 100 积分）
    const paidRecharge = await prisma.paymentOrder.aggregate({
      where: { userId, status: { in: ['paid', 'approved'] } },
      _sum: { coins: true },
    })
    const rechargeDiamonds = paidRecharge._sum.coins || 0

    // 收益钻石 = 礼物/创作激励（IM 方案 M5，当前无数据则 0）
    const earnDiamonds = 0

    // 流水（最近充值 + 消费）
    const [coinLogs, coinTotal] = await Promise.all([
      prisma.coinLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.coinLog.count({ where: { userId } }),
    ])

    return toApiResponse({
      rechargeDiamonds,
      earnDiamonds,
      totalDiamonds: rechargeDiamonds + earnDiamonds,
      exchangeRate: 0.1, // 1 钻石 = 0.1 元（收益钻石可兑换）
      logs: coinLogs.map(l => ({
        id: l.id,
        amount: l.amount,
        type: l.type,
        remark: l.remark,
        createdAt: l.createdAt,
      })),
      logTotal: coinTotal,
    }) satisfies ApiResponse<unknown>
  })

  // GET /api/user/team — 我的团队（推广树：直接下级 + 团队规模）
  fastify.get('/api/user/team', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const userId = user.id || user.userId
    const { limit = '50', offset = '0' } = request.query as any

    // 直接下级（Membership.parentId = userId）
    const [children, total] = await Promise.all([
      prisma.membership.findMany({
        where: { parentId: userId },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(limit) || 50, 200),
        skip: Number(offset) || 0,
        select: {
          user: { select: { id: true, username: true, email: true, avatarUrl: true, memberTier: true, createdAt: true, lastActiveAt: true } },
        },
      }),
      prisma.membership.count({ where: { parentId: userId } }),
    ])

    // 团队总人数（含间接下级 —— 递归太深，先统计两级）
    let teamTotal = total
    try {
      const secondLevel = await prisma.membership.findMany({
        where: { parentId: userId },
        select: { userId: true },
        take: 500,
      })
      if (secondLevel.length > 0) {
        const ids = secondLevel.map(m => m.userId)
        const secondCount = await prisma.membership.count({
          where: { parentId: { in: ids } },
        })
        teamTotal += secondCount
      }
    } catch { /* non-fatal */ }

    // 我的推广码
    const referralUrl = `https://aigc.fushtn.com/register?ref=${userId}`

    return toApiResponse({
      directCount: total,
      teamTotal,
      referralCode: userId,
      referralUrl,
      members: children.map(c => ({
        id: c.user.id,
        username: c.user.username,
        email: c.user.email,
        avatarUrl: c.user.avatarUrl,
        memberTier: c.user.memberTier,
        joinedAt: c.user.createdAt,
        lastActiveAt: c.user.lastActiveAt,
      })),
    }) satisfies ApiResponse<unknown>
  })
}
