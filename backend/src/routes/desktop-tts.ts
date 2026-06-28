/**
 * routes/desktop-tts.ts — Phase 5: 本地语音合成（桌面离线 TTS）
 *
 * 使用 edge-tts (Microsoft Edge TTS) 实现本地语音合成。
 * 特点：跨平台、无需 GPU、中文效果好、音色丰富。
 *
 * API：
 * POST /api/desktop/tts/generate — 生成语音
 * GET  /api/desktop/tts/voices — 获取中文可用音色
 * GET  /api/desktop/tts/status — 检测本地 TTS 引擎是否可用
 */

import { FastifyInstance } from 'fastify'
import { execSync, spawn } from 'child_process'
import { existsSync, mkdirSync, unlinkSync } from 'fs'
import { join, resolve } from 'path'
import { randomUUID } from 'crypto'

const TTS_OUTPUT_DIR = resolve(process.cwd(), 'runtime', 'tts-output')

/** 检查 edge-tts 是否可用 */
function checkEdgeTts(): boolean {
  try {
    execSync('which edge-tts', { encoding: 'utf-8', timeout: 3000 })
    return true
  } catch {
    try {
      execSync('where edge-tts', { encoding: 'utf-8', timeout: 3000 })
      return true
    } catch {
      return false
    }
  }
}

/** 中文音色列表（筛选过的优质中文声音） */
const ZH_VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓（女·推荐）', gender: 'female', style: '温柔亲切' },
  { id: 'zh-CN-YunxiNeural', name: '云希（男·推荐）', gender: 'male', style: '阳光开朗' },
  { id: 'zh-CN-XiaoyiNeural', name: '晓伊（女）', gender: 'female', style: '自然生动' },
  { id: 'zh-CN-YunjianNeural', name: '云健（男）', gender: 'male', style: '沉稳播音' },
  { id: 'zh-CN-XiaohanNeural', name: '晓涵（女）', gender: 'female', style: '温暖柔和' },
  { id: 'zh-CN-YunyangNeural', name: '云杨（男）', gender: 'male', style: '新闻播报' },
  { id: 'zh-CN-XiaomengNeural', name: '晓梦（女）', gender: 'female', style: '活泼可爱' },
  { id: 'zh-CN-YunhaoNeural', name: '云浩（男）', gender: 'male', style: '深沉浑厚' },
  { id: 'zh-CN-XiaochenNeural', name: '晓辰（女）', gender: 'female', style: '知性优雅' },
  { id: 'zh-CN-YunyeNeural', name: '云野（男）', gender: 'male', style: '少年阳光' },
  // 方言 / 多语言
  { id: 'zh-CN-shaanxi-XiaoniNeural', name: '晓妮（陕西方言）', gender: 'female', style: '方言' },
  { id: 'zh-HK-HiuGaaiNeural', name: '晓佳（粤语）', gender: 'female', style: '粤语' },
  { id: 'zh-TW-HsiaoChenNeural', name: '晓臻（台湾国语）', gender: 'female', style: '台湾腔' },
]

export default async function desktopTtsRoutes(fastify: FastifyInstance) {

  // GET /api/desktop/tts/status — 检测本地 TTS 引擎
  fastify.get('/api/desktop/tts/status', async (_request, reply) => {
    const available = checkEdgeTts()
    reply.send({
      available,
      engine: 'edge-tts (Microsoft Edge TTS)',
      zhVoicesCount: ZH_VOICES.length,
      message: available
        ? '本地 TTS 引擎可用，支持中文语音合成'
        : '未安装 edge-tts，请运行: pip3 install edge-tts',
    })
  })

  // GET /api/desktop/tts/voices — 获取中文音色列表
  fastify.get('/api/desktop/tts/voices', async (_request, reply) => {
    reply.send({
      success: true,
      available: checkEdgeTts(),
      voices: ZH_VOICES,
    })
  })

  // POST /api/desktop/tts/generate — 本地合成语音
  fastify.post('/api/desktop/tts/generate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { text, voice = 'zh-CN-XiaoxiaoNeural', rate = '+0%', speed = '+0%' } = request.body as any

    if (!text || !text.trim()) {
      return reply.status(400).send({ success: false, error: '缺少 text' })
    }

    if (!checkEdgeTts()) {
      return reply.status(503).send({ success: false, error: '本地 TTS 引擎不可用' })
    }

    // 确保输出目录存在
    if (!existsSync(TTS_OUTPUT_DIR)) {
      mkdirSync(TTS_OUTPUT_DIR, { recursive: true })
    }

    const fileId = `${randomUUID().replace(/-/g, '')}.mp3`
    const outputPath = join(TTS_OUTPUT_DIR, fileId)

    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('edge-tts', [
          '--voice', voice,
          '--text', text,
          '--rate', rate,
          '--write-media', outputPath,
        ], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 30000,
        })

        let stderr = ''
        proc.stderr.on('data', (data) => { stderr += data.toString() })
        proc.on('close', (code) => {
          if (code === 0 && existsSync(outputPath)) {
            resolve()
          } else {
            reject(new Error(`edge-tts exit code=${code}: ${stderr}`))
          }
        })
        proc.on('error', reject)
      })

      // 返回音频文件
      return reply.sendFile(outputPath)
    } catch (e: any) {
      console.error('[desktop-tts] 合成失败:', e.message)
      reply.status(500).send({ success: false, error: `语音合成失败: ${e.message}` })
    }
  })
}
