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
import { loadProviderConfigV2 } from '../config/v2.js'
import { Capability } from '../core/runtime/capabilities.js'
import { convergenceController } from '../core/bridge/phase1/convergence-controller.js'
import { decryptKey } from '../services/crypto.service.js'

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

  // ── 内置音色列表（从文件系统读取） ──
  fastify.get('/api/voice/builtin-list', async (_request, reply) => {
    try {
      const fs = await import('fs')
      const path = await import('path')
      const voiceDir = path.resolve('public/uploads/voice')
      const files = fs.readdirSync(voiceDir).filter((f: string) => f.endsWith('.mp3'))
      const voices = files.map((f: string) => ({
        id: f.replace('.mp3', ''),
        name: f.replace('.mp3', ''),
        file: f,
        url: `/uploads/voice/${f}`,
      })).sort((a: any, b: any) => a.name.localeCompare(b.name, 'zh'))
      return { success: true, data: voices }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // ── 更新角色音色 ──
  fastify.put('/api/hdz/character/:characterName/voice', async (request, reply) => {
    try {
      const { characterName } = request.params as any
      const body = request.body as any
      const { voiceType, projectId } = body
      if (!voiceType || !projectId) {
        return reply.status(400).send({ success: false, error: '缺少参数' })
      }
      // Update the character's voice type in the project's executionResults and aiCharacterSpecs
      const prismaMod = await import('../../utils/index.js')
      const prisma = prismaMod.prisma

      // Update aiCharacterSpec
      const spec = await prisma.aiCharacterSpec.findFirst({
        where: { projectId, characterName },
      })
      if (spec) {
        await prisma.aiCharacterSpec.update({
          where: { id: spec.id },
          data: { voiceType },
        })
      }

      return { success: true, data: { characterName, voiceType } }
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

  // POST /api/voice/records/save — 保存音色生成记录（持久化，刷新后保留）
  fastify.post('/api/voice/records/save', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const saveSchema = z.object({
      projectId: z.string().uuid(),
      characterName: z.string().min(1),
      audioUrl: z.string().min(1),
      voiceId: z.string().optional().default(''),
      text: z.string().optional().default(''),
      duration: z.number().optional().default(0),
    })
    const result = saveSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ success: false, error: result.error.issues })
    }
    try {
      const { projectId, characterName, audioUrl, voiceId, text, duration } = result.data
      // 删除同角色旧记录，保留最新一条
      await prisma.tTSRecord.deleteMany({
        where: { projectId, characterName },
      })
      const record = await prisma.tTSRecord.create({
        data: { projectId, characterName, voiceId, audioUrl, text, duration },
      })
      // 同步更新 ai_voice_configs 的 audioUrl
      await prisma.aiVoiceConfig.updateMany({
        where: { projectId, characterName },
        data: { audioUrl: audioUrl },
      })
      return { success: true, data: record } satisfies ApiResponse<unknown>;
    } catch (e: any) {
      console.error(`[VoiceRecordsSave] ❌ 失败: ${e.message}`, e.stack?.split('\n').slice(0, 3).join('\n'))
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // POST /api/voice/ai-design — AI 音色设计：根据角色描述创建专属音色（支持 aliyun/volcengine）
  fastify.post('/api/voice/ai-design', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const schema = z.object({
      projectId: z.string().uuid(),
      characterName: z.string().min(1),
      ttsPrompt: z.string().min(5, '音色描述至少5个字').max(500),
      provider: z.enum(['aliyun', 'volcengine']).optional().default('aliyun'),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ success: false, error: result.error.issues })
    }
    try {
      const { projectId, characterName, ttsPrompt, provider } = result.data
      const user = request.user as any
      const userId = user?.id || ''

      // 读取用户配置的 API Key
      const userCfg = await loadProviderConfigV2(userId)

      if (provider === 'volcengine') {
        const volcApiKey = userCfg.ttsApiKey ? decryptKey(userCfg.ttsApiKey) : ''
        if (!volcApiKey) {
          return reply.status(400).send({ success: false, error: '请先在工作台配置 TTS API Key' })
        }

        const engPrefix = characterName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8) || 'voice'
        const { voiceId, voiceName, previewAudio } = await voiceService.designVoiceVolc(
          ttsPrompt, 'doubao-tts', `char_${engPrefix}`, volcApiKey,
        )

        await prisma.$executeRawUnsafe(
          `UPDATE ai_voice_configs SET voice_id = $1, tts_prompt = $2 WHERE "projectId" = $3 AND "characterName" = $4`,
          voiceId, ttsPrompt, projectId, characterName,
        )

        console.log(`[VoiceAIDesign] ✅ [volc] ${characterName} => voiceId=${voiceId}`)
        return { success: true, data: { voiceId, voiceName, previewAudio } }
      }

      // 阿里百炼音色设计（原流程）
      let aliyunKey = userCfg.ttsApiKey || ''
      if (!aliyunKey) {
        return reply.status(400).send({ success: false, error: '请先在工作台左侧底部配置阿里百炼的 API Key' })
      }

      const engPrefix = characterName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8) || 'voice'
      const { voiceId, voiceName, previewAudio } = await voiceService.designVoice(ttsPrompt, 'cosyvoice-v3.5-plus', `char_${engPrefix}`, aliyunKey)

      await prisma.$executeRawUnsafe(
        `UPDATE ai_voice_configs SET voice_id = $1, tts_prompt = $2 WHERE "projectId" = $3 AND "characterName" = $4`,
        voiceId, ttsPrompt, projectId, characterName,
      )

      console.log(`[VoiceAIDesign] ✅ [aliyun] ${characterName} => voiceId=${voiceId}`)
      return { success: true, data: { voiceId, voiceName, previewAudio } }
    } catch (e: any) {
      console.error(`[VoiceAIDesign] ❌ 失败: ${e.message}`, e.stack?.split('\n').slice(0, 3).join('\n'))
      return reply.status(500).send({ success: false, error: `AI音色设计失败: ${e.message}` })
    }
  })
}
