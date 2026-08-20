/**
 * ai-secretary.routes.ts — AI 秘书 API 路由
 * 
 * 端点：
 * - POST /api/meeting/ai-secretary/start — 启动 AI 秘书（VIP only）
 * - POST /api/meeting/ai-secretary/stop — 停止 AI 秘书
 * - GET /api/meeting/ai-secretary/status — 获取状态
 * - GET /api/meeting/ai-secretary/transcripts — 获取转写记录
 * - POST /api/meeting/ai-secretary/transcripts — 手动添加转写（外部视频音频）
 * - GET /api/meeting/ai-secretary/recordings — 获取录音列表
 * - POST /api/meeting/ai-secretary/recording/start — 开始录音
 * - POST /api/meeting/ai-secretary/recording/stop — 结束录音
 * - POST /api/meeting/ai-secretary/minutes/generate — 生成纪要
 * - GET /api/meeting/ai-secretary/minutes — 获取纪要
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { AiSecretary } from '../services/ai-secretary/ai-secretary.service.js'

type AuthUser = { id: string; role?: string }

export default async function aiSecretaryRoutes(fastify: FastifyInstance) {
  // ── 启动 AI 秘书（VIP only）──
  fastify.post('/api/meeting/ai-secretary/start', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { meetingId, language } = request.body as any
    if (!meetingId) return reply.status(400).send({ success: false, error: 'meetingId 必填' })

    const userId = (request.user as any)?.id

    // VIP 检查
    const isVip = await AiSecretary.isVip(userId)
    if (!isVip) {
      return reply.status(403).send({
        success: false,
        error: 'AI 秘书为 VIP 专属功能，请先升级会员',
        needUpgrade: true
      })
    }

    // 验证用户是该会议的主持人
    const meeting = await prisma.$queryRawUnsafe(
      `SELECT * FROM meeting WHERE id = $1 AND host_uid = $2 AND status = 'active'`,
      String(meetingId), userId
    ) as any[]
    if (!meeting.length) return reply.status(403).send({ success: false, error: '无权操作此会议' })

    // 创建 AI 秘书实例
    let secretary = AiSecretary.get(meetingId)
    if (!secretary) {
      secretary = AiSecretary.create(meetingId, userId)
    }

    // 加载参会者姓名
    const participants = await prisma.$queryRawUnsafe(
      `SELECT user_uid FROM meeting_participant WHERE meeting_id = $1 AND left_at IS NULL`,
      String(meetingId)
    ) as any[]
    for (const p of participants) {
      secretary.setSpeakerName(p.user_uid, p.user_uid.slice(0, 6))
    }

    await secretary.start()

    // 保存配置
    await prisma.$queryRawUnsafe(
      `INSERT INTO meeting_ai_config (meeting_id, ai_secretary_enabled, auto_transcribe, auto_minutes, language, created_by)
       VALUES ($1, true, true, true, $2, $3)
       ON CONFLICT (meeting_id) DO UPDATE SET
         ai_secretary_enabled = true,
         auto_transcribe = true,
         auto_minutes = true,
         language = $2,
         updated_at = NOW()`,
      String(meetingId), language || 'auto', userId
    )

    return { success: true, data: { meetingId, status: 'recording', message: 'AI 秘书已启动' } }
  })

  // ── 停止 AI 秘书 ──
  fastify.post('/api/meeting/ai-secretary/stop', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { meetingId } = request.body as any
    if (!meetingId) return reply.status(400).send({ success: false, error: 'meetingId 必填' })

    const userId = (request.user as any)?.id
    const secretary = AiSecretary.get(meetingId)
    if (!secretary) return reply.status(404).send({ success: false, error: 'AI 秘书未启动' })

    await secretary.stop()
    AiSecretary.destroy(meetingId)

    // 自动生成纪要
    const minutes = await secretary.generateMinutes()

    return { success: true, data: { meetingId, status: 'done', minutes } }
  })

  // ── 获取 AI 秘书状态 ──
  fastify.get('/api/meeting/ai-secretary/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { meetingId } = request.query as any
    if (!meetingId) return reply.status(400).send({ success: false, error: 'meetingId 必填' })

    const secretary = AiSecretary.get(meetingId)
    const config = await prisma.$queryRawUnsafe(
      `SELECT * FROM meeting_ai_config WHERE meeting_id = $1`,
      String(meetingId)
    ) as any[]

    return {
      success: true,
      data: {
        active: !!secretary,
        stats: secretary?.getStats() || null,
        config: config[0] || null
      }
    }
  })

  // ── 获取转写记录 ──
  fastify.get('/api/meeting/ai-secretary/transcripts', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { meetingId, limit } = request.query as any
    if (!meetingId) return reply.status(400).send({ success: false, error: 'meetingId 必填' })

    const lim = Math.min(500, Math.max(1, Number(limit || 200)))
    const transcripts = await prisma.$queryRawUnsafe(
      `SELECT * FROM meeting_transcript WHERE meeting_id = $1 ORDER BY sort_order ASC LIMIT $2`,
      String(meetingId), lim
    ) as any[]

    return { success: true, data: { transcripts } }
  })

  // ── 手动添加转写（外部视频音频转写结果）──
  fastify.post('/api/meeting/ai-secretary/transcripts', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { meetingId, content, speakerName, language } = request.body as any
    if (!meetingId || !content) return reply.status(400).send({ success: false, error: 'meetingId 和 content 必填' })

    const userId = (request.user as any)?.id
    const secretary = AiSecretary.get(meetingId)
    if (!secretary) return reply.status(404).send({ success: false, error: 'AI 秘书未启动' })

    await secretary.addExternalTranscript(speakerName || '外部音频', content, language || 'zh')
    return { success: true }
  })

  // ── 获取录音列表 ──
  fastify.get('/api/meeting/ai-secretary/recordings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { meetingId } = request.query as any
    if (!meetingId) return reply.status(400).send({ success: false, error: 'meetingId 必填' })

    const recordings = await prisma.$queryRawUnsafe(
      `SELECT * FROM meeting_recording WHERE meeting_id = $1 ORDER BY created_at DESC`,
      String(meetingId)
    ) as any[]

    return { success: true, data: { recordings } }
  })

  // ── 开始录音（参会者共享屏幕/视频时录下声音）──
  fastify.post('/api/meeting/ai-secretary/recording/start', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { meetingId, recordingType } = request.body as any
    if (!meetingId) return reply.status(400).send({ success: false, error: 'meetingId 必填' })

    const userId = (request.user as any)?.id
    const secretary = AiSecretary.get(meetingId)
    if (!secretary) return reply.status(404).send({ success: false, error: 'AI 秘书未启动' })

    const type = recordingType || 'screen'
    const recordingId = await secretary.createRecording(userId, type)
    return { success: true, data: { recordingId, type } }
  })

  // ── 结束录音 ──
  fastify.post('/api/meeting/ai-secretary/recording/stop', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { recordingId, meetingId } = request.body as any
    if (!recordingId) return reply.status(400).send({ success: false, error: 'recordingId 必填' })

    const secretary = AiSecretary.get(meetingId)
    if (!secretary) return reply.status(404).send({ success: false, error: 'AI 秘书未启动' })

    await secretary.finishRecording(recordingId)
    return { success: true }
  })

  // ── 生成纪要 ──
  fastify.post('/api/meeting/ai-secretary/minutes/generate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { meetingId } = request.body as any
    if (!meetingId) return reply.status(400).send({ success: false, error: 'meetingId 必填' })

    const secretary = AiSecretary.get(meetingId)
    if (!secretary) return reply.status(404).send({ success: false, error: 'AI 秘书未启动' })

    const minutes = await secretary.generateMinutes()
    if (!minutes) return reply.status(400).send({ success: false, error: '无转写内容可生成纪要' })

    return { success: true, data: minutes }
  })

  // ── 获取纪要 ──
  fastify.get('/api/meeting/ai-secretary/minutes', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { meetingId } = request.query as any
    if (!meetingId) return reply.status(400).send({ success: false, error: 'meetingId 必填' })

    const minutes = await prisma.$queryRawUnsafe(
      `SELECT * FROM meeting_minutes WHERE meeting_id = $1`,
      String(meetingId)
    ) as any[]

    return { success: true, data: minutes[0] || null }
  })
}
