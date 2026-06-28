/**
 * Narrative Audio Runtime — VoiceProvider 接口
 * 所有 TTS 引擎必须实现此接口
 */
export interface AudioSegment {
  id: string
  chapterId: string
  text: string
  speaker: string
  emotion: string
  sequence: number
  estimatedDuration: number
}

export interface AudioChunk {
  segmentId: string
  /** PCM/WAV Buffer (原始音频数据) */
  buffer: Buffer
  /** 音频时长（秒） */
  duration: number
}

export interface VoiceProvider {
  /** 提供商名称 */
  readonly name: string

  /** 合成单个音频段 */
  synthesize(segment: AudioSegment): Promise<AudioChunk>

  /** 检查引擎是否可用 */
  isAvailable(): Promise<boolean>
}
