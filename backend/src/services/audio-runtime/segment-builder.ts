/**
 * Narrative Audio Runtime — SegmentBuilder
 * 将章节文本按语义切分为 AudioSegment[]
 * 
 * 规则：
 * - 优先句号
 * - 其次问号
 * - 其次感叹号
 * - 禁止粗暴按字数截断
 * - 每段 200~400 字符
 */
interface AudioSegment {
  id: string
  chapterId: string
  text: string
  speaker: string
  emotion: string
  sequence: number
  estimatedDuration: number
}

interface SegmentBuilderOptions {
  /** 每段目标字符数，默认 300 */
  targetLength?: number
  /** 最小段落字符数，默认 200 */
  minLength?: number
  /** 最大段落字符数，默认 400 */
  maxLength?: number
  /** 默认 speaker，默认 'narrator' */
  defaultSpeaker?: string
  /** 默认 emotion，默认 'calm' */
  defaultEmotion?: string
}

const DEFAULTS: Required<SegmentBuilderOptions> = {
  targetLength: 300,
  minLength: 200,
  maxLength: 400,
  defaultSpeaker: 'narrator',
  defaultEmotion: 'calm',
}

/**
 * 按语义切分文本，优先标点符号
 */
export class SegmentBuilder {
  private opts: Required<SegmentBuilderOptions>

  constructor(options?: SegmentBuilderOptions) {
    this.opts = { ...DEFAULTS, ...options }
  }

  /**
   * 将章节文本切分为 AudioSegment[]
   */
  build(text: string, chapterId: string): AudioSegment[] {
    if (!text) return []

    // 1. 用句号/问号/感叹号/换行预切
    const rawSplits = this.splitByPunctuation(text)

    // 2. 合并成 targetLength 左右的块
    const merged = this.mergeSplits(rawSplits)

    // 3. 构建 AudioSegment[]
    const segments: AudioSegment[] = []
    let seq = 0
    for (const chunk of merged) {
      segments.push({
        id: `seg_${chapterId.slice(0, 8)}_${String(seq).padStart(4, '0')}`,
        chapterId,
        text: chunk,
        speaker: this.opts.defaultSpeaker,
        emotion: this.opts.defaultEmotion,
        sequence: seq++,
        estimatedDuration: Math.round(chunk.length * 0.08), // ~80ms 每字估算
      })
    }

    return segments
  }

  private splitByPunctuation(text: string): string[] {
    // 用 (?<=[。！？\n]) 正向预查分割，保留分隔符
    const parts = text.split(/(?<=[。！？\n])/).filter(Boolean)
    return parts
  }

  private mergeSplits(parts: string[]): string[] {
    const result: string[] = []
    let buffer = ''

    for (const part of parts) {
      const trimmed = part.trim()
      if (!trimmed) continue

      if (!buffer) {
        buffer = trimmed
        continue
      }

      // 如果 buffer + part 不超过 maxLength，合并
      if (buffer.length + trimmed.length <= this.opts.maxLength) {
        buffer += trimmed
        continue
      }

      // 如果 buffer 已达 minLength 以上，提交
      if (buffer.length >= this.opts.minLength) {
        result.push(buffer)
        buffer = trimmed
        continue
      }

      // buffer 太短但加 part 超 maxLength — 强制合并
      buffer += trimmed
      result.push(buffer)
      buffer = ''
    }

    if (buffer) {
      result.push(buffer)
    }

    return result
  }
}
