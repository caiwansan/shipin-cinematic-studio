// im-voice-translate.ts — 昆仑茶馆 私聊语音译音（VOICE-XLAT-01，P1）
// 链路：faster-whisper ASR（复用 voice-asr.service，按 messageId 缓存）
//      → DeepSeek 翻译（复用 im.ts 同款 key/调用模式）
//      → edge-tts 合成（复用 tts.service synthesizeSegments）→ 落盘 /uploads/im + MediaObject TTL 登记
//      → VoiceTranslation 表缓存（messageId+tgtLang 幂等）
import { FastifyInstance, FastifyReply } from 'fastify'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { prisma } from '../utils/index.js'
import { transcribeVoice, ASR_AVAILABLE } from '../im/voice-asr.service.js'
import { synthesizeSegments, ttsSupports } from '../services/tts.service.js'
import { SUPPORTED_LANGS, LANG_NAMES } from '../services/interp-langs.js'
import { registerMediaObject, MEDIA_UPLOAD_DIR } from '../im/media-ttl.service.js'

// 仅允许站内语音文件（防 SSRF）
const INTERNAL_AUDIO_RE = /^\/uploads\/im\/[0-9a-zA-Z_.-]+$/

let translateKeyCache: string | null | undefined = undefined
let translateKeyAt = 0
async function getTranslateKey(): Promise<string | null> {
  if (translateKeyCache !== undefined && Date.now() - translateKeyAt < 5 * 60_000) return translateKeyCache
  if (process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY.startsWith('sk-')) {
    translateKeyCache = process.env.DEEPSEEK_API_KEY
  } else {
    try {
      const { decryptKey } = await import('../services/crypto.service.js')
      const row = await prisma.apiKey.findFirst({ where: { keyName: 'deepseek_api_key' } })
      translateKeyCache = row
        ? row.keyValue.startsWith('enc:') || row.keyValue.includes(':')
          ? await decryptKey(row.keyValue)
          : row.keyValue
        : null
      if (!translateKeyCache?.startsWith('sk-')) translateKeyCache = null
    } catch {
      translateKeyCache = null
    }
  }
  translateKeyAt = Date.now()
  return translateKeyCache
}

