import { loadProviderConfigV2 } from '../../../config/v2.js'
import { decryptKey } from '../../../services/crypto.service.js'

/**
 * ImageAdapter — 旧版适配器，已被 model-adapters/ 替代
 * 保留仅作为备用路径兼容
 */
export class ImageAdapter {
  async execute(userId: string, input: {
    prompt: string
    size?: string
    n?: number
    model?: string
    referenceImage?: string
  }) {
    const cfg = await loadProviderConfigV2(userId)
    const provider = cfg.imageProvider

    return this.call(provider, input, cfg)
  }

  private async call(provider: string, input: any, cfg: any) {
    switch (provider) {
      case 'aliyun': {
        const prevKey = process.env.ALIYUN_API_KEY
        if (cfg.imageApiKey) process.env.ALIYUN_API_KEY = decryptKey(cfg.imageApiKey)
        try {
          const { aliyunImage } = await import('../../../services/aliyun-image.provider.js')
          return await aliyunImage.generate({
            prompt: input.prompt,
            size: input.size,
            n: input.n,
            model: input.model,
            imageUrl: input.referenceImage,
          })
        } finally {
          process.env.ALIYUN_API_KEY = prevKey
        }
      }
      case 'volcengine': {
        const prevKey = process.env.VOLCENGINE_API_KEY
        if (cfg.imageApiKey) process.env.VOLCENGINE_API_KEY = decryptKey(cfg.imageApiKey)
        try {
          const { volcengineImage } = await import('../../../services/volcengine-image.provider.js')
          return await volcengineImage.generate({
            prompt: input.prompt,
            size: input.size,
            n: input.n,
            model: input.model,
            imageUrl: input.referenceImage,
          })
        } finally {
          process.env.VOLCENGINE_API_KEY = prevKey
        }
      }
      default:
        throw new Error(`[ImageAdapter] Unknown provider: ${provider}`)
    }
  }
}
