/**
 * routes/asr.ts — 语音识别路由
 *
 * POST /api/v1/asr/transcribe — 上传音频文件，返回带时间戳的文本
 *
 * 支持双引擎：
 * 1. 阿里云 DashScope (CosyVoice 语音识别 API) — 主引擎
 * 2. 本地 Mock（开发/降级用）
 */

import { FastifyInstance } from 'fastify'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { createReadStream, existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { resolve, extname } from 'path'
import { toApiResponse } from '../contracts/runtime/toApiResponse.js'

const UPLOAD_DIR = '/root/shipin-cinematic-studio/backend/public/uploads/audio'
const BASE_URL = '/api/v1/uploads/audio'

// 阿里云 DashScope API 配置
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || ''
const DASHSCOPE_ASR_URL = 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription'

// 允许的音频格式
const ALLOWED_AUDIO_TYPES = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac']

export default async function asrRoutes(fastify: FastifyInstance) {

  // POST /api/v1/asr/transcribe — 语音识别
  fastify.post('/api/v1/asr/transcribe', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request.user as any)?.id

    // 接收 multipart 文件上传
    const data = await request.file()
    if (!data) {
      return reply.status(400).send({ error: '请上传音频文件' })
    }

    const ext = extname(data.filename).toLowerCase()
    if (!ALLOWED_AUDIO_TYPES.includes(ext)) {
      return reply.status(400).send({
        error: `不支持的音频格式: ${ext}，支持: ${ALLOWED_AUDIO_TYPES.join(', ')}`,
      })
    }

    // 保存文件
    await mkdir(UPLOAD_DIR, { recursive: true })
    const fileId = randomUUID()
    const fileName = `${fileId}${ext}`
    const filePath = resolve(UPLOAD_DIR, fileName)

    const chunks: Buffer[] = []
    for await (const chunk of data.file) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)
    await writeFile(filePath, buffer)

    try {
      let segments: Array<{ start: number; end: number; text: string }>

      if (DASHSCOPE_API_KEY) {
        segments = await transcribeWithDashScope(filePath, ext)
      } else {
        // 降级到模拟识别（开发调试）
        segments = generateMockTranscription()
      }

      // 记录使用
      if (fastify.prisma) {
        await fastify.prisma.usageLog?.create({
          data: {
            userId,
            type: 'asr',
            inputTokens: Math.ceil(buffer.length / 1000),
            outputTokens: segments.length,
            model: DASHSCOPE_API_KEY ? 'dashscope-asr' : 'mock',
          },
        }).catch(() => {})
      }

      return toApiResponse({
        segments,
        totalSegments: segments.length,
        duration: segments.length > 0 ? segments[segments.length - 1].end : 0,
        language: 'zh',
      })

    } catch (err: any) {
      return reply.status(500).send({ error: `语音识别失败: ${err.message}` })
    } finally {
      // 清理临时文件
      unlink(filePath).catch(() => {})
    }
  })

  // POST /api/v1/asr/transcribe/text — 纯文本模式（不保留文件）
  fastify.post('/api/v1/asr/transcribe/text', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { text, language } = request.body as any

    if (!text || !text.trim()) {
      return reply.status(400).send({ error: 'text is required' })
    }

    // 文本模式：将文本分段模拟为「语音识别结果」
    // 用于快速测试字幕流程
    const sentences = text.trim().split(/[。！？，、；：\n]+/).filter(s => s.trim())
    const segments = sentences.map((sentence: string, i: number) => ({
      start: i * 3,
      end: i * 3 + sentence.length * 0.3,
      text: sentence.trim(),
    }))

    return toApiResponse({ segments, totalSegments: segments.length })
  })

  // GET /api/v1/asr/status — 检查 ASR 引擎状态
  fastify.get('/api/v1/asr/status', async (_request, reply) => {
    return toApiResponse({
      engine: DASHSCOPE_API_KEY ? 'dashscope' : 'mock',
      available: true,
      supportedFormats: ALLOWED_AUDIO_TYPES,
    })
  })
}

/**
 * 调用阿里云 DashScope ASR API
 */
async function transcribeWithDashScope(
  filePath: string,
  ext: string
): Promise<Array<{ start: number; end: number; text: string }>> {
  // 读取音频文件为 Base64
  const fs = await import('fs/promises')
  const audioBuffer = await fs.readFile(filePath)
  const audioBase64 = audioBuffer.toString('base64')

  const mimeMap: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
  }

  const body = JSON.stringify({
    model: 'paraformer-realtime-v2',
    input: {
      audio_file: {
        data: audioBase64,
        mime_type: mimeMap[ext] || 'audio/wav',
      },
    },
    parameters: {
      sample_rate: 16000,
      language: 'zh',
      enable_punctuation_prediction: true,
      enable_voice_detection: true,
    },
  })

  const response = await fetch(DASHSCOPE_ASR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
    },
    body,
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`DashScope ASR error (${response.status}): ${errText}`)
  }

  const result = await response.json() as any

  // 解析返回的段落
  const segments = result?.output?.transcription?.segments || []
  return segments.map((seg: any) => ({
    start: seg.begin || seg.start_time || 0,
    end: seg.end || seg.end_time || (seg.begin || 0) + (seg.duration || 2),
    text: seg.text || seg.transcript || '',
  }))
}

/**
 * 模拟识别结果（用于开发/降级）
 */
function generateMockTranscription(): Array<{ start: number; end: number; text: string }> {
  return [
    { start: 0.3, end: 2.5, text: '风起云涌之间' },
    { start: 2.8, end: 5.6, text: '天地为之变色' },
    { start: 6.0, end: 9.2, text: '英雄踏上了征途' },
    { start: 9.8, end: 13.5, text: '远方的号角已经吹响' },
    { start: 14.0, end: 17.8, text: '这是属于他们的时代' },
    { start: 18.5, end: 22.0, text: '也是我们共同见证的传奇' },
    { start: 23.0, end: 27.5, text: '昆仑镜中映照着万古长河' },
    { start: 28.0, end: 32.0, text: '每一帧画面都是不朽的诗篇' },
  ]
}