async function deepseekTranslate(text: string, srcLang: string, tgtLang: string): Promise<string> {
  const key = await getTranslateKey()
  if (!key) throw new Error('翻译服务未配置（DeepSeek key 缺失）')
  const srcName = LANG_NAMES[srcLang] || srcLang || '原文'
  const tgtName = LANG_NAMES[tgtLang] || tgtLang || '译文'
  if (srcLang && tgtLang && srcLang === tgtLang) return text
  const res = await fetch(`${process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_LLM_MODEL || 'deepseek-v4-flash',
      messages: [
        {
          role: 'system',
          content: `你是专业的语音消息翻译引擎。把下面这段${srcName}口语翻译成${tgtName}。只输出译文本身，不加解释、不加引号、不改写原文语气，保留口语化表达。`,
        },
        { role: 'user', content: text },
      ],
      max_tokens: 1000,
      temperature: 0.2,
    }),
  })
  if (!res.ok) throw new Error('翻译服务响应异常 (' + res.status + ')')
  const j = (await res.json()) as any
  const translated = (j?.choices?.[0]?.message?.content || '').trim()
  if (!translated) throw new Error('翻译无结果')
  return translated
}

export default async function voiceTranslateRoutes(fastify: FastifyInstance) {
  // ── 偏好：GET / PUT ──
  fastify.get('/api/im/voice-translate-prefs', { preHandler: [fastify.authenticate] }, async (request: any) => {
    const u = await prisma.user.findUnique({
      where: { id: request.user.id as string },
      select: { voiceTranslatePrefs: true },
    })
    let prefs: any = {}
    try {
      prefs = u?.voiceTranslatePrefs ? JSON.parse(u.voiceTranslatePrefs) : {}
    } catch {
      prefs = {}
    }
    return {
      success: true,
      data: { enabled: !!prefs.enabled, tgtLang: prefs.tgtLang || 'en', myLang: prefs.myLang || 'zh' },
    }
  })

  fastify.put('/api/im/voice-translate-prefs', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const { enabled, tgtLang, myLang } = (request.body as any) || {}
    const tgt = tgtLang || 'en'
    const my = myLang || 'zh'
    if (!SUPPORTED_LANGS.has(tgt)) return reply.status(400).send({ success: false, error: '目标语言不在支持列表' })
    if (!SUPPORTED_LANGS.has(my)) return reply.status(400).send({ success: false, error: '源语言不在支持列表' })
    await prisma.user.update({
      where: { id: request.user.id as string },
      data: { voiceTranslatePrefs: JSON.stringify({ enabled: !!enabled, tgtLang: tgt, myLang: my }) },
    })
    return { success: true, data: { enabled: !!enabled, tgtLang: tgt, myLang: my } }
  })

  // ── 语音译音：POST /api/im/voice-translate ──
  fastify.post('/api/im/voice-translate', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const { messageId, audioUrl, tgtLang, srcLang } = (request.body as any) || {}
    if (!messageId || !audioUrl) return reply.status(400).send({ success: false, error: 'messageId/audioUrl 必填' })
    if (!tgtLang || !SUPPORTED_LANGS.has(tgtLang)) return reply.status(400).send({ success: false, error: '目标语言不在支持列表' })
    if (!INTERNAL_AUDIO_RE.test(String(audioUrl))) return reply.status(400).send({ success: false, error: '仅支持站内语音文件' })
    if (!ASR_AVAILABLE) return reply.status(501).send({ success: false, error: '语音转写未启用' })
    try {
      const userId = request.user.id as string
      const mid = String(messageId)
      // 1) 消息校验：存在 + 私聊(channelType=4) + 调用者是频道成员
      const idx = await prisma.imMessageIndex.findFirst({ where: { OR: [{ messageId: mid }, { clientMsgNo: mid }] } })
      if (!idx) return reply.status(404).send({ success: false, error: '消息不存在或已过期' })
      if (idx.channelType !== 4) return reply.status(400).send({ success: false, error: '语音译音仅支持私聊消息' })
      const member = await prisma.imChannelMember.findFirst({
        where: { channelId: idx.channelId, channelType: 4, uid: userId },
      })
      if (!member) return reply.status(403).send({ success: false, error: '仅私聊双方可译音' })
      // 2) 缓存命中（messageId+tgtLang 幂等）
      const cached = await prisma.voiceTranslation.findUnique({
        where: { messageId_tgtLang: { messageId: mid, tgtLang } },
      })
      if (cached) {
        return {
          success: true,
          data: {
            translatedText: cached.text,
            audioUrl: cached.audioUrl,
            srcLang: cached.srcLang,
            tgtLang,
            ttsAvailable: !!cached.audioUrl,
            expiresAt: cached.expiresAt,
            cached: true,
          },
        }
      }
      // 3) ASR（同 messageId 由 voice-asr 内部缓存，不重复转写）
      const src = srcLang && SUPPORTED_LANGS.has(srcLang) ? srcLang : 'zh'
      const text = await transcribeVoice(mid, String(audioUrl))
      if (!text || text === '（未识别到语音内容）' || !text.trim()) {
        return reply.status(422).send({ success: false, error: '未能识别语音内容' })
      }
      // 4) DeepSeek 翻译
      const translated = await deepseekTranslate(text, src, tgtLang)
      // 5) TTS（无音色语种降级仅文本）
      let audioUrlOut: string | null = null
      let expiresAt: string | null = null
      if (ttsSupports(tgtLang)) {
        try {
          const segs = await synthesizeSegments(translated, tgtLang)
          if (segs.length) {
            const fname = `${mid}.${tgtLang}.mp3`
            const filePath = join(MEDIA_UPLOAD_DIR, fname)
            const buf = Buffer.concat(segs.map((sg) => Buffer.from(sg.audioB64, 'base64')))
            await writeFile(filePath, buf)
            const reg = await registerMediaObject({
              url: '/uploads/im/' + fname,
              filePath,
              mimeType: 'audio/mpeg',
              mediaType: 'audio',
              size: buf.length,
            })
            audioUrlOut = '/uploads/im/' + fname
            expiresAt = reg.expiresAt
          }
        } catch (e) {
          console.warn('[voice-xlat] TTS 失败（降级仅文本）:', (e as Error).message)
        }
      }
      // 6) 缓存入库
      await prisma.voiceTranslation
        .create({
          data: {
            messageId: mid,
            tgtLang,
            srcLang: src,
            text: translated,
            audioUrl: audioUrlOut,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
          },
        })
        .catch((e) => console.warn('[voice-xlat] 缓存写入失败（非致命）:', (e as Error).message))
      return {
        success: true,
        data: { translatedText: translated, audioUrl: audioUrlOut, srcLang: src, tgtLang, ttsAvailable: !!audioUrlOut, expiresAt },
      }
    } catch (e) {
      return reply.status(502).send({ success: false, error: (e as Error).message })
    }
  })
}
