// red-packets.ts — 昆仑茶馆红包体系（IM-CHA-M6）
// 群红包：拼手气(lucky)/普通(normal)，钻石（Membership.credits）支付
// 防超抢：事务 + SELECT ... FOR UPDATE 行锁；一人一包（UNIQUE）；24h 未领完自动退回
// IM 联动：发红包/抢红包结果由服务端代发自定义消息（客户端无法伪造绕过结算）
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../utils/index.js'

const IM_HTTP_ADDR = process.env.IM_HTTP_ADDR || 'http://127.0.0.1:5001'
// 红包过期时间（未领完自动退回）
export const RED_PACKET_TTL_MS = 24 * 3600 * 1000

// 抢红包平均金额概率池（拼手气：中间多、两头少，微信风格）
const LUCKY_POOL = [1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 6, 7, 8, 9, 10, 12]

function luckyAmount(remainDiamonds: number, remainCount: number): number {
  if (remainCount <= 1) return remainDiamonds // 最后一个拿全部
  // 保证每人至少 1 钻
  const max = remainDiamonds - (remainCount - 1)
  const pool = LUCKY_POOL.filter((n) => n <= max)
  const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : 1
  return Math.max(1, Math.min(max, pick))
}

async function wkSend(channelId: string, channelType: number, fromUid: string, payloadObj: unknown) {
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64')
  const res = await fetch(`${IM_HTTP_ADDR}/message/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel_id: channelId,
      channel_type: channelType,
      from_uid: fromUid,
      payload,
    }),
  })
  if (!res.ok) throw new Error(`WuKongIM 代发失败 ${res.status}`)
}

async function userBrief(id: string) {
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, email: true, avatarUrl: true } })
  if (!u) return { id, name: '茶客', avatar: '' }
  return { id: u.id, name: u.username || u.email.split('@')[0], avatar: u.avatarUrl || '' }
}

/** 惰性退回过期红包（抢/详情时触发）：剩余钻石退回发送者，状态 refunded */
export async function refundExpiredRedPackets(tx?: any) {
  const db = tx || prisma
  const expired = await db.redPacket.findMany({
    where: { status: 'active', expiredAt: { lt: new Date() } },
  })
  for (const rp of expired) {
    try {
      await db.$transaction(async (t: any) => {
        const cur = await t.redPacket.findUnique({ where: { id: rp.id } })
        if (!cur || cur.status !== 'active') return
        await t.redPacket.update({
          where: { id: rp.id },
          data: { status: 'refunded', refundedAt: new Date(), remainDiamonds: cur.remainDiamonds, remainCount: cur.remainCount },
        })
        if (cur.remainDiamonds > 0) {
          await t.membership.update({
            where: { userId: cur.senderId },
            data: { credits: { increment: cur.remainDiamonds } },
          })
        }
        console.log(`[红包] 过期退回 ${cur.senderId.slice(0, 8)} +${cur.remainDiamonds}钻 (${cur.id.slice(0, 8)})`)
      })
    } catch (e) {
      console.warn(`[红包] 退回失败 ${rp.id}:`, (e as Error).message)
    }
  }
  return expired.length
}

/** 后台定时器：每小时扫一次过期红包（进程内，轻量） */
export function startRedPacketSweeper() {
  const tick = () => refundExpiredRedPackets().catch((e) => console.warn('[红包] 定时退回异常:', (e as Error).message))
  tick()
  const timer = setInterval(tick, 60 * 60 * 1000)
  timer.unref?.()
  return timer
}

export default async function redPacketRoutes(fastify: FastifyInstance) {
  // POST /api/im/red-packets — 发红包（钻石支付，服务端事务扣款 + IM 代发红包卡片）
  // body: { channelId, channelType, totalDiamonds, count, mode: 'lucky'|'normal', note }
  fastify.post('/api/im/red-packets', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const senderId = request.user.id as string
    const { channelId, channelType, totalDiamonds, count, mode = 'lucky', note = '' } = request.body as any
    const total = Number(totalDiamonds)
    const cnt = Number(count)
    if (!channelId || !channelType) return reply.status(400).send({ success: false, error: 'channelId/channelType 必填' })
    if (!Number.isInteger(total) || total < 1) return reply.status(400).send({ success: false, error: '红包金额必须 ≥ 1 钻石' })
    if (!Number.isInteger(cnt) || cnt < 1 || cnt > 200) return reply.status(400).send({ success: false, error: '红包个数必须为 1-200' })
    if (total < cnt) return reply.status(400).send({ success: false, error: '金额不能少于个数（每人至少 1 钻石）' })
    const m = mode === 'normal' ? 'normal' : 'lucky'
    const cleanNote = String(note || '').slice(0, 50)

    let rpId = ''
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 行锁校验钻石余额（防并发超扣）
        const rows = await tx.$queryRawUnsafe<any[]>(
          `SELECT "credits" FROM "Membership" WHERE "userId" = $1::uuid FOR UPDATE`,
          senderId
        )
        const credits = rows?.[0]?.credits ?? 0
        if (credits < total) throw new Error('DIAMOND_INSUFFICIENT')
        await tx.membership.update({ where: { userId: senderId }, data: { credits: { decrement: total } } })
        const rp = await tx.redPacket.create({
          data: {
            senderId,
            channelId,
            channelType: Number(channelType),
            mode: m,
            totalDiamonds: total,
            count: cnt,
            remainDiamonds: total,
            remainCount: cnt,
            note: cleanNote,
            expiredAt: new Date(Date.now() + RED_PACKET_TTL_MS),
          },
        })
        rpId = rp.id
        return rp
      })
      console.log(`[红包] ${senderId.slice(0, 8)} 发 ${total}钻/${cnt}个 (${m}) → ${channelId}`)
    } catch (e: any) {
      if ((e as Error).message === 'DIAMOND_INSUFFICIENT') {
        return reply.status(400).send({ success: false, error: '钻石余额不足，请先充值', code: 'DIAMOND_INSUFFICIENT' })
      }
      throw e
    }

    // IM 代发红包卡片消息（群里所有人可见）
    let imSent = false
    try {
      await wkSend(channelId, Number(channelType), senderId, {
        type: 2,
        content: { kind: 'red_packet', id: rpId, note: cleanNote, totalDiamonds: total, count: cnt, mode: m },
      })
      imSent = true
    } catch (e) {
      console.warn('[红包] IM 代发失败（不影响结算）:', (e as Error).message)
    }
    return { success: true, data: { id: rpId, totalDiamonds: total, count: cnt, mode: m, imSent } }
  })

  // POST /api/im/red-packets/:id/grab — 抢红包（行锁防超抢；自己不能抢自己的；抢完状态 completed）
  fastify.post('/api/im/red-packets/:id/grab', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const rpId = request.params.id as string
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 行锁锁定红包行（并发抢包串行化，防超抢）
        const rows = await tx.$queryRawUnsafe<any[]>(
          `SELECT * FROM "red_packet" WHERE "id" = $1::uuid FOR UPDATE`,
          rpId
        )
        const rp = rows?.[0]
        if (!rp) throw new Error('RED_PACKET_NOT_FOUND')
        // 惰性退回过期红包
        if (rp.status === 'active' && new Date(rp.expiredAt) < new Date()) {
          await refundExpiredRedPackets(tx)
          throw new Error('RED_PACKET_EXPIRED')
        }
        if (rp.status === 'refunded') throw new Error('RED_PACKET_EXPIRED')
        if (rp.senderId === userId) throw new Error('CANNOT_GRAB_OWN')
        if (rp.status === 'completed') throw new Error('RED_PACKET_FINISHED')
        if (rp.remainCount <= 0 || rp.remainDiamonds <= 0) throw new Error('RED_PACKET_FINISHED')
        // 一人一包
        const already = await tx.redPacketGrab.findUnique({
          where: { redPacketId_userId: { redPacketId: rpId, userId } },
        })
        if (already) throw new Error('ALREADY_GRABBED')
        // 分配金额：普通均分余量（最后一个拿剩余），拼手气随机
        let amount = 0
        if (rp.mode === 'normal') {
          amount = Math.floor(rp.remainDiamonds / rp.remainCount)
          if (rp.remainCount === 1) amount = rp.remainDiamonds
        } else {
          amount = luckyAmount(rp.remainDiamonds, rp.remainCount)
        }
        amount = Math.max(1, Math.min(amount, rp.remainDiamonds))
        const newRemainDiamonds = rp.remainDiamonds - amount
        const newRemainCount = rp.remainCount - 1
        await tx.redPacketGrab.create({
          data: { redPacketId: rpId, userId, amount },
          // relation 字段显式 connect（避免 unchecked create 歧义）
        })
        await tx.redPacket.update({
          where: { id: rpId },
          data: {
            remainDiamonds: newRemainDiamonds,
            remainCount: newRemainCount,
            status: newRemainCount <= 0 ? 'completed' : 'active',
          },
        })
        // 钻石入账（抢到的进余额钻石；无 Membership 的账号（如 QQ 登录新用户）自动创建）
        await tx.membership.upsert({
          where: { userId },
          create: { userId, tier: 'free', credits: amount },
          update: { credits: { increment: amount } },
        })
        return { amount, finished: newRemainCount <= 0, remainCount: newRemainCount, remainDiamonds: newRemainDiamonds, note: rp.note, mode: rp.mode, totalDiamonds: rp.totalDiamonds }
      })

      // 抢包结果 → IM 代发「XX 抢到 X 钻石」（群里可见）
      try {
        const me = await userBrief(userId)
        await wkSend(request.body?.channelId || '', Number(request.body?.channelType) || 0, userId, {
          type: 2,
          content: { kind: 'red_packet_grab', id: rpId, userId, userName: me.name, avatar: me.avatar, amount: result.amount, remainCount: result.remainCount },
        })
      } catch (e) {
        console.warn('[红包] 抢包结果 IM 代发失败:', (e as Error).message)
      }
      return { success: true, data: result }
    } catch (e: any) {
      const map: Record<string, string> = {
        RED_PACKET_NOT_FOUND: '红包不存在',
        RED_PACKET_EXPIRED: '红包已过期退回',
        CANNOT_GRAB_OWN: '不能抢自己发的红包',
        RED_PACKET_FINISHED: '手慢了，红包被抢完了',
        ALREADY_GRABBED: '你已经抢过这个红包了',
      }
      const msg = map[(e as Error).message]
      if (msg) return reply.status(400).send({ success: false, error: msg, code: (e as Error).message })
      throw e
    }
  })

  // GET /api/im/red-packets/:id — 红包详情（含我的抢包记录 + 抢包列表）
  fastify.get('/api/im/red-packets/:id', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const rpId = request.params.id as string
    // 惰性退回
    await refundExpiredRedPackets()
    const rp = await prisma.redPacket.findUnique({ where: { id: rpId } })
    if (!rp) return reply.status(404).send({ success: false, error: '红包不存在' })
    const sender = await userBrief(rp.senderId)
    const grabs = await prisma.redPacketGrab.findMany({
      where: { redPacketId: rpId },
      orderBy: { createdAt: 'asc' },
    })
    const grabUserIds = [...new Set(grabs.map((g) => g.userId))]
    const users = grabUserIds.length
      ? await prisma.user.findMany({ where: { id: { in: grabUserIds } }, select: { id: true, username: true, email: true, avatarUrl: true } })
      : []
    const userMap = new Map(users.map((u) => [u.id, u]))
    const mine = grabs.find((g) => g.userId === userId)
    return {
      success: true,
      data: {
        id: rp.id,
        mode: rp.mode,
        note: rp.note,
        totalDiamonds: rp.totalDiamonds,
        count: rp.count,
        remainDiamonds: rp.remainDiamonds,
        remainCount: rp.remainCount,
        status: rp.status,
        createdAt: rp.createdAt,
        expiredAt: rp.expiredAt,
        sender: sender,
        mine: mine ? { amount: mine.amount, createdAt: mine.createdAt } : null,
        grabs: grabs.map((g) => {
          const u = userMap.get(g.userId)
          return { userId: g.userId, name: u ? u.username || u.email.split('@')[0] : '茶客', avatar: u?.avatarUrl || '', amount: g.amount, createdAt: g.createdAt }
        }),
      },
    }
  })

  // 批量状态查询（消息流红包卡片渲染用，一次查最多 20 个）
  fastify.post('/api/im/red-packets/status', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const ids: string[] = Array.isArray(request.body?.ids) ? request.body.ids.slice(0, 20) : []
    if (!ids.length) return { success: true, data: {} }
    const rows = await prisma.redPacket.findMany({
      where: { id: { in: ids } },
      include: { grabs: { select: { userId: true, amount: true } } },
    })
    const data: Record<string, any> = {}
    for (const rp of rows) {
      const my = rp.grabs.find((g) => g.userId === userId)
      data[rp.id] = {
        id: rp.id,
        mode: rp.mode,
        note: rp.note,
        totalDiamonds: rp.totalDiamonds,
        count: rp.count,
        remainCount: rp.remainCount,
        status: rp.status,
        grabbedByMe: !!my,
        mine: my ? { amount: my.amount } : null,
      }
    }
    return { success: true, data }
  })
}
