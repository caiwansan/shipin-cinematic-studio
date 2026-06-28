/**
 * Narrative Audio Runtime — Streaming Audio Runtime
 * 支持边生成边播放的流式音频管道
 * 
 * 流程：
 *   segment → tts → AudioChunk → stream callback
 * 
 * 整章生成完再播放 === 被禁止的旧式架构
 */

import type { AudioChunk, AudioSegment } from './voice-runtime/provider'
import { voiceRuntime } from './voice-runtime/voice-runtime'

export type AudioChunkCallback = (chunk: AudioChunk) => void

export class StreamingAudioRuntime {
  private abortController: AbortController | null = null

  /**
   * 流式合成章节的所有 AudioSegment
   * 每生成一段就调用 onChunk 回调，支持边生成边播放
   */
  async synthesizeStream(
    segments: AudioSegment[],
    onChunk: AudioChunkCallback,
    onError?: (error: Error) => void,
  ): Promise<void> {
    const abort = new AbortController()
    this.abortController = abort

    for (const seg of segments) {
      if (abort.signal.aborted) break

      try {
        const chunk = await voiceRuntime.synthesize(seg)
        if (!abort.signal.aborted) {
          onChunk(chunk)
        }
      } catch (err: any) {
        if (onError) {
          onError(err)
        } else {
          console.error(`[StreamingAudio] Segment ${seg.id} failed:`, err.message)
        }
        // 一个 segment 失败，继续下一个
        continue
      }
    }
  }

  /**
   * 提前开始下一个 segment 的合成（预加载）
   */
  preloadNext(segment: AudioSegment): Promise<AudioChunk> {
    return voiceRuntime.synthesize(segment)
  }

  /**
   * 取消正在进行的合成
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }
}
