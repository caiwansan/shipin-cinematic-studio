// 昆仑会议路由 — Meeting Routes（增强：创建 mtg_<id> IM 频道 type=4 + 订阅管理，供手机/电脑 mesh 信令 + 会议聊天）
// 功能：创建会议、加入/离开、结束会议、AI纪要
// 关键：每个会议在 WuKongIM 建 mtg_<id> 频道(type=4)，所有参会者 subscribe → CMD('mtg') 信令广播 + 文字聊天走同一频道

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { wkApi } from './im.js'

const chId = (id: string) => 'mtg_' + id
let meetingNoColumnChecked = false
// 生成唯一 6 位会议号（碰撞重试）
async function genMeetingNo(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const no = String(Math.floor(100000 + Math.random() * 900000))
    const dup: any = await prisma.$queryRawUnsafe(`SELECT 1 FROM meeting WHERE meeting_no=$1`, no).catch(() => [])
    if (!dup.length) return no
  }
  // 兜底：用时间戳后 6 位（极小概率碰撞，但保证不阻塞）
  return String(Date.now()).slice(-6)
}
async function ensureMeetingNo(t: any) {
  if (t.meeting_no) return t.meeting_no
  // 仅首次检查列是否存在，避免每次调用都 ALTER TABLE
  if (!meetingNoColumnChecked) {
    try { await prisma.$executeRawUnsafe(`ALTER TABLE meeting ADD COLUMN IF NOT EXISTS meeting_no text`) } catch {}
    meetingNoColumnChecked = true
  }
  if (t.meeting_no) return t.meeting_no
  const no = await genMeetingNo()
  try { await prisma.$queryRawUnsafe(`UPDATE meeting SET meeting_no=$1 WHERE id=$2`, no, t.id); return no } catch { return (t.id || '').slice(-6) }
}

async function ensureMeetingChannel(meetingId: string, name?: string) {
  try {
    await wkApi('/channel', { channel_id: chId(meetingId), channel_type: 4, channel_name: name || ('会议 ' + meetingId.slice(-6)), channel_remark: '昆仑会议' })
  } catch (e) { console.warn('[meeting] 创建频道跳过:', (e as Error).message) }
}
async function addSub(meetingId: string, uid: string) {
  try { await wkApi('/channel/subscriber_add', { channel_id: chId(meetingId), channel_type: 4, subscribers: [uid] }) }
  catch (e) { console.warn('[meeting] 订阅失败:', (e as Error).message) }
}
async function rmSub(meetingId: string, uid: string) {
  try { await wkApi('/channel/subscriber_remove', { channel_id: chId(meetingId), channel_type: 4, subscribers: [uid] }) }
  catch (e) { console.warn('[meeting] 退订失败:', (e as Error).message) }
}
async function delChannel(meetingId: string) {
  try { await wkApi('/channel/delete', { channel_id: chId(meetingId), channel_type: 4 }) }
  catch (e) { console.warn('[meeting] 删除频道跳过:', (e as Error).message) }
}

