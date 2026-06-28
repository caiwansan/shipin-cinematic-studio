import type { AudioSegment } from './audio-segment'

/**
 * Narrative Audio Runtime — AudioManifest
 * 一个章节的完整音频分段清单
 */
export interface AudioManifest {
  chapterId: string
  segments: AudioSegment[]
}
