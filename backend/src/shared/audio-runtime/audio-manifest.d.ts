import { AudioSegment } from './audio-segment'
export interface AudioManifest {
  chapterId: string
  segments: AudioSegment[]
}
