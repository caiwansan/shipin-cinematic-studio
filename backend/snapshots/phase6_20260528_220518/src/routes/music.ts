// ═══════════════════════════════════════════════════════════════
// routes/music.ts — 歌曲生成路由（DeepSeek歌词 + 多模型音乐生成）
// ═══════════════════════════════════════════════════════════════

import { FastifyInstance } from 'fastify'
import { generateSong, musicRegistry } from '../services/music/registry.js'
import { prisma } from '../utils/index.js'

interface MusicGenParams {
  style: string
  theme: string
  mood?: string
  duration?: number
  /** 模型提供商标识：mureka | suno | music15 | 空=仅歌词 */
  provider?: string
  model?: string
  /** 预设歌词（可选） */
  lyrics?: string
  title?: string
}

export default async function musicRoutes(fastify: FastifyInstance) {
  // POST /api/music/generate — 生成歌曲
  fastify.post('/api/music/generate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { style, theme, mood, duration, provider, model, lyrics, title } = request.body as MusicGenParams

    if (!style || !theme) {
      return reply.status(400).send({ error: 'style（风格）和 theme（主题）是必填的' })
    }

    const userId = (request as any).user.id
    const user = await prisma.user.findUnique({ where: { id: userId } })

    // 扣积分 3积分/秒
    const durationSec = duration || 60
    const cost = durationSec * 3
    if (!user || user.coins < cost) {
      return reply.status(400).send({ error: `积分不足！生成音乐需要 ${cost} 积分，当前 ${user?.coins || 0} 积分` })
    }

    const result = await generateSong({
      style,
      theme,
      mood: mood || '',
      duration: durationSec,
      provider,
      lyrics,
      title,
    })

    if (!result.success) {
      return reply.status(500).send({ error: result.error || '生成失败' })
    }

    // 扣积分 + 记流水
    const costType = provider ? '音乐配乐生成' : '歌词生成'
    await prisma.user.update({ where: { id: userId }, data: { coins: { decrement: cost } } })
    await prisma.coinLog.create({
      data: { userId, amount: -cost, type: 'consume', remark: `${costType}: ${theme} (${style}) 时长${durationSec}秒` },
    })

    return {
      title: result.title,
      style,
      theme,
      mood: mood || '默认',
      duration: durationSec,
      lyrics: {
        raw: result.lyrics,
        sections: result.sections,
      },
      audioUrl: result.audioUrl,
      taskId: result.taskId,
      status: result.status,
      provider: result.provider,
      model: result.model,
      message: result.success
        ? result.audioUrl
          ? '歌曲生成成功！'
          : '歌词已生成！如需配乐请指定 provider（mureka/suno/music15）'
        : result.error,
      coinsLeft: user.coins - cost,
    }
  })

  // GET /api/music/styles — 支持的音乐风格列表
  fastify.get('/api/music/styles', async () => {
    return {
      styles: [
        { id: 'chinese', label: '国风古风', icon: '🏮', desc: '古筝、笛子、中国风旋律' },
        { id: 'pop', label: '流行', icon: '🎤', desc: '现代流行、K-pop风格' },
        { id: 'rnb', label: 'R&B', icon: '🎸', desc: '节奏布鲁斯、灵魂乐' },
        { id: 'electronic', label: '电子', icon: '🔊', desc: '电子合成、舞曲' },
        { id: 'folk', label: '民谣', icon: '🎸', desc: '吉他、口琴、叙事民谣' },
        { id: 'rock', label: '摇滚', icon: '🎸', desc: '电吉他、鼓、摇滚' },
        { id: 'classical', label: '古典', icon: '🎻', desc: '管弦乐、交响、钢琴' },
        { id: 'jazz', label: '爵士', icon: '🎷', desc: '爵士钢琴、萨克斯' },
      ],
    }
  })

  // GET /api/music/providers — 可用的音乐生成提供商列表
  fastify.get('/api/music/providers', async () => {
    return {
      providers: musicRegistry.listWithModels(),
    }
  })

  // GET /api/music/task/:taskId — 查询异步任务状态
  fastify.get('/api/music/task/:taskId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    // 从所有provider轮询
    for (const provider of musicRegistry.list()) {
      if (provider.getTaskStatus) {
        const status = await provider.getTaskStatus(taskId)
        if (status.status !== 'unknown') {
          return status
        }
      }
    }
    return reply.status(404).send({ error: '任务未找到或已过期' })
  })
}
