// im.ts — 昆仑茶馆（IM 聊天）API
// P1.1：token 签发 / 连接配置 / 公共频道 / 频道列表
// P1.2（三栏控制台）：频道成员（自建表）/ 私聊频道 / 用户列表 / 在线状态上报
// 底座：WuKongIM v1.2.6（docker，端口 5001 HTTP API / 5200 WS）
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import crypto from 'node:crypto'
import { resolve, extname, basename } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { prisma } from '../utils/index.js'
import { classifyMedia, generateThumb, registerMediaObject, startMediaTtlCleaner, MEDIA_UPLOAD_DIR } from '../im/media-ttl.service.js'
import { indexMessage, recallMessage, recalledMessageIds, RECALL_WINDOW_MS } from '../im/im-recall.service.js'
import { transcribeVoice, ASR_AVAILABLE } from '../im/voice-asr.service.js'

// ── 配置（env 可覆盖）──────────────────────────────────────────
const IM_HTTP_ADDR = process.env.IM_HTTP_ADDR || 'http://127.0.0.1:5001'
const IM_WS_ADDR = process.env.IM_WS_ADDR || 'ws://127.0.0.1:5200'
const IM_TOKEN_TTL_DAYS = 7
// 合法 UUID 校验：机器人/外部平台 uid（kunlun_tea_bot、qq_*、wx_*）不是 UUID，传进 User.id 查询会 P2023
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── RTC (R11 语音/视频 1v1) ──
// TURN/STUN：coturn 部署于本机，安全组放行 UDP 3478 + 49152-65535 后公网可达
const TURN_PUBLIC_IP = process.env.TURN_PUBLIC_IP || '124.223.208.24'
const TURN_PORT = parseInt(process.env.TURN_PORT || '3478', 10)
const TURN_SECRET = process.env.TURN_SECRET || ''
// TURN REST API 临时凭证：username=过期unix时间戳，credential=HMAC-SHA1(secret, username) base64
// coturn use-auth-secret 模式直接校验；24h 有效，过期自动失效
function turnCredential(ttlHours = 24) {
  if (!TURN_SECRET) return null
  const unixTs = Math.floor(Date.now() / 1000) + ttlHours * 3600
  const hmac = crypto.createHmac('sha1', TURN_SECRET).update(String(unixTs)).digest('base64')
  return { username: String(unixTs), credential: hmac, ttl: ttlHours * 3600 }
}

// 公共频道 ID（昆仑茶馆大堂）——channel_type 4 = 社区/公共频道
export const PUBLIC_CHANNEL_ID = 'kl_public_tea'
export const PUBLIC_CHANNEL_TYPE = 4

