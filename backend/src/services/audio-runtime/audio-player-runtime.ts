/**
 * Narrative Audio Runtime — AudioPlayerRuntime
 * 播放器核心状态机，禁止使用多个 boolean 状态
 * 
 * 状态迁移：
 *   IDLE → BUFFERING → PLAYING → PAUSED → PLAYING → ENDED
 *   IDLE → BUFFERING → PLAYING → ERROR → IDLE
 *   PLAYING → ENDED → IDLE
 */
import type { AudioChunk, AudioSegment } from './voice-runtime/provider'
import { StreamingAudioRuntime } from './streaming-audio-runtime'
import { AudioCacheService } from './audio-cache-service'
import { voiceRuntime } from './voice-runtime/voice-runtime'

export enum PlayerState {
  IDLE = 'IDLE',
  BUFFERING = 'BUFFERING',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  ENDED = 'ENDED',
  ERROR = 'ERROR',
}

export interface PlayerStateChange {
  from: PlayerState
  to: PlayerState
}

export interface PlayerOptions {
  voiceId?: string
  speed?: number
  autoNext?: boolean
  onStateChange?: (change: PlayerStateChange) => void
  onProgress?: (segmentId: string, progress: number) => void
  onError?: (error: Error) => void
}

/**
 * 播放器音频段缓冲区（前端使用）
 * 后端返回 MP3 Buffer 后由前端的 HTMLAudioElement 播放
 */
export interface PlayerChunk {
  segmentId: string
  /** Base64 音频数据 */
  data: string
  duration: number
}

export class AudioPlayerRuntime {
  private state: PlayerState = PlayerState.IDLE
  private segments: AudioSegment[] = []
  private currentIndex = 0
  private chunkQueue: AudioChunk[] = []
  private stream: StreamingAudioRuntime
  private cache: AudioCacheService
  private opts: Required<PlayerOptions>
  private preloadPromises: Promise<void>[] = []

  constructor(options?: PlayerOptions) {
    this.stream = new StreamingAudioRuntime()
    this.cache = new AudioCacheService()
    this.opts = {
      voiceId: options?.voiceId || 'zh-CN-XiaoxiaoNeural',
      speed: options?.speed || 1.0,
      autoNext: options?.autoNext ?? true,
      onStateChange: options?.onStateChange || (() => {}),
      onProgress: options?.onProgress || (() => {}),
      onError: options?.onError || (() => {}),
    }
  }

  get currentState(): PlayerState {
    return this.state
  }

  /**
   * 加载章节并开始播放
   */
  async load(segments: AudioSegment[], startIndex = 0): Promise<void> {
    this.segments = segments
    this.currentIndex = startIndex
    this.chunkQueue = []

    this.transition(PlayerState.BUFFERING)
    await this.streamNext()

    if (this.chunkQueue.length > 0) {
      this.transition(PlayerState.PLAYING)
      // 预加载下一段
      this.preloadNext()
    } else {
      this.transition(PlayerState.ERROR)
      this.opts.onError(new Error('无可用音频段'))
    }
  }

  pause(): void {
    if (this.state === PlayerState.PLAYING) {
      this.transition(PlayerState.PAUSED)
      this.stream.abort()
    }
  }

  resume(): void {
    if (this.state === PlayerState.PAUSED) {
      this.transition(PlayerState.PLAYING)
    }
  }

  seek(index: number): void {
    if (index < 0 || index >= this.segments.length) return
    this.currentIndex = index
    this.chunkQueue = []
    this.stream.abort()
    this.load(this.segments, this.currentIndex)
  }

  next(): void {
    if (this.currentIndex < this.segments.length - 1) {
      this.currentIndex++
      this.chunkQueue = []
      this.load(this.segments, this.currentIndex)
    } else {
      this.transition(PlayerState.ENDED)
    }
  }

  /**
   * 弹出队列中的下一个音频块（前端轮询调用）
   */
  dequeue(): PlayerChunk | null {
    if (this.state === PlayerState.PAUSED) {
      return null
    }
    const chunk = this.chunkQueue.shift()
    if (!chunk) return null
    this.opts.onProgress(chunk.segmentId, this.currentIndex / this.segments.length)
    return {
      segmentId: chunk.segmentId,
      data: chunk.buffer.toString('base64'),
      duration: chunk.duration,
    }
  }

  /**
   * 播放完毕后调用
   */
  onEnded(): void {
    if (this.opts.autoNext) {
      this.next()
    } else {
      this.transition(PlayerState.ENDED)
    }
  }

  destroy(): void {
    this.stream.abort()
    this.segments = []
    this.chunkQueue = []
    this.state = PlayerState.IDLE
  }

  private async streamNext(): Promise<void> {
    const remaining = this.segments.slice(this.currentIndex)

    await this.stream.synthesizeStream(
      remaining,
      (chunk: AudioChunk) => {
        this.chunkQueue.push(chunk)
      },
      (err) => {
        this.transition(PlayerState.ERROR)
        this.opts.onError(err)
      },
    )
  }

  private preloadNext(): void {
    if (this.currentIndex + 1 < this.segments.length) {
      const nextSeg = this.segments[this.currentIndex + 1]
      const cacheKey = this.cache.cacheKey(nextSeg.chapterId, this.opts.voiceId, this.opts.speed)
      const cached = this.cache.get(cacheKey)
      if (!cached) {
        const p = voiceRuntime.synthesize(nextSeg).then((chunk: AudioChunk) => {
          this.cache.set(cacheKey, chunk.buffer)
        })
        this.preloadPromises.push(p)
      }
    }
  }

  private transition(to: PlayerState): void {
    const from = this.state
    this.state = to
    this.opts.onStateChange({ from, to })
  }
}

// 避免循环依赖
