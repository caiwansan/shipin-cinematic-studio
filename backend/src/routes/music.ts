// routes/music.ts — 音乐生成 API 路由
// 基于 backend/src/services/music/* 模块的 HTTP 封装
// 歌词通过 昆仑镜统一 AI 网关（unifiedAIGateway）调用国内大模型生成
// 词曲合成需要配置 Suno/Mureka/Music1.5 等音频提供商

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { musicRegistry, generateSong } from '../services/music/registry.js'
import type { MusicGenerationRequest } from '../services/music/types.js'

// 请求校验（前端 MusicGenerationWorkspace 对接）
const generateSchema = z.object({
  style: z.string().min(1, '请选择音乐风格'),
  mood: z.string().optional(),
  duration: z.number().min(15).max(300).default(60),
  bpm: z.number().min(40).max(200).optional(),
  instruments: z.array(z.string()).optional(),
  prompt: z.string().min(1, '请输入歌曲描述').max(2000),
  title: z.string().optional(),
  lyrics: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  onlyLyrics: z.boolean().optional(),
})

export default async function musicRoutes(fastify: FastifyInstance) {
  // ── 获取可用提供商及模型列表 ──
  fastify.get('/api/music/providers', async (_request, _reply) => {
    return {
      success: true,
      data: musicRegistry.listWithModels(),
    }
  })

  // ── 生成音乐／歌词（需认证，走用户 LLM 配置） ──
  fastify.post('/api/music/generate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const result = generateSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: '参数校验失败',
        details: result.error.issues,
      })
    }

    const params = result.data

    // 从 JWT 或 session 中提取 userId / projectId
    const userPayload = (request as any).user || {}
    const userId = userPayload.id || userPayload.userId || 'anonymous'
    const projectId = userPayload.projectId || 'music'

    try {
      const musicReq: MusicGenerationRequest = {
        style: params.style,
        theme: params.prompt,
        mood: params.mood,
        title: params.title,
        lyrics: params.lyrics,
        duration: params.duration,
        lyricsOnly: params.onlyLyrics || false,
      }

      // 昆仑镜统一 AI 网关自动调用国内大模型（DeepSeek/通义千问等）
      // 音频需配置 Suno/Mureka/Music1.5 API Key
      const genResult = await generateSong({
        ...musicReq,
        provider: params.provider,
        userId,
        projectId,
      })

      if (!genResult.success) {
        console.error('[Music] generateSong failed:', genResult.error)
        return reply.status(500).send(genResult)
      }

      return reply.send({
        success: true,
        data: genResult,
      })
    } catch (e: any) {
      console.error('[Music] generateSong exception:', e.message, e.stack?.slice(0, 300))
      return reply.status(500).send({
        success: false,
        error: `音乐生成失败: ${e.message}`,
      })
    }
  })

  // ── 查询生成任务状态（异步任务时使用） ──
  fastify.post('/api/music/task/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    const body = request.body as { provider?: string } || {}
    const providerName = body.provider || 'suno'

    const provider = musicRegistry.get(providerName)
    if (!provider || !provider.getTaskStatus) {
      return reply.status(400).send({
        success: false,
        error: `提供商 ${providerName} 不支持任务查询`,
      })
    }

    const status = await provider.getTaskStatus(taskId)
    return reply.send({ success: true, data: status })
  })

  // ── 风格列表 ──
  fastify.get('/api/music/styles', async () => {
    const styles = [
      { id: 'epic', name: '史诗', icon: '🏛️' },
      { id: 'chinese-classical', name: '古风', icon: '🏮' },
      { id: 'cinematic', name: '电影感', icon: '🎬' },
      { id: 'electronic', name: '电子', icon: '⚡' },
      { id: 'jazz', name: '爵士', icon: '🎷' },
      { id: 'ambient', name: '氛围', icon: '🌊' },
      { id: 'pop', name: '流行', icon: '🎤' },
      { id: 'rock', name: '摇滚', icon: '🎸' },
      { id: 'orchestral', name: '管弦乐', icon: '🎻' },
      { id: 'lofi', name: 'Lo-Fi', icon: '☕' },
    ]
    return { success: true, data: styles }
  })
}
