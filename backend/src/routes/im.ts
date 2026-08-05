// im.ts — 昆仑茶馆（IM 聊天）API
// P1：token 签发 / 连接配置 / 公共频道 / 频道列表
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

export default async function imRoutes(fastify: FastifyInstance) {
  // GET /api/im/config — 连接配置（前端 SDK 初始化用）
  fastify.get('/api/im/config', { preHandler: [fastify.authenticate] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return { success: true, data: { wsAddr: IM_WS_ADDR, httpAddr: IM_HTTP_ADDR, publicChannelId: PUBLIC_CHANNEL_ID, publicChannelType: PUBLIC_CHANNEL_TYPE } }
  })

  // POST /api/im/token — 签发 wukong token（uid = 昆仑镜 userId）
  fastify.post('/api/im/token', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const token = crypto.randomBytes(24).toString('hex')
    const expireAt = new Date(Date.now() + IM_TOKEN_TTL_DAYS * 24 * 3600 * 1000)

    // 旧 token 失效（同用户只留一个活跃会话）
    await prisma.imTokenSession.deleteMany({ where: { userId } })
    await prisma.imTokenSession.create({ data: { userId, token, expireAt } })

    // 同步到 WuKongIM（运行期更新 token）
    try { await wkApi('/user/token', { uid: userId, token }) } catch (e) { /* 非致命 */ }

    // 公共频道幂等初始化 + 用户自动加入（公共频道全员可进）
    await ensurePublicChannel()
    try {
      await wkApi('/channel/subscriber_add', {
        channel_id: PUBLIC_CHANNEL_ID,
        channel_type: PUBLIC_CHANNEL_TYPE,
        subscribers: [{ uid: userId }],
      })
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

  // GET /api/im/channels — 频道列表（P1：公共频道 + 我加入的群）
  fastify.get('/api/im/channels', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const channels = [
      {
        id: PUBLIC_CHANNEL_ID,
        type: PUBLIC_CHANNEL_TYPE,
        name: '昆仑茶馆 · 大堂',
        desc: '公共聊天频道：发图、短视频、文件，即时畅聊',
        kind: 'public',
      },
    ]
    return { success: true, data: { channels } }
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
