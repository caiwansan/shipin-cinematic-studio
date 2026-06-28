import { loadProviderConfigV2 } from '../../../config/v2.js'

export interface TTSInput {
  text: string
  voice?: string
  speed?: number
  model?: string
}

export interface TTSOutput {
  audioUrl?: string
  audioBase64?: string
  format?: string
}

/**
 * TTSAdapter — 所有语音合成的唯一入口
 *
 * 职责：
 *   1. 从 DB 读取用户配置（provider / model / apiKey）
 *   2. 注入 apiKey 到 process.env（供 provider 读取）
 *   3. 调用对应 provider 的 synthesize 方法
 *
 * 不持有任何 Key/模型/端点的默认值。
 * 不 fallback。
 * 严格遵循：user config → provider → API call
 */
export class TTSAdapter {
  async execute(userId: string, input: TTSInput): Promise<TTSOutput> {
    try {
      const cfg = await loadProviderConfigV2(userId)
      const provider = cfg.ttsProvider

      return await this.call(provider, input, cfg)
    } catch (e) {
      // 捕获完整错误栈，方便定位 ctx is not defined
      console.error('[TTSAdapter] 调用失败:', e instanceof Error ? e.stack : e)
      throw e
    }
  }

  private async call(provider: string, input: TTSInput, cfg: any): Promise<TTSOutput> {
    const { decryptKey } = await import('../../../services/crypto.service.js')

    switch (provider) {
      case 'aliyun': {
        const prevKey = process.env.ALIYUN_API_KEY
        let apiKey = ''
        try {
          if (cfg.ttsApiKey) {
            apiKey = decryptKey(cfg.ttsApiKey)
            process.env.ALIYUN_API_KEY = apiKey
          } else {
            apiKey = process.env.ALIYUN_API_KEY || ''
          }
          const { aliyunTtsAdapter } = await import('../../../model-adapters/tts/aliyun-tts.adapter.js')
          const result = await aliyunTtsAdapter.execute(
            { apiKey },
            { text: input.text, voiceId: input.voice, model: input.model || cfg.ttsModel }
          )
          return { audioUrl: result.url, format: 'mp3' }
        } finally {
          process.env.ALIYUN_API_KEY = prevKey
        }
      }
      case 'volcengine': {
        const prevKey = process.env.VOLCENGINE_API_KEY
        try {
          if (cfg.ttsApiKey) process.env.VOLCENGINE_API_KEY = decryptKey(cfg.ttsApiKey)
          const { volcengineTTS } = await import('../../../services/volcengine-tts.provider.js')
          return await volcengineTTS.synthesize({
            text: input.text,
            voiceId: input.voice,
            speed: input.speed,
            model: input.model || cfg.ttsModel,
          })
        } finally {
          process.env.VOLCENGINE_API_KEY = prevKey
        }
      }
      case 'siliconflow': {
        const prevKey = process.env.SILICONFLOW_API_KEY
        try {
          if (cfg.ttsApiKey) process.env.SILICONFLOW_API_KEY = decryptKey(cfg.ttsApiKey)
          const { siliconflowTTS } = await import('../../../services/siliconflow-tts.provider.js')
          return await siliconflowTTS.synthesize({
            text: input.text,
            voice: input.voice,
            speed: input.speed,
            model: input.model || cfg.ttsModel,
          })
        } finally {
          process.env.SILICONFLOW_API_KEY = prevKey
        }
      }
      default:
        throw new Error(`[TTSAdapter] 未知 provider: ${provider}。请先在大模型设置中配置 TTS 供应商。`)
    }
  }
}
