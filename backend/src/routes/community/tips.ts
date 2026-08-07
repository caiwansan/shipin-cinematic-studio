// tips.ts — 社区帖子打赏（COMMUNITY-TIP-01）
// 链：打赏帖子 = 送礼物给发帖人（钻石 → 礼物 → 65% 金币入发帖人账）
// 数据源：GiftRecord.postId（非空=帖子打赏），打赏名单/礼物记录统一从这里读
// 与茶馆礼物共用结算体系（gifts.ts），但场景隔离（postId 关联帖子）
import { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import { GIFT_COIN_RATE } from '../gifts.js'

export default async function communityTipRoutes(fastify: FastifyInstance) {
  // POST /api/community/posts/:id/tip — 打赏帖子（需认证）
  // body: { giftId }
  fastify.post('/api/community/posts/:id/tip', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const senderId = request.user.id as string
    const { id: postId } = request.params as { id: string }
    const { giftId } = request.body as { giftId: string }

    if (!giftId) {
      return reply.status(400).send({ success: false, error: 'giftId 必填' })
    }

    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { id: true, title: true, userId: true },
    })
    if (!post) {
      return reply.status(404).send({ success: false, error: '帖子不存在' })
    }
    if (post.userId === senderId) {
      return reply.status(400).send({ success: false, error: '不能打赏自己的帖子' })
    }

    const gift = await prisma.giftProduct.findUnique({ where: { id: giftId } })
    if (!gift || !gift.isActive) {
      return reply.status(404).send({ success: false, error: '礼物不存在或已下架' })
    }

    const coinsAwarded = Math.floor(gift.priceDiamonds * GIFT_COIN_RATE)

    // 事务：扣钻 + 发帖人金币入账 + 打赏记录(GiftRecord.postId) + 帖子 giftCount+1 + 金币流水（原子，防并发超扣）
    let recordId = ''
    try {
      await prisma.$transaction(async (tx) => {
        // 1. 校验并扣减发送方钻石（行级锁防并发）
        const senderMembership = await tx.$queryRawUnsafe<any[]>(
          `SELECT "credits" FROM "Membership" WHERE "userId" = $1::uuid FOR UPDATE`,
          senderId
        )
        const credits = senderMembership?.[0]?.credits ?? 0
        if (credits < gift.priceDiamonds) {
          throw new Error('DIAMOND_INSUFFICIENT')
        }
        await tx.membership.update({
          where: { userId: senderId },
          data: { credits: { decrement: gift.priceDiamonds } },
        })
        // 2. 发帖人金币入账（65%）
        await tx.user.update({
          where: { id: post.userId },
          data: { goldCoins: { increment: coinsAwarded } },
        })
        // 3. 打赏记录（postId 关联帖子，价格/金币快照）
        const record = await tx.giftRecord.create({
          data: {
            senderId,
            receiverId: post.userId,
            giftProductId: gift.id,
            priceDiamonds: gift.priceDiamonds,
            coinsAwarded,
            channelId: postId,
            channelType: 3, // 3 = 社区帖子打赏场景
            postId,
          },
        })
        recordId = record.id
        // 4. 帖子被打赏次数 +1（标题变红判定）
        await tx.communityPost.update({
          where: { id: postId },
          data: { giftCount: { increment: 1 } },
        })
        // 5. 发帖人金币流水
        await tx.goldCoinLog.create({
          data: {
            userId: post.userId,
            amount: coinsAwarded,
            type: 'gift_in',
            remark: `帖子「${post.title.slice(0, 20)}」收到礼物「${gift.name}」`,
            relatedId: record.id,
          },
        })
      })
      console.log(`[community-tip] ${senderId.slice(0, 8)} 打赏帖 ${postId.slice(0, 8)}「${gift.name}」${gift.priceDiamonds}钻 → ${post.userId.slice(0, 8)} +${coinsAwarded}金币`)
    } catch (e: any) {
      if ((e as Error).message === 'DIAMOND_INSUFFICIENT') {
        return reply.status(400).send({ success: false, error: '钻石余额不足，请先充值', code: 'DIAMOND_INSUFFICIENT' })
      }
      throw e
    }

    return {
      success: true,
      data: {
        recordId,
        gift: { id: gift.id, name: gift.name, iconUrl: gift.iconUrl, priceDiamonds: gift.priceDiamonds },
        coinsAwarded,
        postId,
      },
    }
  })

  // GET /api/community/posts/:id/tips — 帖子打赏记录（名单 + 礼物，按时间倒序）
  fastify.get('/api/community/posts/:id/tips', async (request: any, reply: any) => {
    const { id: postId } = request.params as { id: string }
    const post = await prisma.communityPost.findUnique({ where: { id: postId }, select: { id: true } })
    if (!post) {
      return reply.status(404).send({ success: false, error: '帖子不存在' })
    }

    const records = await prisma.giftRecord.findMany({
      where: { postId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, senderId: true, giftProductId: true, priceDiamonds: true, createdAt: true,
      },
    })
    // 礼物批量查（不依赖 relation join：历史打赏的礼物可能已物理删除 → 孤儿展示「礼物已下架」）
    const giftIds = [...new Set(records.map((r) => r.giftProductId))]
    const gifts = giftIds.length
      ? await prisma.giftProduct.findMany({ where: { id: { in: giftIds } }, select: { id: true, name: true, iconUrl: true, priceDiamonds: true } })
      : []
    const giftMap = new Map(gifts.map((g) => [g.id, g]))
    const senderIds = [...new Set(records.map((r) => r.senderId))]
    const senders = senderIds.length
      ? await prisma.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, username: true, avatarUrl: true } })
      : []
    const senderMap = new Map(senders.map((s) => [s.id, s]))

    // 聚合：同一打赏人 + 同一礼物合并计数（名单视图友好）
    const agg = new Map<string, any>()
    for (const r of records) {
      const sender = senderMap.get(r.senderId)
      const key = `${r.senderId}:${r.giftProductId}`
      const g = giftMap.get(r.giftProductId)
      if (!agg.has(key)) {
        agg.set(key, {
          senderId: r.senderId,
          senderName: sender?.username || '茶客',
          senderAvatar: sender?.avatarUrl || '',
          giftId: r.giftProductId,
          giftName: g?.name || '礼物已下架',
          giftIcon: g?.iconUrl || '',
          priceDiamonds: r.priceDiamonds,
          count: 0,
          totalDiamonds: 0,
          lastAt: r.createdAt,
        })
      }
      const item = agg.get(key)
      item.count += 1
      item.totalDiamonds += r.priceDiamonds
    }

    return {
      success: true,
      data: {
        total: records.length,
        totalDiamonds: records.reduce((s, r) => s + r.priceDiamonds, 0),
        records: [...agg.values()],
      },
    }
  })
}
