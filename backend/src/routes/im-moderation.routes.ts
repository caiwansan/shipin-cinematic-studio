// im-moderation.routes.ts — 昆仑茶馆 M3 内容治理（SPRINT-IM-CHA-03）
// 1) 敏感词引擎：客户端即时替换（词库下发）+ 服务端 webhook 复核（防绕过）
// 2) 机器人管理员：昆仑镜小管家（系统 UID）自动入公共频道，违规踢出 + 系统提示
// 3) admin：敏感词库 CRUD / 批量导入 / 重置内置词库 / 审核日志
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'
import { sensitiveEngine, loadSensitiveWordsIntoEngine } from '../im/sensitive-engine.js'
import { SENSITIVE_WORD_SEED, SENSITIVE_CATEGORIES, seedSensitiveWordsIfEmpty } from '../im/sensitive-word-seed.js'
import { decodeMessagePayload, PUBLIC_CHANNEL_ID, PUBLIC_CHANNEL_TYPE } from './im.js'

// ── 配置 ───────────────────────────────────────────────────
const IM_HTTP_ADDR = process.env.IM_HTTP_ADDR || 'http://127.0.0.1:5001'
export const BOT_UID = 'kunlun_tea_bot' // 机器人管理员（昆仑镜小管家），wk.yaml systemUIDs 配置
const BOT_NAME = '昆仑镜小管家'

