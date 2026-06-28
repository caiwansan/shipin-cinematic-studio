/**
 * EspeakProvider — 离线 espeak-ng 语音合成
 * 纯 CPU 推理，1.6 秒可合成 3000 字
 * 兜底引擎，Edge-tts/Kokoro/Piper 不可用时自动降级
 */
import { execSync } from 'child_process'
import { readFileSync, unlinkSync } from 'fs'
import { randomUUID } from 'crypto'
import type { AudioChunk, VoiceProvider } from './provider'

interface AudioSegment {
  id: string
  chapterId: string
  text: string
  speaker: string
  emotion: string
  sequence: number
  estimatedDuration: number
}

export class EspeakProvider implements VoiceProvider {
  readonly name = 'espeak'

  async synthesize(segment: AudioSegment): Promise<AudioChunk> {
    const tmpWav = `/tmp/nar_espeak_${randomUUID().slice(0, 8)}.wav`
    const tmpMp3 = `/tmp/nar_espeak_${randomUUID().slice(0, 8)}.mp3`

    try {
      // 用 espeak-ng 生成 WAV
      execSync(
        `espeak-ng -v cmn -s 160 -p 60 -g 8 -w ${tmpWav} -- "${this.escapeText(segment.text)}"`,
        { timeout: 30000, encoding: 'utf-8' }
      )

      // 转 MP3
      execSync(
        `ffmpeg -y -i ${tmpWav} -b:a 48k ${tmpMp3}`,
        { timeout: 10000 }
      )

      const buffer = readFileSync(tmpMp3)
      const duration = this.estimateDuration(segment.text)

      return { segmentId: segment.id, buffer, duration }
    } finally {
      try { unlinkSync(tmpWav) } catch {}
      try { unlinkSync(tmpMp3) } catch {}
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      execSync('which espeak-ng', { timeout: 3000 })
      return true
    } catch {
      return false
    }
  }

  private escapeText(text: string): string {
    return text.replace(/"/g, '\\"').replace(/[^\u4e00-\u9fff\w\s，。！？、；：""''（）\[\]【】《》\-\.\,\!\?]/g, '')
  }

  private estimateDuration(text: string): number {
    return Math.round(text.length * 0.08 * 100) / 100
  }
}
