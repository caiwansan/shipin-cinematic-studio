import { ImageAdapter } from './image/ImageAdapter.js'
import { VideoAdapter } from './video/VideoAdapter.js'
import { TTSAdapter } from './tts/TTSAdapter.js'

type AdapterType = 'image' | 'video' | 'tts'

/**
 * ModelAdapterRegistry — 统一执行入口
 * 所有 provider 调用必须经过此 registry
 */
export class ModelAdapterRegistry {
  static get(type: AdapterType) {
    switch (type) {
      case 'image': return new ImageAdapter()
      case 'video': return new VideoAdapter()
      case 'tts': return new TTSAdapter()
      default:
        throw new Error(`[ModelAdapterRegistry] Unknown type: ${type}`)
    }
  }
}
