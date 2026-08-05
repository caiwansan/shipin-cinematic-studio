// im.ts — 昆仑茶馆（IM 聊天）API
// P1.1：token 签发 / 连接配置 / 公共频道 / 频道列表
// P1.2（三栏控制台）：频道成员（自建表）/ 私聊频道 / 用户列表 / 在线状态上报
// 底座：WuKongIM v1.2.6（docker，端口 5001 HTTP API / 5200 WS）
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import crypto from 'node:crypto'
import { prisma } from '../utils/index.js'

// ── 配置（env 可覆盖）──────────────────────────────────────────
const IM_HTTP_ADDR = process.env.IM_HTTP_ADDR || 'http://127.0.0.1:5001'
const IM_WS_ADDR = process.env.IM_WS_ADDR || 'ws://127.0.0.1:5200'
const IM_TOKEN_TTL_DAYS = 7

// 公共频道 ID（昆仑茶馆大堂）——channel_type 4 = 社区/公共频道
export const PUBLIC_CHANNEL_ID = 'kl_public_tea'
export const PUBLIC_CHANNEL_TYPE = 4

// WuKongIM HTTP 客户端
async function wkApi(path: string, body?: unknown) {
  const res = await fetch(`${IM_HTTP_ADDR}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data: any = null
  try { data = JSON.parse(text) } catch { data = text }
  if (!res.ok) {
    throw new Error(`WuKongIM API ${path} 失败: ${res.status} ${text.slice(0, 200)}`)
  }
  // WuKongIM 成功响应两种形态：{status:200}（ResponseOK）或业务数据（messages/…无 status 字段）
  if (data && typeof data === 'object' && data.status !== undefined && data.status !== 200 && data.status !== 1) {
    throw new Error(`WuKongIM API ${path} 失败: ${text.slice(0, 200)}`)
  }
  return data
}

// 确保公共频道存在（幂等）
export async function ensurePublicChannel() {
  try {
    await wkApi('/channel', {
      channel_id: PUBLIC_CHANNEL_ID,
      channel_type: PUBLIC_CHANNEL_TYPE,
      channel_name: '昆仑茶馆 · 大堂',
      channel_remark: '昆仑镜公共聊天频道（昆仑茶馆）',
    })
    return true
  } catch (e) {
    console.error('[im] ensurePublicChannel 失败:', (e as Error).message)
    return false
  }
}

// ── 成员管理（业务侧维护，WuKongIM v1.2.6 无订阅者查询 API）──────
async function ensureMember(opts: { channelId: string; channelType: number; uid: string; role?: number; name?: string; avatar?: string }) {
  const exist = await prisma.imChannelMember.findUnique({
    where: { channelId_channelType_uid: { channelId: opts.channelId, channelType: opts.channelType, uid: opts.uid } },
  })
  if (exist) {
    if (opts.role !== undefined && (exist.role !== opts.role || (opts.name && exist.name !== opts.name))) {
      await prisma.imChannelMember.update({
        where: { id: exist.id },
        data: { role: opts.role ?? exist.role, name: opts.name ?? exist.name, avatar: opts.avatar ?? exist.avatar },
      })
    }
    return exist
  }
  return prisma.imChannelMember.create({
    data: {
      channelId: opts.channelId,
      channelType: opts.channelType,
      uid: opts.uid,
      role: opts.role ?? 0,
      name: opts.name ?? '',
      avatar: opts.avatar ?? '',
    },
  })
}

async function userDisplay(user: { id: string; username: string; email: string }) {
  return { id: user.id, name: user.username || user.email.split('@')[0], avatar: '', role: 0 }
}

// 私聊频道 ID：dm_<小uid>_<大uid>（uuid 字符串序）
export function dmChannelId(a: string, b: string) {
  const [lo, hi] = a < b ? [a, b] : [b, a]
  return `dm_${lo}_${hi}`
}

export default async function imRoutes(fastify: FastifyInstance) {
  // GET /api/im/config — 连接配置（前端 SDK 初始化用）
  fastify.get('/api/im/config', { preHandler: [fastify.authenticate] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return { success: true, data: { wsAddr: IM_WS_ADDR, httpAddr: IM_HTTP_ADDR, publicChannelId: PUBLIC_CHANNEL_ID, publicChannelType: PUBLIC_CHANNEL_TYPE } }
  })

  // POST /api/im/token — 签发 wukong token（uid = 昆仑镜 userId）+ 公共频道入会
  fastify.post('/api/im/token', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const token = crypto.randomBytes(24).toString('hex')
    const expireAt = new Date(Date.now() + IM_TOKEN_TTL_DAYS * 24 * 3600 * 1000)

    // 旧 token 失效（同用户只留一个活跃会话）
    await prisma.imTokenSession.deleteMany({ where: { userId } })
    await prisma.imTokenSession.create({ data: { userId, token, expireAt } })

    // 同步到 WuKongIM（运行期更新 token）
    try { await wkApi('/user/token', { uid: userId, token }) } catch (e) { /* 非致命 */ }

    // 公共频道幂等初始化 + 用户自动加入（公共频道全员可进；subscribers 为 uid 字符串数组）
    await ensurePublicChannel()
    try {
      await wkApi('/channel/subscriber_add', {
        channel_id: PUBLIC_CHANNEL_ID,
        channel_type: PUBLIC_CHANNEL_TYPE,
        subscribers: [userId],
      })
      const me = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, email: true } })
      if (me) {
        const disp = await userDisplay(me)
        await ensureMember({ channelId: PUBLIC_CHANNEL_ID, channelType: PUBLIC_CHANNEL_TYPE, uid: userId, name: disp.name, avatar: disp.avatar })
      }
    } catch (e) { /* 非致命：加入失败不影响 token 签发 */ }

    return {
      success: true,
      data: {
        uid: userId,
        token,
        wsAddr: IM_WS_ADDR,
        expiresAt: expireAt.toISOString(),
      },
    }
  })

  // GET /api/im/channels — 频道列表（三栏左栏数据：公共频道 / 我的频道 / 最近私聊）
  fastify.get('/api/im/channels', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const publicChannels = [
      {
        id: PUBLIC_CHANNEL_ID,
        type: PUBLIC_CHANNEL_TYPE,
        name: '昆仑茶馆 · 大堂',
        desc: '公共聊天频道：发图、短视频、文件，即时畅聊',
        kind: 'public',
      },
    ]
    // 我参与的私聊频道（channel_type=1），带对方信息
    const myMemberships = await prisma.imChannelMember.findMany({
      where: { uid: userId, channelType: 1 },
      orderBy: { joinedAt: 'desc' },
      take: 50,
    })
    const dmUids = new Set<string>()
    for (const m of myMemberships) {
      // dm_<lo>_<hi> → 对方 uid
      const parts = m.channelId.split('_')
      const a = parts[1] ?? ''
      const b = parts[2] ?? ''
      const peer = a === userId ? b : a === userId ? b : a
      if (a === userId) dmUids.add(b)
      else if (b === userId) dmUids.add(a)
      else dmUids.add(peer)
    }
    const users = await prisma.user.findMany({
      where: { id: { in: [...dmUids] } },
      select: { id: true, username: true, email: true, lastActiveAt: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))
    const dms = myMemberships
      .map((m) => {
        const parts = m.channelId.split('_')
        const a = parts[1] ?? ''
        const b = parts[2] ?? ''
        const peerUid = a === userId ? b : b === userId ? a : ''
        const peer = peerUid ? userMap.get(peerUid) : undefined
        return {
          id: m.channelId,
          type: m.channelType,
          name: peer ? peer.username || peer.email.split('@')[0] : '私聊',
          desc: peer ? peer.email : '',
          kind: 'dm',
          peerUid,
          lastActiveAt: peer?.lastActiveAt?.toISOString() ?? null,
        }
      })
      .filter((d) => d.peerUid)

    return { success: true, data: { public: publicChannels, groups: [], dms } }
  })

  // GET /api/im/channels/:id/members — 频道成员列表（SDK syncSubscribersCallback 数据源）
  fastify.get('/api/im/channels/:id/members', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const channelId = request.params.id as string
    const channelType = Number(request.query.type ?? 4)
    const members = await prisma.imChannelMember.findMany({
      where: { channelId, channelType },
      orderBy: [{ role: 'desc' }, { joinedAt: 'asc' }],
    })
    const uids = members.map((m) => m.uid)
    const presences = uids.length
      ? await prisma.imUserPresence.findMany({ where: { uid: { in: uids } } })
      : []
    const presenceMap = new Map(presences.map((p) => [p.uid, p.online]))
    const data = members.map((m, i) => ({
      uid: m.uid,
      name: m.name,
      remark: '',
      avatar: m.avatar,
      role: m.role,
      channel: { channelID: channelId, channelType },
      version: i + 1,
      isDeleted: false,
      status: presenceMap.get(m.uid) ? 1 : 0, // 1 在线 / 0 离线
      orgData: null,
    }))
    return { success: true, data: { members: data } }
  })

  // POST /api/im/channels/ensure-private — 创建/复用私聊频道（双方入会）
  fastify.post('/api/im/channels/ensure-private', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const { peerUid } = request.body as any
    if (!peerUid || peerUid === userId) {
      return reply.status(400).send({ success: false, error: 'peerUid 必填且不能是自己' })
    }
    const peer = await prisma.user.findUnique({ where: { id: peerUid }, select: { id: true, username: true, email: true } })
    if (!peer) return reply.status(404).send({ success: false, error: '对方用户不存在' })

    const channelId = dmChannelId(userId, peerUid)
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, email: true } })
    try {
      // 单聊频道（channel_type=1）为隐式频道：WuKongIM 不支持显式创建（报「暂不支持个人频道」），
      // 只需订阅双方（subscribers 为 uid 字符串数组）；业务侧写成员表供三栏成员列表使用
      await wkApi('/channel/subscriber_add', {
        channel_id: channelId,
        channel_type: 1,
        subscribers: [userId, peerUid],
      })
    } catch (e) {
      console.warn('[im] ensure-private subscriber_add 跳过:', (e as Error).message)
    }
    try {
      const myDisp = me ? await userDisplay(me) : { id: userId, name: userId, avatar: '', role: 0 }
      const peerDisp = await userDisplay(peer)
      await ensureMember({ channelId, channelType: 1, uid: userId, name: myDisp.name, avatar: myDisp.avatar })
      await ensureMember({ channelId, channelType: 1, uid: peerUid, name: peerDisp.name, avatar: peerDisp.avatar })
    } catch (e) {
      console.warn('[im] ensure-private 写成员表失败:', (e as Error).message)
    }
    return {
      success: true,
      data: {
        channel: { id: channelId, type: 1, name: peer.username, kind: 'dm', peerUid },
        peer: { id: peer.id, name: peer.username, email: peer.email },
      },
    }
  })

  // POST /api/im/presence — 在线状态上报（前端 SDK connect/disconnect 时调用）
  fastify.post('/api/im/presence', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const { online } = request.body as any
    await prisma.imUserPresence.upsert({
      where: { uid: userId },
      create: { uid: userId, online: !!online },
      update: { online: !!online },
    })
    return { success: true }
  })

  // GET /api/im/users — 用户列表（右栏「好友」tab 数据源，P1 = 平台用户）
  fastify.get('/api/im/users', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const q = (request.query.q as string) || ''
    const users = await prisma.user.findMany({
      where: {
        id: { not: userId },
        ...(q ? { OR: [{ username: { contains: q } }, { email: { contains: q } }] } : {}),
      },
      select: { id: true, username: true, email: true, lastActiveAt: true },
      orderBy: { lastActiveAt: 'desc' },
      take: 100,
    })
    const uids = users.map((u) => u.id)
    const presences = uids.length ? await prisma.imUserPresence.findMany({ where: { uid: { in: uids } } }) : []
    const presenceMap = new Map(presences.map((p) => [p.uid, p.online]))
    const data = users.map((u) => ({
      id: u.id,
      name: u.username || u.email.split('@')[0],
      email: u.email,
      online: presenceMap.get(u.id) ?? false,
      lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
    }))
    return { success: true, data: { users: data } }
  })

  // POST /api/im/channel/ensure-public — 确保公共频道存在（幂等，管理/启动用）
  fastify.post('/api/im/channel/ensure-public', { preHandler: [fastify.authenticate] }, async (_request: any, reply: FastifyReply) => {
    const ok = await ensurePublicChannel()
    return { success: ok, data: { channelId: PUBLIC_CHANNEL_ID, channelType: PUBLIC_CHANNEL_TYPE, ensured: ok } }
  })

  // POST /api/im/messages/history — 拉取频道历史消息（代理 WuKongIM /channel/messagesync）
  fastify.post('/api/im/messages/history', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const { channelId, channelType, startSeq, limit = 50, pullMode = 1 } = request.body as any
    if (!channelId || !channelType) {
      return reply.status(400).send({ success: false, error: 'channelId/channelType 必填' })
    }
    try {
      const data = await wkApi('/channel/messagesync', {
        login_uid: request.user.id as string,
        channel_id: channelId,
        channel_type: channelType,
        start_message_seq: startSeq ?? 0,
        limit,
        pull_mode: pullMode,
      })
      return { success: true, data }
    } catch (e) {
      return reply.status(502).send({ success: false, error: (e as Error).message })
    }
  })

  // POST /api/im/messages/send — 服务端代发消息（机器人/系统消息用；普通用户走 SDK 直发）
  fastify.post('/api/im/messages/send', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const { channelId, channelType, content, contentType = 1 } = request.body as any
    if (!channelId || !channelType || !content) {
      return reply.status(400).send({ success: false, error: 'channelId/channelType/content 必填' })
    }
    try {
      const payload = Buffer.from(JSON.stringify({ type: contentType, content })).toString('base64')
      const data = await wkApi('/message/send', {
        channel_id: channelId,
        channel_type: channelType,
        from_uid: request.user.id as string,
        payload,
      })
      return { success: true, data }
    } catch (e) {
      return reply.status(502).send({ success: false, error: (e as Error).message })
    }
  })
}
