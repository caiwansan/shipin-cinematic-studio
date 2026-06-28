/**
 * 混沌珠 — 文字转语音路由（Narrative Audio Runtime 入口）
 * 
 * Provider 优先级（按用户配置动态选择）：
 *   1. AliyunTtsProvider（用户配了 aliyun ttsApiKey）
 *   2. VolcengineTtsProvider（未来扩展）
 *   3. EspeakProvider（兜底离线引擎）
 * 
 * BYOK 铁律：所有 TTS 请求走用户的 API Key，平台不持有任何 Key
 */
import type { FastifyInstance } from 'fastify'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
import { SegmentBuilder } from '../../services/audio-runtime/segment-builder'
import { StreamingAudioRuntime } from '../../services/audio-runtime/streaming-audio-runtime'
import { AudioCacheService } from '../../services/audio-runtime/audio-cache-service'
import { VoiceRuntime } from '../../services/audio-runtime/voice-runtime/voice-runtime'
import { EspeakProvider } from '../../services/audio-runtime/voice-runtime/espeak-provider'
import { AliyunTtsProvider } from '../../services/audio-runtime/voice-runtime/aliyun-tts-provider'

const TTS_DIR = '/www/wwwroot/aigc.fushtn.com/tts'
if (!existsSync(TTS_DIR)) mkdirSync(TTS_DIR, { recursive: true })

const segmentBuilder = new SegmentBuilder()
const cache = new AudioCacheService()

// 按用户缓存的 VoiceRuntime 实例（避免每次重建）
const userRuntimes = new Map<string, VoiceRuntime>()

function log(msg: string) {
  const t = new Date().toISOString().replace('T', ' ').replace('Z', '')
  process.stdout.write(`[NAR] ${t} ${msg}\n`)
}

/**
 * 查询用户 TTS 配置并构建 VoiceRuntime
 */
async function getOrCreateUserRuntime(userId: string): Promise<VoiceRuntime> {
  const existing = userRuntimes.get(userId)
  if (existing) return existing

  const runtime = new VoiceRuntime()

  const { EspeakProvider } = await import('../../services/audio-runtime/index.js')
  runtime.register(new EspeakProvider())

  // 1. 注册 EdgeTtsProvider（默认：晓伊女声，免费无限量）
  // ⚠️ 必须在 Espeak 之后注册（后注册优先级更高）
  try {
    const { EdgeTtsProvider } = await import('../../services/audio-runtime/index.js')
    const edgeProvider = new EdgeTtsProvider('zh-CN-XiaoxiaoNeural', '+0%')
    const available = await edgeProvider.isAvailable()
    if (available) {
      runtime.register(edgeProvider)
      log(`已在用户 ${userId.slice(0, 8)} 注册 EdgeTtsProvider`)
    } else {
      log('Edge TTS 不可用，跳过')
    }
  } catch (err: any) {
    log(`注册 EdgeTtsProvider 失败: ${err.message}`)
  }

  // 3. 如果用户配了 Aliyun TTS API Key，再注册阿里云（优先级最高）
  try {
    const { userModelResolverV2 } = await import('../../services/user-model-resolver-v2.js')
    const { AliyunTtsProvider } = await import('../../services/audio-runtime/voice-runtime/aliyun-tts-provider.js')
    const resolved = await userModelResolverV2.resolveCapabilityProvider('tts', userId)

    if (resolved && resolved.apiKey && resolved.provider === 'aliyun') {
      const provider = new AliyunTtsProvider(
        resolved.apiKey,
        'lingxi',
        resolved.modelName || 'cosyvoice-v3.5-plus',
      )
      runtime.register(provider)
      log(`已在用户 ${userId.slice(0, 8)} 注册 AliyunTtsProvider (model=${resolved.modelName})`)
    }
  } catch (err: any) {
    log(`查询用户 TTS 配置失败: ${err.message}`)
  }

  userRuntimes.set(userId, runtime)
  return runtime
}

/**
 * 清洗文本
 */
function cleanTextForTts(text: string): string {
  return text
    .replace(/\\n/gi, ' ')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^>\s*/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{200D}]/gu, '')
    .replace(/[★☆※➜]/g, '')
    .replace(/^[-_*]{3,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default async function hdzTtsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // POST /api/hdz/tts — 文本转语音（向后兼容旧版前端）
  app.post('/api/hdz/tts', async (request, reply) => {
    const { text } = request.body as any
    const userId = (request.user as any)?.id

    if (!text?.trim()) {
      log(`空文本 (userId=${userId})`)
      return reply.status(400).send({ success: false, error: '缺少 text' })
    }

    const cleanText = cleanTextForTts(text)
    if (!cleanText.trim()) {
      return reply.status(400).send({ success: false, error: '清洗后无有效文字可朗读' })
    }

    if (cleanText.length > 50000) {
      return reply.status(400).send({ success: false, error: '文本过长，最多 50000 字' })
    }

    log(`收到 TTS 请求 userId=${userId?.slice(0, 8)} originalLen=${text.length} cleanLen=${cleanText.length}`)

    try {
      // 按用户获取 VoiceRuntime（动态注册 Provider）
      const runtime = await getOrCreateUserRuntime(userId)

      // 构建 AudioSegment
      const segments = segmentBuilder.build(cleanText, 'hdz_tts')

      log(`拆分为 ${segments.length} 个 AudioSegment，开始合成...`)

      // 逐段合成并合并
      const audioBuffers: Buffer[] = []
      const stream = new StreamingAudioRuntime()

      // 覆盖 stream 内部的 voiceRuntime 引用
      // 用用户的 runtime 逐个合成
      for (const seg of segments) {
        try {
          const chunk = await runtime.synthesize(seg)
          audioBuffers.push(chunk.buffer)
        } catch (err: any) {
          log(`合成错误（继续）: ${err.message}`)
        }
      }

      if (audioBuffers.length === 0) {
        throw new Error('所有语音引擎均无法合成此文本')
      }

      // 合并为完整 MP3
      const merged = Buffer.concat(audioBuffers)
      const hash = createHash('md5').update(cleanText).digest('hex')
      const filename = `${hash}.mp3`
      const publicPath = `${TTS_DIR}/${filename}`

      writeFileSync(publicPath, merged)
      const duration = segments.reduce((s, seg) => s + (seg.estimatedDuration || 0), 0)

      // 查用了哪个 provider
      const available = await runtime.listAvailable()
      log(`合成完成: ${filename} (${merged.length} bytes, ${segments.length} chunks, ${Math.round(duration)}s, providers=${available.join(',')})`)

      return {
        success: true,
        data: {
          url: `/tts/${filename}`,
          originalLength: text.length,
          cleanLength: cleanText.length,
          chunks: segments.length,
          duration: Math.round(duration),
        },
      }
    } catch (err: any) {
      log(`❌ TTS 失败: ${err.message}`)
      return reply.status(500).send({ success: false, error: `TTS 生成失败: ${err.message}` })
    }
  })
}
