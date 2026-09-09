// gifts.ts — 礼物体系（GIFT-GOLD-ECO-01）
// 链条：钻石(充值,只花不提) → 礼物(打赏,65%钻石价值即时转金币) → 金币(10:1兑余额,200起) → 余额(可提现,5%手续费)
// 防刷核心：赠送必须在服务端事务完成 扣钻 + 金币结算 + 记录，礼物消息由服务端代发（WuKongIM），
//           客户端无法伪造礼物消息绕过结算。
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

// 礼物 → 金币结算比例（65% 归接收人，35% 平台留成）
export const GIFT_COIN_RATE = 0.65

// 金币 → 余额兑换配置（10 金币 = 1 元，最低 200 金币起兑）
export const GOLD_EXCHANGE_RATE = 10 // 10 金币 = 1 元
export const GOLD_EXCHANGE_MIN = 200 // 最低兑换金币数

// ── 礼物商品（用户端）──────────────────────────────
export async function listActiveGifts() {
  return prisma.giftProduct.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { priceDiamonds: 'asc' }],
  })
}

export default async function giftRoutes(fastify: FastifyInstance) {
  // GET /api/gifts/products — 礼物列表（聊天框弹窗数据源）
  fastify.get('/api/gifts/products', { preHandler: [fastify.authenticate] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const gifts = await listActiveGifts()
    // 按分类分组（抖音式：热门/豪华/专属）
    const categories = ['热门', '豪华', '专属', '其他']
    const groups = categories
      .map((c) => ({
        category: c,
        items: gifts.filter((g) => g.category === c).map((g) => ({
          id: g.id,
          name: g.name,
          priceDiamonds: g.priceDiamonds,
          iconUrl: g.iconUrl,
          iconGradient: g.iconGradient,
        })),
      }))
      .filter((g) => g.items.length > 0)
    return { success: true, data: { gifts: groups, coinsAwardedPercent: Math.round(GIFT_COIN_RATE * 100) } }
  })

  // POST /api/gifts/send — 赠送礼物（服务端事务结算 + WuKongIM 代发）
  // body: { giftId, receiverUid, channelId?, channelType? }
  fastify.post('/api/gifts/send', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const senderId = request.user.id as string
    const { giftId, receiverUid, channelId = '', channelType = 0 } = request.body as any

    if (!giftId || !receiverUid) {
      return reply.status(400).send({ success: false, error: 'giftId 与 receiverUid 必填' })
    }
    if (receiverUid === senderId) {
      return reply.status(400).send({ success: false, error: '不能给自己送礼物' })
    }

    const gift = await prisma.giftProduct.findUnique({ where: { id: giftId } })
    if (!gift || !gift.isActive) {
      return reply.status(404).send({ success: false, error: '礼物不存在或已下架' })
    }
    const receiver = await prisma.user.findUnique({ where: { id: receiverUid }, select: { id: true, username: true } })
    if (!receiver) {
      return reply.status(404).send({ success: false, error: '接收人不存在' })
    }

    const coinsAwarded = Math.floor(gift.priceDiamonds * GIFT_COIN_RATE)

    // 事务：扣钻 + 金币入账 + 赠送记录 + 金币流水（原子，防并发超扣）
    let recordId = ''
    try {
      const result = await prisma.$transaction(async (tx) => {
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
        // 2. 接收方金币入账（65%）
        await tx.user.update({
          where: { id: receiverUid },
          data: { goldCoins: { increment: coinsAwarded } },
        })
        // 3. 赠送记录（价格/金币快照）
        const record = await tx.giftRecord.create({
          data: {
            senderId,
            receiverId: receiverUid,
            giftProductId: gift.id,
            priceDiamonds: gift.priceDiamonds,
            coinsAwarded,
            channelId,
            channelType: Number(channelType) || 0,
          },
        })
        recordId = record.id
        // 4. 接收方金币流水
        await tx.goldCoinLog.create({
          data: {
            userId: receiverUid,
            amount: coinsAwarded,
            type: 'gift_in',
            remark: `收到礼物「${gift.name}」`,
            relatedId: record.id,
          },
        })
        return record
      })
      console.log(`[gift] ${senderId.slice(0, 8)} → ${receiverUid.slice(0, 8)} 送「${gift.name}」${gift.priceDiamonds}钻，结算金币 ${coinsAwarded}`)
    } catch (e: any) {
      if ((e as Error).message === 'DIAMOND_INSUFFICIENT') {
        return reply.status(400).send({ success: false, error: '钻石余额不足，请先充值', code: 'DIAMOND_INSUFFICIENT' })
      }
      throw e
    }

    // 服务端代发礼物消息（WuKongIM）：群里/大堂所有人可见；payload type=gift
    // 普通文本消息 contentType=1，礼物消息用自定义 type=2（前端按 content.type 渲染动画）
    let imSent = false
    if (channelId && channelType) {
      try {
        const payload = Buffer.from(
          JSON.stringify({
            type: 2,
            content: {
              kind: 'gift',
              giftId: gift.id,
              giftName: gift.name,
              giftIcon: gift.iconUrl,
              priceDiamonds: gift.priceDiamonds,
              receiverUid,
              senderUid: senderId,
              recordId,
            },
          })
        ).toString('base64')
        await fetch(`${process.env.IM_HTTP_ADDR || 'http://127.0.0.1:5001'}/message/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel_id: channelId,
            channel_type: Number(channelType),
            from_uid: senderId,
            payload,
          }),
        })
        imSent = true
      } catch (e) {
        console.warn('[gift] WuKongIM 代发礼物消息失败（不影响结算）:', (e as Error).message)
      }
    }

    return {
      success: true,
      data: {
        recordId,
        gift: { id: gift.id, name: gift.name, iconUrl: gift.iconUrl, priceDiamonds: gift.priceDiamonds },
        receiver: { id: receiver.id, name: receiver.username },
        coinsAwarded,
        imSent,
      },
    }
  })

  // GET /api/gifts/received — 我收到的礼物记录
  fastify.get('/api/gifts/received', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const { limit = '50', offset = '0' } = request.query as any
    const [records, total] = await Promise.all([
      prisma.giftRecord.findMany({
        where: { receiverId: userId },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(limit) || 50, 200),
        skip: Number(offset) || 0,
        select: {
          id: true, senderId: true, receiverId: true, giftProductId: true,
          priceDiamonds: true, coinsAwarded: true, channelId: true, channelType: true, createdAt: true,
        },
      }),
      prisma.giftRecord.count({ where: { receiverId: userId } }),
    ])
    const senderIds = [...new Set(records.map((r) => r.senderId))]
    const senders = senderIds.length
      ? await prisma.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, username: true } })
      : []
    const senderMap = new Map(senders.map((s) => [s.id, s.username]))
    // 礼物批量查（不依赖 relation join：已删礼物 → 展示「礼物已下架」）
    const giftIds = [...new Set(records.map((r) => r.giftProductId))]
    const gifts = giftIds.length
      ? await prisma.giftProduct.findMany({ where: { id: { in: giftIds } }, select: { id: true, name: true, iconUrl: true } })
      : []
    const giftMap = new Map(gifts.map((g) => [g.id, g]))
    return {
      success: true,
      data: {
        total,
        records: records.map((r) => {
          const g = giftMap.get(r.giftProductId)
          return {
            id: r.id,
            giftName: g?.name || '礼物已下架',
            giftIcon: g?.iconUrl || '',
            priceDiamonds: r.priceDiamonds,
            coinsAwarded: r.coinsAwarded,
            senderName: senderMap.get(r.senderId) || '茶客',
            createdAt: r.createdAt,
          }
        }),
      },
    }
  })

  // ── 后台：礼物商品管理 ──────────────────────────────
  fastify.get('/api/admin/gifts/products', { preHandler: [requireAdmin] }, async () => {
    const gifts = await prisma.giftProduct.findMany({ orderBy: [{ sortOrder: 'asc' }, { priceDiamonds: 'asc' }] })
    return { success: true, data: { gifts } }
  })

  fastify.post('/api/admin/gifts/products', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    const { name, priceDiamonds, iconUrl = '', iconGradient = '', category = '热门', sortOrder = 0 } = request.body as any
    if (!name || !Number(priceDiamonds) || Number(priceDiamonds) < 1) {
      return reply.status(400).send({ success: false, error: 'name 必填且 priceDiamonds 必须 ≥ 1' })
    }
    const gift = await prisma.giftProduct.create({
      data: { name, priceDiamonds: Number(priceDiamonds), iconUrl, iconGradient, category, sortOrder: Number(sortOrder) || 0 },
    })
    return { success: true, data: gift }
  })

  fastify.patch('/api/admin/gifts/products/:id', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    const id = request.params.id as string
    const { name, priceDiamonds, iconUrl, iconGradient, category, sortOrder, isActive } = request.body as any
    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (priceDiamonds !== undefined) data.priceDiamonds = Number(priceDiamonds)
    if (iconUrl !== undefined) data.iconUrl = iconUrl
    if (iconGradient !== undefined) data.iconGradient = iconGradient
    if (category !== undefined) data.category = category
    if (sortOrder !== undefined) data.sortOrder = Number(sortOrder)
    if (isActive !== undefined) data.isActive = !!isActive
    try {
      const gift = await prisma.giftProduct.update({ where: { id }, data })
      return { success: true, data: gift }
    } catch {
      return reply.status(404).send({ success: false, error: '礼物不存在' })
    }
  })

  fastify.delete('/api/admin/gifts/products/:id', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    const id = request.params.id as string
    // 防孤儿：已有打赏记录（茶馆/帖子）的礼物禁止物理删除，只能下架（GIFT-ORPHAN-FIX-01）
    const refCount = await prisma.giftRecord.count({ where: { giftProductId: id } })
    if (refCount > 0) {
      return reply.status(409).send({
        success: false,
        error: `该礼物已有 ${refCount} 条打赏记录，禁止物理删除；请改为「下架」（isActive=false）保留历史`,
        code: 'GIFT_HAS_RECORDS',
      })
    }
    try {
      await prisma.giftProduct.delete({ where: { id } })
      return { success: true }
    } catch {
      return reply.status(404).send({ success: false, error: '礼物不存在' })
    }
  })
}