async function wkApi(path: string, body?: unknown) {
  const res = await fetch(`${IM_HTTP_ADDR}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`WuKongIM API ${path} 失败: ${res.status} ${text.slice(0, 200)}`)
  let data: any = null
  try { data = JSON.parse(text) } catch { data = text }
  if (data && typeof data === 'object' && data.status !== undefined && data.status !== 200 && data.status !== 1) {
    throw new Error(`WuKongIM API ${path} 失败: ${text.slice(0, 200)}`)
  }
  return data
}

/** 机器人代发系统消息（系统 UID 可发任意频道） */
export async function botSendMessage(channelId: string, channelType: number, text: string) {
  try {
    const payload = Buffer.from(JSON.stringify({ type: 1, content: text })).toString('base64')
    await wkApi('/message/send', {
      channel_id: channelId,
      channel_type: channelType,
      from_uid: BOT_UID,
      payload,
    })
    return true
  } catch (e) {
    console.warn('[昆仑茶馆] 机器人发消息失败:', (e as Error).message)
    return false
  }
}

/** 机器人入公共频道（幂等）：WuKongIM 订阅 + 业务成员表（role=2 机器人） */
export async function ensureBotInPublicChannel() {
  try {
    await wkApi('/channel/subscriber_add', {
      channel_id: PUBLIC_CHANNEL_ID,
      channel_type: PUBLIC_CHANNEL_TYPE,
      subscribers: [BOT_UID],
    })
    await prisma.imChannelMember.upsert({
      where: { channelId_channelType_uid: { channelId: PUBLIC_CHANNEL_ID, channelType: PUBLIC_CHANNEL_TYPE, uid: BOT_UID } },
      create: { channelId: PUBLIC_CHANNEL_ID, channelType: PUBLIC_CHANNEL_TYPE, uid: BOT_UID, role: 2, name: BOT_NAME, avatar: '' },
      update: { role: 2, name: BOT_NAME },
    })
    return true
  } catch (e) {
    console.warn('[昆仑茶馆] 机器人入公共频道失败:', (e as Error).message)
    return false
  }
}

/** 解析 webhook 消息事件（v1.2.6：POST {url}?event=msg.notify，body = MessageResp[]） */
function parseWebhookMessage(item: any): { channelId: string; channelType: number; fromUid: string; messageId: string; payload: string } | null {
  const channelId = item?.channel_id ?? ''
  const channelType = Number(item?.channel_type ?? 4)
  const fromUid = item?.from_uid ?? ''
  const messageId = item?.message_idstr ?? String(item?.message_id ?? '')
  const payload = item?.payload ?? ''
  if (!channelId || !fromUid || !payload) return null
  return { channelId, channelType, fromUid, messageId, payload }
}

/** webhook 消息复核：命中敏感词 → 处置 + 审计（幂等） */
async function handleWebhookMessage(msg: { channelId: string; channelType: number; fromUid: string; messageId: string; payload: string }) {
  // 机器人/系统消息跳过
  if (msg.fromUid === BOT_UID) return { handled: false, reason: 'bot' }
  const decoded = decodeMessagePayload(msg.payload)
  let text = ''
  if (typeof decoded === 'string') text = decoded
  else if (decoded && typeof decoded.content === 'string') text = decoded.content
  else if (decoded && decoded.content && typeof decoded.content === 'object' && 'text' in decoded.content) text = String((decoded.content as any).text || '')
  if (!text.trim()) return { handled: false, reason: 'empty' }

  const hits = sensitiveEngine.scan(text)
  if (!hits.length) return { handled: false, reason: 'clean' }

  // 幂等：同消息已处置过则跳过（webhook 会重试）
  const existed = await prisma.chatModerationLog.findFirst({
    where: { messageId: msg.messageId, uid: msg.fromUid },
  })
  if (existed) return { handled: true, reason: 'duplicate' }

  const maxLevel = Math.max(...hits.map((h) => h.level))
  const matched = [...new Set(hits.map((h) => h.word))].join(',')
  let action = 'replace'
  if (maxLevel >= 4) {
    // 高敏：踢出频道（公共/群频道）+ 系统提示
    action = 'kick'
    if (msg.channelType === 4 || msg.channelType === 2) {
      try {
        await wkApi('/channel/subscriber_remove', {
          channel_id: msg.channelId,
          channel_type: msg.channelType,
          subscribers: [msg.fromUid],
        })
      } catch (e) {
        console.warn('[昆仑茶馆] 踢出失败:', (e as Error).message)
      }
      await botSendMessage(msg.channelId, msg.channelType, `⚠️ 检测到违规内容，已对相关账号执行处置（系统自动）。`)
    }
  } else {
    // 中敏：机器人频道内提醒（不刷屏：每 60s 最多一条提醒由调用方节流）
    action = 'notice'
    await botSendMessage(msg.channelId, msg.channelType, `📢 请文明发言，聊天内容已过滤敏感词汇。`)
  }

  await prisma.chatModerationLog.create({
    data: {
      channelId: msg.channelId,
      channelType: msg.channelType,
      uid: msg.fromUid,
      messageId: msg.messageId,
      content: text.slice(0, 500),
      matched,
      level: maxLevel,
      action,
    },
  })
  return { handled: true, action, matched, maxLevel }
}

export default async function imModerationRoutes(fastify: FastifyInstance) {
  // ── webhook（WuKongIM 推送，无鉴权；仅内网可达）────────────────
  // 格式：POST {httpAddr}?event=msg.notify，body = MessageResp[]（payload 为 base64 字符串）
  fastify.post('/api/im/webhook', async (request: any, reply: FastifyReply) => {
    const event = String(request.query?.event || '')
    const body = request.body
    if (event === 'msg.notify' && Array.isArray(body)) {
      for (const item of body) {
        const msg = parseWebhookMessage(item)
        if (msg) {
          handleWebhookMessage(msg).catch((e) => console.warn('[昆仑茶馆] webhook 复核异常:', (e as Error).message))
        }
      }
    }
    return { success: true }
  })

  // ── 用户端：词库下发（客户端即时替换用；登录即可拉）────────────
  fastify.get('/api/im/sensitive-words', { preHandler: [fastify.authenticate] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const rows = await prisma.chatSensitiveWord.findMany({ where: { isActive: true }, select: { word: true, category: true } })
    return { success: true, data: { words: rows.map((r) => r.word), version: Date.now() } }
  })

  // ── 用户端：服务端权威检测/替换（发送前校验兜底）────────────────
  fastify.post('/api/im/moderation/check', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const { text } = (request.body as any) || {}
    if (typeof text !== 'string' || !text.length) return { success: true, data: { text: '', hits: [] } }
    const result = sensitiveEngine.replace(text)
    return { success: true, data: { text: result.text, hits: result.hits.map((h) => ({ word: h.word, category: h.category, level: h.level })) } }
  })

  // ── admin：词库管理 ─────────────────────────────────────────
  // 列表（分页/搜索/分类过滤）
  fastify.get('/api/admin/im/sensitive-words', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    const page = Math.max(1, Number(request.query.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(request.query.pageSize ?? 20)))
    const q = (request.query.q as string) || ''
    const category = (request.query.category as string) || ''
    const where: any = {}
    if (q) where.word = { contains: q }
    if (category) where.category = category
    const [total, rows] = await Promise.all([
      prisma.chatSensitiveWord.count({ where }),
      prisma.chatSensitiveWord.findMany({ where, orderBy: [{ level: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
    ])
    return { success: true, data: { total, page, pageSize, items: rows, categories: SENSITIVE_CATEGORIES } }
  })

  // 新增
  fastify.post('/api/admin/im/sensitive-words', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    const { word, category = 'other', level = 2, isActive = true } = (request.body as any) || {}
    const w = String(word || '').trim()
    if (!w) return reply.status(400).send({ success: false, error: 'word 必填' })
    try {
      const row = await prisma.chatSensitiveWord.create({ data: { word: w, category: String(category), level: Number(level), isActive: !!isActive } })
      await loadSensitiveWordsIntoEngine(prisma)
      return { success: true, data: row }
    } catch (e: any) {
      if (e?.code === 'P2002') return reply.status(409).send({ success: false, error: '该词已存在' })
      return reply.status(500).send({ success: false, error: (e as Error).message })
    }
  })

  // 更新（词/分类/等级/启停）
  fastify.put('/api/admin/im/sensitive-words/:id', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    const { word, category, level, isActive } = (request.body as any) || {}
    const data: any = {}
    if (word !== undefined) { const w = String(word).trim(); if (!w) return reply.status(400).send({ success: false, error: 'word 不能为空' }); data.word = w }
    if (category !== undefined) data.category = String(category)
    if (level !== undefined) data.level = Number(level)
    if (isActive !== undefined) data.isActive = !!isActive
    try {
      const row = await prisma.chatSensitiveWord.update({ where: { id: request.params.id }, data })
      await loadSensitiveWordsIntoEngine(prisma)
      return { success: true, data: row }
    } catch (e: any) {
      if (e?.code === 'P2025') return reply.status(404).send({ success: false, error: '词不存在' })
      if (e?.code === 'P2002') return reply.status(409).send({ success: false, error: '该词已存在' })
      return reply.status(500).send({ success: false, error: (e as Error).message })
    }
  })

  // 删除
  fastify.delete('/api/admin/im/sensitive-words/:id', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    try {
      await prisma.chatSensitiveWord.delete({ where: { id: request.params.id } })
      await loadSensitiveWordsIntoEngine(prisma)
      return { success: true }
    } catch (e: any) {
      if (e?.code === 'P2025') return reply.status(404).send({ success: false, error: '词不存在' })
      return reply.status(500).send({ success: false, error: (e as Error).message })
    }
  })

  // 批量导入（每行一个词；支持「词|分类|等级」格式，缺省用默认）
  fastify.post('/api/admin/im/sensitive-words/import', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    const { text, category = 'other', level = 2 } = (request.body as any) || {}
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((l: string) => l.trim())
      .filter(Boolean)
    let inserted = 0
    let skipped = 0
    for (const line of lines) {
      const parts = line.split('|')
      const w = (parts[0] || '').trim()
      if (!w) continue
      const cat = (parts[1] || category).trim() || 'other'
      const lv = Number(parts[2] || level) || 2
      try {
        await prisma.chatSensitiveWord.create({ data: { word: w, category: cat, level: lv, isActive: true } })
        inserted++
      } catch {
        skipped++
      }
    }
    await loadSensitiveWordsIntoEngine(prisma)
    return { success: true, data: { inserted, skipped, total: lines.length } }
  })

  // 重置为内置词库（先清空再导入）
  fastify.post('/api/admin/im/sensitive-words/reseed', { preHandler: [requireAdmin] }, async (_request: any, reply: FastifyReply) => {
    await prisma.chatSensitiveWord.deleteMany({})
    let inserted = 0
    for (const w of SENSITIVE_WORD_SEED) {
      try {
        await prisma.chatSensitiveWord.create({ data: { word: w.word, category: w.category, level: w.level, isActive: true } })
        inserted++
      } catch { /* 忽略 */ }
    }
    await loadSensitiveWordsIntoEngine(prisma)
    return { success: true, data: { inserted } }
  })

  // 词库统计
  fastify.get('/api/admin/im/moderation/stats', { preHandler: [requireAdmin] }, async (_request: any, reply: FastifyReply) => {
    const [totalWords, activeWords, totalLogs, todayLogs, kicks] = await Promise.all([
      prisma.chatSensitiveWord.count(),
      prisma.chatSensitiveWord.count({ where: { isActive: true } }),
      prisma.chatModerationLog.count(),
      prisma.chatModerationLog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
      prisma.chatModerationLog.count({ where: { action: 'kick' } }),
    ])
    return { success: true, data: { totalWords, activeWords, totalLogs, todayLogs, kicks } }
  })

  // 审核日志
  fastify.get('/api/admin/im/moderation-logs', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    const page = Math.max(1, Number(request.query.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(request.query.pageSize ?? 20)))
    const action = (request.query.action as string) || ''
    const where: any = {}
    if (action) where.action = action
    const [total, rows] = await Promise.all([
      prisma.chatModerationLog.count({ where }),
      prisma.chatModerationLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    ])
    // 解析 uid → 昵称（User.id 是 UUID 列，过滤非法值防 P2023）
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const uids = [...new Set(rows.map((r) => r.uid).filter((u: string) => uuidRe.test(u)))]
    const users = uids.length
      ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, username: true, email: true } })
      : []
    const nameMap = new Map(users.map((u) => [u.id, u.username || u.email.split('@')[0]]))
    return {
      success: true,
      data: {
        total,
        page,
        pageSize,
        items: rows.map((r) => ({ ...r, userName: nameMap.get(r.uid) || '' })),
      },
    }
  })
}
