/**
 * Narrative Audio Runtime — 章节音频 API
 * 
 * POST /api/audio-runtime/synthesize — 合成并返回整章音频
 * POST /api/audio-runtime/stream — 流式合成（逐段返回）
 * GET  /api/audio-runtime/status — Runtime 状态
 */
import type { FastifyInstance } from 'fastify'
import { SegmentBuilder } from '../../services/audio-runtime/segment-builder'
import { StreamingAudioRuntime } from '../../services/audio-runtime/streaming-audio-runtime'
import { voiceRuntime } from '../../services/audio-runtime/voice-runtime/voice-runtime'
import { AudioCacheService } from '../../services/audio-runtime/audio-cache-service'

const segmentBuilder = new SegmentBuilder()
const streamRuntime = new StreamingAudioRuntime()
const cache = new AudioCacheService()

export default async function audioRuntimeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  /**
   * POST /api/audio-runtime/synthesize
   * 合成章节为完整 MP3（后端合并返回）
   */
  app.post('/api/audio-runtime/synthesize', async (request: any, reply: any) => {
    const { chapterId, text, voice } = request.body as any

    if (!chapterId || !text) {
      return reply.status(400).send({ success: false, error: '缺少 chapterId 或 text' })
    }

    if (text.length > 50000) {
      return reply.status(400).send({ success: false, error: '文本过长，最多 50000 字' })
    }

    const cacheKey = cache.cacheKey(chapterId, voice || 'espeak', 1.0)
    const cached = cache.get(cacheKey)
    if (cached) {
      return reply.status(200)
        .header('Content-Type', 'audio/mpeg')
        .header('X-Cache', 'HIT')
        .send(cached)
    }

    const segments = segmentBuilder.build(text, chapterId)
    const stream = new StreamingAudioRuntime()
    const audioBuffers: Buffer[] = []
    let totalDuration = 0

    await stream.synthesizeStream(
      segments,
      (chunk) => {
        audioBuffers.push(chunk.buffer)
        totalDuration += chunk.duration
      },
      (err) => {
        console.error(`[AudioRuntime] 合成失败: ${err.message}`)
      },
    )

    if (audioBuffers.length === 0) {
      return reply.status(500).send({ success: false, error: '语音合成失败' })
    }

    const merged = Buffer.concat(audioBuffers)
    cache.set(cacheKey, merged)

    return reply.status(200)
      .header('Content-Type', 'audio/mpeg')
      .header('X-Chunks', String(audioBuffers.length))
      .header('X-Duration', String(totalDuration))
      .send(merged)
  })

  /**
   * GET /api/audio-runtime/status
   * Runtime 状态
   */
  app.get('/api/audio-runtime/status', async () => {
    const available = await voiceRuntime.listAvailable()
    return {
      success: true,
      data: {
        providers: available,
        cache: cache.stats(),
      },
    }
  })
}