export default async function meetingRoutes(fastify: FastifyInstance) {
  // POST /api/meeting/create — 创建会议（任意登录用户可发起）
  fastify.post('/api/meeting/create', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { title } = request.body as any
    if (!title) return reply.status(400).send({ success: false, error: 'title 必填' })
    const hostUid = request.user.id
    try { await prisma.$executeRawUnsafe(`ALTER TABLE meeting ADD COLUMN IF NOT EXISTS meeting_no text`) } catch {}
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO meeting (title, host_uid) VALUES ($1, $2) RETURNING id`,
      String(title).trim().slice(0, 60), hostUid
    )
    const meetingId = (result as any)[0].id
    const meetingNo = await genMeetingNo()
    try { await prisma.$queryRawUnsafe(`UPDATE meeting SET meeting_no=$1 WHERE id=$2`, meetingNo, meetingId) } catch {}
    const channelId = chId(meetingId)
    const inviteUrl = `https://aigc.fushtn.com/mobile-app?joinMeeting=${meetingNo}`
    // 建 IM 频道 + 主持人入会订阅（mesh 信令/聊天用）
    await ensureMeetingChannel(meetingId, String(title).trim().slice(0, 40))
    await addSub(meetingId, hostUid)
    await prisma.$queryRawUnsafe(`UPDATE meeting SET channel_id = $1, participant_count = 1 WHERE id = $2`, channelId, meetingId)
    await prisma.$queryRawUnsafe(
      `INSERT INTO meeting_participant (meeting_id, user_uid, role) VALUES ($1, $2, 'host')
       ON CONFLICT (meeting_id, user_uid) DO UPDATE SET role='host', left_at=NULL`, meetingId, hostUid
    )
    return { success: true, data: { id: meetingId, meetingNo, title, hostUid, channelId, channelType: 4, inviteUrl } }
  })

  // POST /api/meeting/join — 加入会议（任意登录用户可入会）
  fastify.post('/api/meeting/join', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { meetingId } = request.body as any
    if (!meetingId) return reply.status(400).send({ success: false, error: 'meetingId 必填' })
    const userUid = request.user.id
    const meeting = await prisma.$queryRawUnsafe(
      `SELECT * FROM meeting WHERE id = $1 AND status = 'active'`, String(meetingId)
    ) as any[]
    if (!meeting.length) return reply.status(404).send({ success: false, error: '会议不存在或已结束' })
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM meeting_participant WHERE meeting_id = $1 AND user_uid = $2`, String(meetingId), userUid
    ) as any[]
    if (!existing.length) {
      await prisma.$queryRawUnsafe(
        `INSERT INTO meeting_participant (meeting_id, user_uid) VALUES ($1, $2) ON CONFLICT (meeting_id, user_uid) DO UPDATE SET left_at=NULL`, String(meetingId), userUid
      )
      await prisma.$queryRawUnsafe(
        `UPDATE meeting SET participant_count = participant_count + 1 WHERE id = $1`, String(meetingId)
      )
    } else {
      await prisma.$queryRawUnsafe(`UPDATE meeting_participant SET left_at = NULL WHERE meeting_id = $1 AND user_uid = $2`, String(meetingId), userUid)
    }
    // 加入 IM 频道订阅（mesh 信令/聊天）
    await ensureMeetingChannel(String(meetingId), (meeting[0] as any).title?.slice(0, 40))
    await addSub(String(meetingId), userUid)
    return { success: true, data: { meetingId, userUid, channelId: chId(String(meetingId)), channelType: 4 } }
  })

  // POST /api/meeting/leave — 离开会议
  fastify.post('/api/meeting/leave', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { meetingId } = request.body as any
    if (!meetingId) return reply.status(400).send({ success: false, error: 'meetingId 必填' })
    const userUid = request.user.id
    await prisma.$queryRawUnsafe(
      `UPDATE meeting_participant SET left_at = NOW() WHERE meeting_id = $1 AND user_uid = $2 AND left_at IS NULL`,
      String(meetingId), userUid
    )
    await prisma.$queryRawUnsafe(
      `UPDATE meeting SET participant_count = GREATEST(0, participant_count - 1) WHERE id = $1`, String(meetingId)
    )
    await rmSub(String(meetingId), userUid)
    return { success: true }
  })

  // POST /api/meeting/end — 结束会议（仅主持人）
  fastify.post('/api/meeting/end', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { meetingId } = request.body as any
    if (!meetingId) return reply.status(400).send({ success: false, error: 'meetingId 必填' })
    const userUid = request.user.id
    const meeting = await prisma.$queryRawUnsafe(
      `SELECT * FROM meeting WHERE id = $1 AND host_uid = $2 AND status = 'active'`, String(meetingId), userUid
    ) as any[]
    if (!meeting.length) return reply.status(403).send({ success: false, error: '无权结束会议' })
    await prisma.$queryRawUnsafe(
      `UPDATE meeting SET status = 'ended', ended_at = NOW() WHERE id = $1`, String(meetingId)
    )
    await prisma.$queryRawUnsafe(
      `UPDATE meeting_participant SET left_at = NOW() WHERE meeting_id = $1 AND left_at IS NULL`, String(meetingId)
    )
    await delChannel(String(meetingId))
    return { success: true }
  })

  // GET /api/meeting/info — 会议信息（需登录）
  fastify.get('/api/meeting/info', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { meetingId } = request.query as any
    if (!meetingId) return reply.status(400).send({ success: false, error: 'meetingId 必填' })
    const meeting = await prisma.$queryRawUnsafe(`SELECT * FROM meeting WHERE id = $1`, String(meetingId)) as any[]
    if (!meeting.length) return reply.status(404).send({ success: false, error: '会议不存在' })
    const no = await ensureMeetingNo(meeting[0])
    const participants = await prisma.$queryRawUnsafe(
      `SELECT * FROM meeting_participant WHERE meeting_id = $1 ORDER BY joined_at`, String(meetingId)
    )
    return { success: true, data: { ...meeting[0], meeting_no: no, inviteUrl: `https://aigc.fushtn.com/mobile-app?joinMeeting=${no}`, participants, channelId: chId(String(meetingId)), channelType: 4 } }
  })

  // GET /api/meeting/by-no?no=XXXXXX — 按会议号解析会议（加入/邀请链接用，需登录）
  fastify.get('/api/meeting/by-no', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { no } = request.query as any
    const n = String(no || '').trim()
    if (!/^\d{6}$/.test(n)) return reply.status(400).send({ success: false, error: '会议号格式不正确（6位数字）' })
    const meeting = await prisma.$queryRawUnsafe(`SELECT * FROM meeting WHERE meeting_no = $1`, n) as any[]
    if (!meeting.length) return reply.status(404).send({ success: false, error: '会议不存在' })
    return { success: true, data: { id: meeting[0].id, title: meeting[0].title, status: meeting[0].status, hostUid: meeting[0].host_uid, meetingNo: n, inviteUrl: `https://aigc.fushtn.com/mobile-app?joinMeeting=${n}` } }
  })

  // GET /api/meeting/list — 会议列表（需登录；只返回当前用户参与的会议）
  fastify.get('/api/meeting/list', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as { status?: string; limit?: string; all?: string }
    const limit = Math.min(50, Math.max(1, Number(query.limit || 20)))
    const status = query.status || 'active'
    const userUid = request.user.id
    // 是否返回全部（管理员用，默认 false）
    const showAll = query.all === 'true' && request.user.role === 'admin'
    let meetings: any[]
    if (showAll) {
      meetings = await prisma.$queryRawUnsafe(
        `SELECT * FROM meeting WHERE status = $1 ORDER BY started_at DESC LIMIT $2`, status, limit
      ) as any[]
    } else {
      // 只返回当前用户参与的会议（作为主持人或参会者）
      meetings = await prisma.$queryRawUnsafe(
        `SELECT m.* FROM meeting m
         LEFT JOIN meeting_participant mp ON mp.meeting_id = m.id
         WHERE m.status = $1 AND (m.host_uid = $2 OR mp.user_uid = $2)
         ORDER BY m.started_at DESC LIMIT $3`,
        status, userUid, limit
      ) as any[]
    }
    const out: any[] = []
    for (const m of meetings) { out.push({ ...m, meeting_no: await ensureMeetingNo(m) }) }
    return { success: true, data: { meetings: out } }
  })

  // GET /api/meeting/summary — AI纪要
  fastify.get('/api/meeting/summary', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { meetingId } = request.query as any
    if (!meetingId) return reply.status(400).send({ success: false, error: 'meetingId 必填' })
    const meeting = await prisma.$queryRawUnsafe(`SELECT * FROM meeting WHERE id = $1`, String(meetingId)) as any[]
    if (!meeting.length) return reply.status(404).send({ success: false, error: '会议不存在' })
    return { success: true, data: { summary: meeting[0].summary || '暂无纪要' } }
  })
}
