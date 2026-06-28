/**
 * Edge TTS Provider
 *
 * 使用微软 Edge 浏览器的免费 TTS 服务
 * - 无需 API Key
 * - 无限免费额度
 * - 中文真人音色（8 种）
 * - 非大模型调用
 *
 * 默认音色：zh-CN-XiaoxiaoNeural（亲切温柔女声，适合小说旁白）
 *
 * 可用中文音色：
 *   - xiaoxiao / 龙婉 / 灵希 / 龙悦 → zh-CN-XiaoxiaoNeural（温柔女声）
 *   - xiaoyi                        → zh-CN-XiaoyiNeural（活泼女声）
 *   - yunxi                         → zh-CN-YunxiNeural（阳光男声）
 *   - yunyang / 龙刚 / 龙飞         → zh-CN-YunyangNeural（沉稳男声）
 *   - yunjian / 龙侠                → zh-CN-YunjianNeural（激情男声）
 *   - yunxia / 环儿                 → zh-CN-YunxiaNeural（可爱男童声）
 */
import { execSync, spawn } from 'child_process'
import { readFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { mkdtempSync } from 'fs'
import type { VoiceProvider, AudioChunk, AudioSegment } from './provider'

/** 短剧音色名 → Edge TTS 音色名 */
const VOICE_MAP: Record<string, string> = {
  'xiaoxiao': 'zh-CN-XiaoxiaoNeural',
  'xiaoyi': 'zh-CN-XiaoyiNeural',
  'yunjian': 'zh-CN-YunjianNeural',
  'yunxi': 'zh-CN-YunxiNeural',
  'yunxia': 'zh-CN-YunxiaNeural',
  'yunyang': 'zh-CN-YunyangNeural',
  'xiaobei': 'zh-CN-liaoning-XiaobeiNeural',
  'xiaoni': 'zh-CN-shaanxi-XiaoniNeural',
  // 短剧音色名 → 映射到最近氛围的音色
  'longwan': 'zh-CN-XiaoxiaoNeural',
  'lingxi': 'zh-CN-XiaoxiaoNeural',
  'longyue': 'zh-CN-XiaoxiaoNeural',
  'longying': 'zh-CN-XiaoxiaoNeural',
  'longchu': 'zh-CN-XiaoxiaoNeural',
  'longlan': 'zh-CN-XiaoxiaoNeural',
  'longfeifei': 'zh-CN-XiaoyiNeural',
  'longfei': 'zh-CN-YunyangNeural',
  'longgang': 'zh-CN-YunyangNeural',
  'longdali': 'zh-CN-YunjianNeural',
  'longxia': 'zh-CN-YunjianNeural',
  'huaner': 'zh-CN-YunxiaNeural',
  'longchen': 'zh-CN-YunyangNeural',
  'longsheng': 'zh-CN-YunyangNeural',
  'longshou': 'zh-CN-YunyangNeural',
}

export class EdgeTtsProvider implements VoiceProvider {
  name = 'edge-tts'
  private defaultVoice: string
  private defaultRate: string
  private tmpDir: string

  constructor(defaultVoice = 'zh-CN-XiaoxiaoNeural', defaultRate = '+0%') {
    this.defaultVoice = defaultVoice
    this.defaultRate = defaultRate
    this.tmpDir = '/tmp/edge-tts'
    if (!existsSync(this.tmpDir)) {
      import('fs').then(m => m.mkdirSync(this.tmpDir, { recursive: true }))
    }
  }

  async synthesize(segment: AudioSegment): Promise<AudioChunk> {
    const text = segment.text
    if (!text || text.trim().length === 0) {
      throw new Error('[EdgeTts] 文本为空')
    }

    const voice = this._resolveVoice(segment.speaker || this.defaultVoice)
    const uuid = randomUUID().replace(/-/g, '')
    const outPath = join(this.tmpDir, `${uuid}.mp3`)

    try {
      await this._runEdgeTts(text, voice, this.defaultRate, outPath)

      const buffer = readFileSync(outPath)
      if (buffer.length === 0) {
        throw new Error('[EdgeTts] 生成的音频为空')
      }

      const duration = Math.round(text.length * 0.065 * 10) / 10

      // 清理临时文件
      try { unlinkSync(outPath) } catch {}

      return {
        segmentId: segment.id,
        buffer,
        duration,
      }
    } catch (err: any) {
      try { if (existsSync(outPath)) unlinkSync(outPath) } catch {}
      throw new Error(`[EdgeTts] 合成失败: ${err.message}`)
    }
  }

  private _resolveVoice(input: string): string {
    const lower = input.toLowerCase()
    if (VOICE_MAP[lower]) return VOICE_MAP[lower]
    // 直接传了完整语音名（如 zh-CN-XiaoxiaoNeural）
    if (input.startsWith('zh-') || input.startsWith('en-') || input.startsWith('ja-') || input.startsWith('ko-')) {
      return input
    }
    return this.defaultVoice
  }

  private _runEdgeTts(text: string, voice: string, rate: string, outPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn('edge-tts', [
        '--voice', voice,
        '--rate', rate,
        '--write-media', outPath,
        '--text', text,
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30000,
      })

      let stderr = ''
      child.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })

      child.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`edge-tts exit=${code}: ${stderr.slice(0, 200)}`))
        }
      })

      child.on('error', (err) => {
        reject(new Error(`edge-tts 启动失败: ${err.message}`))
      })
    })
  }

  async isAvailable(): Promise<boolean> {
    try {
      execSync('which edge-tts', { stdio: 'pipe', timeout: 5000 })
      return true
    } catch {
      return false
    }
  }
}
