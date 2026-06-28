import type { ApiResponse } from '../contracts/api/base.js';
/**
 * 音色管理路由（ETFL EDCL: EXECUTION DOMAIN → voice/test 已代理）
 *
 * POST /api/voice/design      — 声音设计（非 execution）
 * POST /api/voice/clone       — 声音复刻（非 execution）
 * GET  /api/voice/presets     — 音色列表（非 execution）
 * DELETE /api/voice/presets/:id — 删除音色（非 execution）
 * POST /api/voice/test        — ETFL: EXECUTION → SEEL 代理
 */

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { voiceService } from '../services/voice-manager.service.js'
import { prisma } from '../utils/index.js'
import { Capability } from '../core/runtime/capabilities.js'
import { convergenceController } from '../core/bridge/phase1/convergence-controller.js'

// 请求校验 schema
const designSchema = z.object({
  description: z.string().min(2, '音色描述至少2个字').max(500),
  targetModel: z.string().default('cosyvoice-v3.5-plus'),
  prefix: z.string().default('designed'),
})

const cloneSchema = z.object({
  audioUrl: z.string().url('音频URL格式不正确'),
  targetModel: z.string().default('cosyvoice-v3.5-plus'),
  prefix: z.string().default('cloned'),
})

const testTtsSchema = z.object({
  text: z.string().min(1).max(500),
  voiceId: z.string().optional(),
  voice: z.string().optional(), // 内置音色
  speed: z.number().min(0.5).max(2).default(1.0),
})

export default async function voiceRoutes(fastify: FastifyInstance) {
  // ── 声音设计：文字描述 → 新音色 ──
  fastify.post('/api/voice/design', async (request, reply) => {
    const result = designSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ success: false, error: result.error.issues })
    }

    try {
      const { description, targetModel, prefix } = result.data
      const { voiceId, voiceName, previewAudio } = await voiceService.designVoice(description, targetModel, prefix)

      // 保存到数据库
      await prisma.voicePreset.create({
        data: {
          name: voiceName,
          voiceId,
          type: 'designed',
          description,
          targetModel,
        },
      })

      return {
        success: true,
        data: { voiceId, voiceName, targetModel, previewAudio },
      }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // ── 声音复刻：音频URL → 复制音色 ──
  fastify.post('/api/voice/clone', async (request, reply) => {
    const result = cloneSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ success: false, error: result.error.issues })
    }

    try {
      const { audioUrl, targetModel, prefix } = result.data
      const { voiceId, voiceName } = await voiceService.cloneVoice(audioUrl, targetModel, prefix)

      // 保存到数据库
      await prisma.voicePreset.create({
        data: {
          name: voiceName,
          voiceId,
          type: 'cloned',
          targetModel,
          sampleUrl: audioUrl,
        },
      })

      return {
        success: true,
        data: { voiceId, voiceName, targetModel },
      }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // ── 音色列表 ──
  fastify.get('/api/voice/presets', async (request, reply) => {
    try {
      const presets = await prisma.voicePreset.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          voiceId: true,
          type: true,
          description: true,
          targetModel: true,
          sampleUrl: true,
          isActive: true,
          createdAt: true,
        },
      })

      return { success: true, data: presets } satisfies ApiResponse<unknown>;

    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // ── 删除音色 ──
  fastify.delete('/api/voice/presets/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      await voiceService.deleteVoice(id)
      return { success: true } satisfies ApiResponse<unknown>;

    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // ── 测试音色（ETFL: EXECUTION → SEEL 代理） ──
  // 禁止直接调用 aliyunTTS / convergenceController
  fastify.post('/api/voice/test', async (request, reply) => {
    const result = testTtsSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ success: false, error: result.error.issues })
    }

    try {
      const { text, voiceId, voice, speed } = result.data

      // ETFL: 通过 /api/tasks/ai-generate 入队执行
      const injectResp = await (reply.request as any).server.inject({
        method: 'POST',
        url: '/api/tasks/ai-generate',
        headers: { authorization: (request.headers as any).authorization || '' },
        payload: JSON.stringify({
          projectId: '__voice_test__',
          taskType: 'tts',
          input: {
            text,
            voiceId: voiceId || voice || 'Aria',
            speed: Number(speed) || 1.0,
            source: 'voice_test',
          },
        }),
      })
      const parsed = JSON.parse(injectResp.body)
      return reply.status(injectResp.statusCode).send(parsed)
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // GET /api/voice/records — 查询项目的 TTS 语音记录
  fastify.get('/api/voice/records', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, characterName } = request.query as any
    if (!projectId) return reply.status(400).send({ success: false, error: 'projectId 必填' })
    try {
      const where: any = { projectId }
      if (characterName) where.characterName = characterName
      const records = await prisma.tTSRecord.findMany({
        where,
        orderBy: [{ characterName: 'asc' }, { sequenceIndex: 'asc' }],
        select: { id: true, characterName: true, voiceId: true, audioUrl: true, duration: true, text: true, createdAt: true },
      })
      return { success: true, data: records } satisfies ApiResponse<unknown>;

    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })
}
