import { loadProviderConfigV2 } from '../../../config/v2.js'
import { decryptKey } from '../../../services/crypto.service.js'

export interface VideoInput {
  prompt: string
  duration?: number
  model?: string
  imageUrl?: string     // 图生视频参考图
  audioUrl?: string     // 视频配乐
  size?: string
}

export interface VideoOutput {
  videoUrl: string
  taskId?: string
  status?: string
}

/**
 * VideoAdapter — 所有视频生成的唯一入口
 */
export class VideoAdapter {
  async execute(userId: string, input: VideoInput): Promise<VideoOutput> {
    const cfg = await loadProviderConfigV2(userId)
    const provider = cfg.videoProvider

    return this.call(provider, input)
  }

  private async call(provider: string, input: VideoInput): Promise<VideoOutput> {
    switch (provider) {
      case 'aliyun': {
        const prevKey = process.env.ALIYUN_API_KEY
        const { decryptKey } = await import('../../../services/crypto.service.js')
        if (cfg.videoApiKey) process.env.ALIYUN_API_KEY = decryptKey(cfg.videoApiKey)
        try {
          const { aliyunVideo } = await import('../../../services/aliyun-video.provider.js')
          return await aliyunVideo.submit(input)
        } finally {
          process.env.ALIYUN_API_KEY = prevKey
        }
      }
      case 'volcengine': {
        const prevKey = process.env.VOLCENGINE_API_KEY
        const { decryptKey } = await import('../../../services/crypto.service.js')
        if (cfg.videoApiKey) process.env.VOLCENGINE_API_KEY = decryptKey(cfg.videoApiKey)
        try {
          const { volcengineVideo } = await import('../../../services/volcengine-video.provider.js')
          return await volcengineVideo.submit(input)
        } finally {
          process.env.VOLCENGINE_API_KEY = prevKey
        }
      }
      default:
        throw new Error(`[VideoAdapter] Unknown provider: ${provider}`)
    }
  }
}