// WuKongIM HTTP 客户端
export async function wkApi(path: string, body?: unknown) {
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

// 解码 WuKongIM 消息 payload（base64 → UTF-8 → JSON），供前端直接消费 content
// 避免前端 atob 按 latin1 解码导致中文乱码（「刷新后消息不见了」根因）
export function decodeMessagePayload(payload: string | null | undefined): any {
  if (!payload) return null
  try {
    const raw = Buffer.from(payload, 'base64')
    const text = raw.toString('utf8')
    const obj = JSON.parse(text)
    if (obj && typeof obj === 'object' && obj.content !== undefined) return obj
    return obj
  } catch {
    return null
  }
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

/** 启动时全量重建公共频道订阅（WuKongIM 容器重启会清空订阅表，DB imChannelMember 是业务真源） */
export async function restorePublicChannelSubscriptions() {
  try {
    await ensurePublicChannel()
    const members = await prisma.imChannelMember.findMany({
      where: { channelId: PUBLIC_CHANNEL_ID, channelType: PUBLIC_CHANNEL_TYPE },
      select: { uid: true },
    })
    const uids = members.map((m) => m.uid)
    if (!uids.length) return
    // 分批（WuKongIM subscriber_add 单次上限 500）
    for (let i = 0; i < uids.length; i += 500) {
      const batch = uids.slice(i, i + 500)
      await wkApi('/channel/subscriber_add', {
        channel_id: PUBLIC_CHANNEL_ID,
        channel_type: PUBLIC_CHANNEL_TYPE,
        subscribers: batch,
      })
    }
    console.log(`[昆仑茶馆] 启动恢复公共频道订阅: ${uids.length} 人`)
  } catch (e) {
    console.warn('[昆仑茶馆] 启动恢复订阅失败（非致命）:', (e as Error).message)
  }
}

// ── 成员管理（业务侧维护，WuKongIM v1.2.6 无订阅者查询 API）──────
export async function ensureMember(opts: { channelId: string; channelType: number; uid: string; role?: number; name?: string; avatar?: string }) {
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

async function userDisplay(user: { id: string; username: string; nickname?: string | null; email: string; avatarUrl?: string | null }) {
  return { id: user.id, name: user.nickname || user.username || user.email.split('@')[0], avatar: user.avatarUrl || '', role: 0 }
}

// 私聊频道 ID：dm_<小uid>_<大uid>（uuid 字符串序，保证幂等）
// ⚠️ 不用单聊（channel_type=1）：WuKongIM v1.2.6 fake 单聊频道投递目标 = 按 '@' 拆分频道 ID，
//    但 fake 频道无 channel_members 记录 → 用户连接不自动订阅 → 对端在线也收不到；
//    私聊改用显式私有频道（channel_type=4，与 RTC 信令同模式）：subscriber_add 双方 → 连接自动订阅，投递/历史/会话全通
export function dmChannelId(a: string, b: string) {
  const [lo, hi] = a < b ? [a, b] : [b, a]
  return `dm_${lo}_${hi}`
}

// ── 上传校验（M4 类型/大小限制；掌柜 2026-08-06 指令）──────────────────
// 白名单：图片/视频/音频/常见文档；单文件大小上限（MB）
const UPLOAD_MAX_MB: Record<string, number> = {
  image: 20,
  video: 200,
  audio: 30,
  file: 50,
}
const EXT_WHITELIST = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',
  '.mp4', '.webm', '.mov', '.mkv', '.avi',
  '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.amr',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md', '.csv', '.zip', '.rar', '.7z', '.json',
])

// ── 翻译（英→中）LLM key：优先 env DEEPSEEK_API_KEY，否则 DB apiKey deepseek_api_key 解密 ──
let translateKeyCache: string | null | undefined = undefined
let translateKeyAt = 0
async function getTranslateKey(): Promise<string | null> {
  if (translateKeyCache !== undefined && Date.now() - translateKeyAt < 5 * 60_000) return translateKeyCache
  if (process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY.startsWith('sk-')) {
    translateKeyCache = process.env.DEEPSEEK_API_KEY
  } else {
    try {
      const { decryptKey } = await import('../services/crypto.service.js')
      const row = await prisma.apiKey.findFirst({ where: { keyName: 'deepseek_api_key' } })
      translateKeyCache = row ? (row.keyValue.startsWith('enc:') || row.keyValue.includes(':') ? await decryptKey(row.keyValue) : row.keyValue) : null
      if (!translateKeyCache?.startsWith('sk-')) translateKeyCache = null
    } catch {
      translateKeyCache = null
    }
  }
  translateKeyAt = Date.now()
  return translateKeyCache
}

/** 服务端代发消息（撤回通知等系统消息用） */
export async function serverSend(channelId: string, channelType: number, fromUid: string, contentType: number, content: any) {
  const payload = Buffer.from(JSON.stringify({ type: contentType, content })).toString('base64')
  return wkApi('/message/send', {
    channel_id: channelId,
    channel_type: channelType,
    from_uid: fromUid,
    payload,
  })
}

export default async function imRoutes(fastify: FastifyInstance) {
  // 媒体 TTL 清理定时任务（每 10 分钟；幂等）
  startMediaTtlCleaner()
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
      const me = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, nickname: true, email: true, avatarUrl: true } })
      if (me) {
        const disp = await userDisplay(me)
        await ensureMember({ channelId: PUBLIC_CHANNEL_ID, channelType: PUBLIC_CHANNEL_TYPE, uid: userId, name: disp.name, avatar: disp.avatar })
      }
    } catch (e) {
      // 订阅失败不阻断 token 签发，但必须留痕（容器重启后首次 token 是恢复订阅的关键时机）
      console.warn(`[昆仑茶馆] 公共频道订阅失败 userId=${userId}: ${(e as Error).message}`)
    }

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
    // 我参与的私聊频道（channel_type=4 显式私有频道），带对方信息
    const myMemberships = await prisma.imChannelMember.findMany({
      where: { uid: userId, channelType: 4 },
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
      where: { id: { in: [...dmUids].filter((u) => UUID_RE.test(u)) } },
      select: { id: true, username: true, nickname: true, email: true, avatarUrl: true, lastActiveAt: true },
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
          name: peer ? peer.nickname || peer.username || peer.email.split('@')[0] : '私聊',
          desc: peer ? peer.email : '',
          avatar: peer?.avatarUrl || '',
          kind: 'dm',
          peerUid,
          lastActiveAt: peer?.lastActiveAt?.toISOString() ?? null,
        }
      })
      .filter((d) => d.peerUid)

    // 我参与的群聊（grp_ 前缀私有频道 → ImGroup 业务表）
    const groupMemberships = await prisma.imChannelMember.findMany({
      where: { uid: userId, channelId: { startsWith: 'grp_' } },
      orderBy: { joinedAt: 'desc' },
      take: 50,
    })
    const groupIds = groupMemberships.map((m) => m.channelId.slice(4))
    const groupRows = groupIds.length
      ? await prisma.imGroup.findMany({ where: { id: { in: groupIds }, status: 'active' } })
      : []
    const groupMap = new Map(groupRows.map((g) => [g.id, g]))
    const groupCounts = new Map<string, number>()
    if (groupRows.length) {
      const rows = await prisma.imChannelMember.groupBy({
        by: ['channelId'],
        where: { channelId: { in: groupRows.map((g) => `grp_${g.id}`) } },
        _count: { uid: true },
      })
      for (const r of rows) groupCounts.set(r.channelId, r._count.uid)
    }
    const groups = groupMemberships
      .map((m) => {
        const g = groupMap.get(m.channelId.slice(4))
        if (!g) return null
        const role = m.role // 2 群主 / 1 管理员 / 0 成员
        return {
          id: m.channelId,
          groupId: g.id,
          type: m.channelType,
          name: g.name,
          desc: g.intro || `共 ${groupCounts.get(m.channelId) ?? 0} 位群友`,
          avatar: g.avatarUrl,
          kind: 'group',
          groupRole: role,
          ownerUid: g.ownerUid,
          memberCount: groupCounts.get(m.channelId) ?? 0,
        }
      })
      .filter((g): g is any => g !== null)

    return { success: true, data: { public: publicChannels, groups, dms } }
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
    // 频道成员名字/头像同步：imChannelMember 快照落后时回填 User 最新昵称/头像（改昵称后茶馆全局生效）
    const uidsAll = members.map((m) => m.uid).filter((u) => UUID_RE.test(u))
    if (uidsAll.length) {
      const userRows = await prisma.user.findMany({ where: { id: { in: uidsAll } }, select: { id: true, username: true, nickname: true, email: true, avatarUrl: true } })
      const userMap = new Map(userRows.map((u) => [u.id, u]))
      for (const m of members) {
        const row = userMap.get(m.uid)
        const freshAvatar = row?.avatarUrl || ''
        if (freshAvatar && m.avatar !== freshAvatar) {
          await prisma.imChannelMember.update({ where: { id: m.id }, data: { avatar: freshAvatar } })
          m.avatar = freshAvatar
        }
        const freshName = row ? (row.nickname || row.username || row.email?.split('@')[0] || m.name) : ''
        if (freshName && m.name !== freshName) {
          await prisma.imChannelMember.update({ where: { id: m.id }, data: { name: freshName } })
          m.name = freshName
        }
      }
    }
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
    const peer = await prisma.user.findUnique({ where: { id: peerUid }, select: { id: true, username: true, nickname: true, email: true, avatarUrl: true } })
    if (!peer) return reply.status(404).send({ success: false, error: '对方用户不存在' })

    const channelId = dmChannelId(userId, peerUid)
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, nickname: true, email: true, avatarUrl: true } })
    // 私聊 = 显式私有频道（channel_type=4，RTC 信令同模式）：创建频道 + 订阅双方。
    // 不能用单聊(type=1)：fake 频道无成员记录，对端连接不自动订阅 → 收不到消息（R11 后掌柜真机实证）
    try {
      await wkApi('/channel', { channel_id: channelId, channel_type: 4 })
    } catch (e) {
      console.warn('[im] ensure-private 创建频道跳过:', (e as Error).message)
    }
    try {
      await wkApi('/channel/subscriber_add', {
        channel_id: channelId,
        channel_type: 4,
        subscribers: [userId, peerUid],
      })
    } catch (e) {
      return reply.status(502).send({ success: false, error: '订阅私聊频道失败: ' + (e as Error).message })
    }
    try {
      const myDisp = me ? await userDisplay(me) : { id: userId, name: userId, avatar: '', role: 0 }
      const peerDisp = await userDisplay(peer)
      await ensureMember({ channelId, channelType: 4, uid: userId, name: myDisp.name, avatar: myDisp.avatar })
      await ensureMember({ channelId, channelType: 4, uid: peerUid, name: peerDisp.name, avatar: peerDisp.avatar })
    } catch (e) {
      console.warn('[im] ensure-private 写成员表失败:', (e as Error).message)
    }
    return {
      success: true,
      data: {
        channel: { id: channelId, type: 4, name: peer.nickname || peer.username, kind: 'dm', peerUid },
        peer: { id: peer.id, name: peer.nickname || peer.username, email: peer.email },
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
      select: { id: true, username: true, nickname: true, email: true, avatarUrl: true, lastActiveAt: true },
      orderBy: { lastActiveAt: 'desc' },
      take: 100,
    })
    const uids = users.map((u) => u.id)
    const presences = uids.length ? await prisma.imUserPresence.findMany({ where: { uid: { in: uids } } }) : []
    const presenceMap = new Map(presences.map((p) => [p.uid, p.online]))
    const data = users.map((u) => ({
      id: u.id,
      name: u.nickname || u.username || u.email.split('@')[0],
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
      // 服务端解码 payload → 前端直接读 content（修复中文乱码：atob latin1 解码导致「刷新后消息不见」）
      // 附加 authorName（账号昵称，User 表 username || email 前缀）→ 群里说话显示昵称，不显示短 UID
      const fromUids = [...new Set((data?.messages || []).map((m: any) => m.from_uid).filter(Boolean))] as string[]
      const authorNames = new Map<string, string>()
      const authorAvatars = new Map<string, string>()
      if (fromUids.length) {
        // 只查合法 UUID（机器人 kunlun_tea_bot / 外部平台 qq_*、wx_* 不是 UUID，直接查 User 会 P2023）
        const senders = await prisma.user.findMany({
          where: { id: { in: fromUids.filter((u: string) => UUID_RE.test(u)) } },
          select: { id: true, username: true, nickname: true, email: true, avatarUrl: true },
        })
        for (const u of senders) {
          authorNames.set(u.id, u.nickname || u.username || u.email.split('@')[0])
          authorAvatars.set(u.id, u.avatarUrl || '')
        }
      }
      const messages = (data?.messages || []).map((m: any) => ({
        ...m,
        payload: m.payload ?? null,
        content: decodeMessagePayload(m.payload),
        authorName: authorNames.get(m.from_uid) || '',
        authorAvatar: authorAvatars.get(m.from_uid) || '',
      }))
      // IM-CHA-M10 撤回过滤：命中撤回集合 → 标记 recalled（前端渲染「已撤回」占位）
      const msgIdKey = (m: any) => m.message_idstr || String(m.message_id || '')
      const recalled = await recalledMessageIds(channelId, Number(channelType))
      if (recalled.size) {
        for (const m of messages) {
          const mid = msgIdKey(m)
          if (mid && recalled.has(mid)) {
            ;(m as any).recalled = true
          }
        }
      }
      return { success: true, data: { ...data, messages } }
    } catch (e) {
      return reply.status(502).send({ success: false, error: (e as Error).message })
    }
  })

  // POST /api/im/users/resolve — 批量解析 uid → 账号昵称（群里说话显示昵称；User 表 username || email 前缀）
  fastify.post('/api/im/users/resolve', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const { uids } = (request.body as any) || {}
    // User.id 是 UUID 列：过滤非法 UUID，避免 Prisma P2023 崩
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const list = Array.isArray(uids)
      ? [...new Set(uids.filter((u: any) => typeof u === 'string' && u && uuidRe.test(u)))].slice(0, 200)
      : []
    const names: Record<string, string> = {}
    const avatars: Record<string, string> = {}
    // 机器人管理员（M3）
    if (Array.isArray(uids) && uids.includes('kunlun_tea_bot')) {
      names['kunlun_tea_bot'] = '昆仑镜小管家'
      avatars['kunlun_tea_bot'] = ''
    }
    if (list.length) {
      const users = await prisma.user.findMany({
        where: { id: { in: list.filter((u: string) => UUID_RE.test(u)) } },
        select: { id: true, username: true, nickname: true, email: true, avatarUrl: true },
      })
      for (const u of users) {
        names[u.id] = u.nickname || u.username || u.email.split('@')[0]
        avatars[u.id] = u.avatarUrl || ''
      }
    }
    return { success: true, data: { names, avatars } }
  })

  // GET /api/im/rtc/config — WebRTC ICE 服务器配置（R11 语音/视频 1v1）
  // STUN/TURN 地址 + 临时凭证（TURN REST API，24h 有效）；TURN_SECRET 未配置则只给 STUN（P2P 兜底）
  fastify.get('/api/im/rtc/config', { preHandler: [fastify.authenticate] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const cred = turnCredential()
    const iceServers: any[] = [{ urls: [`stun:${TURN_PUBLIC_IP}:${TURN_PORT}`] }]
    if (cred) {
      iceServers.push({
        urls: [`turn:${TURN_PUBLIC_IP}:${TURN_PORT}?transport=udp`, `turn:${TURN_PUBLIC_IP}:${TURN_PORT}?transport=tcp`],
        username: cred.username,
        credential: cred.credential,
      })
    }
    return { success: true, data: { iceServers, turnEnabled: !!cred, turnExpiresIn: cred ? cred.ttl : 0 } }
  })

  // POST /api/im/rtc/signal-channel — 创建通话信令私有频道（R11）
  // ⚠️ WuKongIM v1.2.6 单聊(type=1)不支持 subscriber_add（「个人频道不支持添加订阅者」）→ 单聊投递目标解析失败；
  //    私聊频道信令不可用 → 每次通话创建临时 type=4 私有频道 rtc_<callId>，仅订阅双方，通话结束删除
  fastify.post('/api/im/rtc/signal-channel', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const { callId, peerUid } = request.body as any
    if (!callId || !/^[A-Za-z0-9-]{8,64}$/.test(callId)) return reply.status(400).send({ success: false, error: 'callId 非法' })
    if (!peerUid || peerUid === userId || !UUID_RE.test(peerUid)) return reply.status(400).send({ success: false, error: 'peerUid 非法' })
    const channelId = `rtc_${callId}`
    try {
      await wkApi('/channel', { channel_id: channelId, channel_type: 4 })
    } catch (e) {
      console.warn('[rtc] 创建信令频道跳过:', (e as Error).message)
    }
    try {
      await wkApi('/channel/subscriber_add', { channel_id: channelId, channel_type: 4, subscribers: [userId, peerUid] })
    } catch (e) {
      return reply.status(502).send({ success: false, error: '订阅信令频道失败: ' + (e as Error).message })
    }
    return { success: true, data: { channelId, channelType: 4 } }
  })

  // POST /api/im/rtc/signal-channel/close — 通话结束删除信令频道（R11，fire-and-forget 清理）
  fastify.post('/api/im/rtc/signal-channel/close', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const { callId } = request.body as any
    if (!callId || !/^[A-Za-z0-9-]{8,64}$/.test(callId)) return reply.status(400).send({ success: false, error: 'callId 非法' })
    const channelId = `rtc_${callId}`
    try {
      await wkApi('/channel/delete', { channel_id: channelId, channel_type: 4 })
    } catch (e) {
      console.warn('[rtc] 删除信令频道跳过:', (e as Error).message)
    }
    return { success: true }
  })

  // POST /api/im/upload — 聊天媒体上传（图片/文件/短视频/语音）
  // M4：类型白名单 + 大小限制；图片生成缩略图；登记 MediaObject TTL（image 168h / video 72h / file+audio 7d）
  fastify.post('/api/im/upload', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const file = await request.file()
    if (!file) return reply.status(400).send({ success: false, error: '缺少文件' })
    try {
      const buf = await file.toBuffer()
      const ext = (extname(file.filename || '').toLowerCase() || '.bin').slice(0, 10)
      if (!EXT_WHITELIST.has(ext)) {
        return reply.status(400).send({ success: false, error: '不支持的文件类型（' + ext + '）' })
      }
      const { mediaType } = classifyMedia(file.mimetype || '', ext)
      const maxBytes = (UPLOAD_MAX_MB[mediaType] || 10) * 1024 * 1024
      if (buf.length > maxBytes) {
        return reply.status(400).send({ success: false, error: `文件过大（上限 ${UPLOAD_MAX_MB[mediaType] || 10}MB）` })
      }
      const id = crypto.randomUUID()
      const dir = MEDIA_UPLOAD_DIR
      await mkdir(dir, { recursive: true })
      const filename = id + ext
      const filePath = resolve(dir, filename)
      await writeFile(filePath, buf)
      // 图片生成缩略图（缩略图与主文件同 TTL，一并清理）
      let thumbUrl = ''
      if (mediaType === 'image') {
        thumbUrl = await generateThumb(filePath)
      }
      const url = `/uploads/im/${filename}`
      const ttl = await registerMediaObject({
        url,
        filePath,
        mimeType: file.mimetype || '',
        mediaType,
        size: buf.length,
        thumbUrl,
      })
      return {
        success: true,
        data: {
          url,
          thumbUrl,
          name: basename(file.filename || ('file' + ext)),
          size: buf.length,
          mime: file.mimetype || 'application/octet-stream',
          mediaType,
          ttlHours: ttl.ttlHours,
          expiresAt: ttl.expiresAt,
        },
      }
    } catch (e) {
      return reply.status(500).send({ success: false, error: (e as Error).message })
    }
  })

  // POST /api/im/messages/recall — 撤回消息（IM-CHA-M10）
  // 校验：本人消息 + 发送 ≤ 10 分钟（Webhook 归属索引 ImMessageIndex）；落库 + 服务端代发撤回通知
  fastify.post('/api/im/messages/recall', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const { messageId, channelId, channelType } = request.body as any
    if (!messageId || !channelId || !channelType) {
      return reply.status(400).send({ success: false, error: 'messageId/channelId/channelType 必填' })
    }
    const operatorId = request.user.id as string
    try {
      const result = await recallMessage({ messageId, channelId, channelType: Number(channelType), operatorId })
      if (result.code !== 'ok') {
        return reply.status(403).send({ success: false, error: result.error, code: result.code })
      }
      // 广播撤回通知（系统名义，客户端收到后把原消息渲染为已撤回）
      if (!result.data?.already) {
        const me = await prisma.user.findUnique({ where: { id: operatorId }, select: { username: true, nickname: true, email: true } })
        const operatorName = me?.nickname || me?.username || (me?.email || '').split('@')[0] || '茶客'
        try {
          await serverSend(channelId, Number(channelType), 'kunlun_tea_bot', 6, {
            kind: 'recall',
            messageId,
            operatorName,
          })
        } catch (e) {
          console.warn('[昆仑茶馆] 撤回通知广播失败（非致命）:', (e as Error).message)
        }
      }
      return { success: true, data: { messageId, recalledAt: new Date().toISOString() } }
    } catch (e) {
      return reply.status(502).send({ success: false, error: (e as Error).message })
    }
  })

  // POST /api/im/asr — 语音转文字（IM-CHA-M10；长按语音提炼文字）
  // 链路：本地 faster-whisper（音频不出服务器）；同 messageId 缓存不重复转写
  fastify.post('/api/im/asr', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const { messageId, url } = request.body as any
    if (!messageId || !url) return reply.status(400).send({ success: false, error: 'messageId/url 必填' })
    if (!ASR_AVAILABLE) return reply.status(501).send({ success: false, error: '语音转文字未启用' })
    try {
      const text = await transcribeVoice(String(messageId), String(url))
      return { success: true, data: { text } }
    } catch (e) {
      return reply.status(502).send({ success: false, error: (e as Error).message })
    }
  })

  // POST /api/im/translate — 英译中（IM-CHA-M10；DeepSeek 平台 key，只输出译文）
  fastify.post('/api/im/translate', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const { text } = request.body as any
    if (!text || typeof text !== 'string' || text.length > 2000) {
      return reply.status(400).send({ success: false, error: '文本必填且不超过 2000 字符' })
    }
    const key = await getTranslateKey()
    if (!key) return reply.status(501).send({ success: false, error: '翻译服务未配置（DeepSeek key 缺失）' })
    try {
      const res = await fetch(`${process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_LLM_MODEL || 'deepseek-v4-flash',
          messages: [
            { role: 'system', content: '你是专业翻译。将用户消息翻译成简体中文，只输出译文本身，不加解释、不加引号、不改写原文语气。若原文已是中文则原样返回。' },
            { role: 'user', content: text },
          ],
          max_tokens: 1000,
          temperature: 0.2,
        }),
      })
      if (!res.ok) return reply.status(502).send({ success: false, error: '翻译服务响应异常 (' + res.status + ')' })
      const j = await res.json()
      const translated = (j?.choices?.[0]?.message?.content || '').trim()
      if (!translated) return reply.status(502).send({ success: false, error: '翻译无结果' })
      return { success: true, data: { translated, source: text } }
    } catch (e) {
      return reply.status(502).send({ success: false, error: (e as Error).message })
    }
  })

  // POST /api/im/messages/forward — 消息转发（IM-CHA-M10.4：文字/图片/视频可转发到其他频道/私聊）
  fastify.post('/api/im/messages/forward', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const { targetChannelId, targetChannelType, contentType, content, forwardedFrom } = request.body as any
    if (!targetChannelId || !targetChannelType || content == null) {
      return reply.status(400).send({ success: false, error: 'targetChannelId/targetChannelType/content 必填' })
    }
    try {
      // 文本消息 content 为字符串 → 转发时包成 { text, forwardedFrom }；媒体消息 content 为对象 → 直接附加 forwardedFrom
      let fwdContent = content
      if (typeof content === 'string') {
        fwdContent = { text: content, forwardedFrom: forwardedFrom || null }
      } else if (typeof content === 'object') {
        fwdContent = { ...content, forwardedFrom: forwardedFrom || null }
      }
      const payload = Buffer.from(JSON.stringify({ type: contentType || 1, content: fwdContent })).toString('base64')
      const data = await wkApi('/message/send', {
        channel_id: targetChannelId,
        channel_type: targetChannelType,
        from_uid: request.user.id as string,
        payload,
      })
      return { success: true, data }
    } catch (e) {
      return reply.status(502).send({ success: false, error: (e as Error).message })
    }
  })

  // 收藏：POST /api/im/favorites（幂等：同 user+messageId 已收藏则返回已存在）
  fastify.post('/api/im/favorites', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const { messageId, channelId, channelType, contentType, content, fromUid, fromName, channelName } = request.body as any
    if (content == null) return reply.status(400).send({ success: false, error: 'content 必填' })
    try {
      const userId = request.user.id as string
      const payload = typeof content === 'string' ? content : JSON.stringify(content)
      if (messageId) {
        const exist = await prisma.imFavorite.findFirst({ where: { userId, messageId } })
        if (exist) return { success: true, data: exist, duplicated: true }
      }
      const fav = await prisma.imFavorite.create({
        data: {
          userId,
          messageId: String(messageId || ''),
          channelId: String(channelId || ''),
          channelType: Number(channelType) || 4,
          contentType: Number(contentType) || 1,
          content: payload,
          fromUid: String(fromUid || ''),
          fromName: String(fromName || ''),
          channelName: String(channelName || ''),
        },
      })
      return { success: true, data: fav }
    } catch (e) {
      return reply.status(502).send({ success: false, error: (e as Error).message })
    }
  })

  // GET /api/im/favorites — 我的收藏列表（新→旧）
  fastify.get('/api/im/favorites', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const list = await prisma.imFavorite.findMany({
        where: { userId: request.user.id as string },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      return { success: true, data: list }
    } catch (e) {
      return reply.status(502).send({ success: false, error: (e as Error).message })
    }
  })

  // DELETE /api/im/favorites/:id — 取消收藏
  fastify.delete('/api/im/favorites/:id', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const { id } = request.params as any
      const del = await prisma.imFavorite.deleteMany({ where: { id: String(id), userId: request.user.id as string } })
      return { success: true, data: { deleted: del.count } }
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
