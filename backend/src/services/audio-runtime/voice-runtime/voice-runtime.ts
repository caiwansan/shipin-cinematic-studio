/**
 * VoiceRuntime — 统一语音合成入口
 * Provider 注册中心，业务层禁止直接调用 Kokoro/Piper/espeak
 * 所有合成请求必须通过 voiceRuntime.synthesize()
 */
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

export class VoiceRuntime {
  private providers: Map<string, VoiceProvider> = new Map()
  private fallbackOrder: string[] = []

  /**
   * 注册 Provider
   */
  register(provider: VoiceProvider): void {
    this.providers.set(provider.name, provider)
    // 后注册的优先级更高（放在数组前面）
    this.fallbackOrder.unshift(provider.name)
  }

  /**
   * 合成单个 segment — 按 fallback 链尝试
   */
  async synthesize(segment: AudioSegment): Promise<AudioChunk> {
    let lastError: Error | null = null

    for (const name of this.fallbackOrder) {
      const provider = this.providers.get(name)!
      try {
        return await provider.synthesize(segment)
      } catch (err: any) {
        lastError = err
        console.warn(`[VoiceRuntime] Provider ${name} failed: ${err.message}, trying next...`)
      }
    }

    throw lastError || new Error('[VoiceRuntime] 所有语音引擎均不可用')
  }

  /**
   * 获取可用引擎列表
   */
  async listAvailable(): Promise<string[]> {
    const available: string[] = []
    for (const [name, provider] of this.providers) {
      if (await provider.isAvailable()) {
        available.push(name)
      }
    }
    return available
  }
}
export const voiceRuntime = new VoiceRuntime()
