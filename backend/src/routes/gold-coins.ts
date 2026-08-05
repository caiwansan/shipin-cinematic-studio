// gold-coins.ts — 金币钱包（GIFT-GOLD-ECO-01）
// 金币来源：收到礼物自动结算（65% 钻石价值）；出口：10:1 兑换成余额（最低 200 起，无手续费）
import { FastifyInstance, FastifyReply } from 'fastify'
import { prisma } from '../utils/index.js'
import { GOLD_EXCHANGE_RATE, GOLD_EXCHANGE_MIN } from './gifts.js'

export default async function goldCoinRoutes(fastify: FastifyInstance) {
  // GET /api/user/gold-coins — 金币钱包（余额 + 流水 + 兑换规则）
  fastify.get('/api/user/gold-coins', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { goldCoins: true, walletBalance: true },
    })
    if (!user) return reply.status(404).send({ success: false, error: '用户不存在' })

    const [logs, giftStats] = await Promise.all([
      prisma.goldCoinLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.giftRecord.aggregate({
        where: { receiverId: userId },
        _count: { id: true },
        _sum: { priceDiamonds: true, coinsAwarded: true },
      }),
    ])

    return {
      success: true,
      data: {
        goldCoins: user.goldCoins || 0,
        walletBalance: user.walletBalance || 0,
        exchangeRate: GOLD_EXCHANGE_RATE, // 10 金币 = 1 元
        exchangeMin: GOLD_EXCHANGE_MIN,
        // 可兑换金额（取整到元）：coins / 10
        exchangeableYuan: Math.floor((user.goldCoins || 0) / GOLD_EXCHANGE_RATE),
        giftStats: {
          receivedCount: giftStats._count.id,
          totalGiftDiamonds: giftStats._sum.priceDiamonds || 0,
          totalCoinsAwarded: giftStats._sum.coinsAwarded || 0,
        },
        logs: logs.map((l) => ({
          id: l.id,
          amount: l.amount,
          type: l.type,
          typeLabel: l.type === 'gift_in' ? '礼物收益' : l.type === 'exchange_out' ? '兑换余额' : l.type,
          remark: l.remark || '',
          createdAt: l.createdAt,
        })),
      },
    }
  })

  // POST /api/user/gold-coins/exchange — 金币兑换余额（10:1，最低 200 起）
  // body: { coins: 金币数（10 的倍数）} → 余额 + coins/10 元
  fastify.post('/api/user/gold-coins/exchange', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const { coins } = request.body as any

    const exchangeCoins = Number(coins)
    if (!Number.isInteger(exchangeCoins) || exchangeCoins <= 0) {
      return reply.status(400).send({ success: false, error: '兑换金币数必须为正整数' })
    }
    if (exchangeCoins % GOLD_EXCHANGE_RATE !== 0) {
      return reply.status(400).send({ success: false, error: `兑换金币数须为 ${GOLD_EXCHANGE_RATE} 的倍数（每 ${GOLD_EXCHANGE_RATE} 金币 = 1 元）` })
    }
    if (exchangeCoins < GOLD_EXCHANGE_MIN) {
      return reply.status(400).send({ success: false, error: `金币最低 ${GOLD_EXCHANGE_MIN} 起兑，当前 ${exchangeCoins}` })
    }
    const yuan = exchangeCoins / GOLD_EXCHANGE_RATE

    try {
      await prisma.$transaction(async (tx) => {
        // 行级锁校验金币余额
        const rows = await tx.$queryRawUnsafe<any[]>(
          `SELECT "gold_coins" FROM "User" WHERE "id" = $1::uuid FOR UPDATE`,
          userId
        )
        const balance = rows?.[0]?.gold_coins ?? 0
        if (balance < exchangeCoins) {
          throw new Error('GOLD_INSUFFICIENT')
        }
        await tx.user.update({
          where: { id: userId },
          data: { goldCoins: { decrement: exchangeCoins }, walletBalance: { increment: yuan } },
        })
        await tx.goldCoinLog.create({
          data: {
            userId,
            amount: -exchangeCoins,
            type: 'exchange_out',
            remark: `兑换余额 ${yuan} 元（${exchangeCoins} 金币）`,
          },
        })
      })
    } catch (e: any) {
      if ((e as Error).message === 'GOLD_INSUFFICIENT') {
        return reply.status(400).send({ success: false, error: '金币余额不足', code: 'GOLD_INSUFFICIENT' })
      }
      throw e
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { goldCoins: true, walletBalance: true } })
    console.log(`[gold] ${userId.slice(0, 8)} 兑换 ${exchangeCoins} 金币 → ${yuan} 元余额`)
    return {
      success: true,
      data: {
        exchangedCoins: exchangeCoins,
        yuan,
        goldCoins: user?.goldCoins || 0,
        walletBalance: user?.walletBalance || 0,
      },
    }
  })
}
