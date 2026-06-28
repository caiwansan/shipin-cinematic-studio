/**
 * services/aliyun-tts.provider.ts — 阿里百炼 TTS Provider
 *
 * 核心原则：
 *   1. 不在顶层持有 API Key（运行时读 process.env，由上层注入）
 *   2. 不硬编码 model/endpoint（model 由用户配置，endpoint 统一）
 *   3. 零 fallback（失败就抛）
 *
 * 支持：
 *   - qwen3-tts-flash（同步，返回 audio URL）
 *   - cosyvoice-v1（异步，返回 audio URL）
 */

interface TTSRequest {
  text: string
  voice?: string
  speed?: number
  format?: string
  model?: string
}

interface TTSResult {
  audioUrl: string
  duration?: number
  format?: string
}

const BASE_URL = 'https://dashscope.aliyuncs.com'

export const aliyunTTS = {
  async synthesize(params: TTSRequest): Promise<TTSResult> {
    const apiKey = process.env.ALIYUN_API_KEY || ''
    if (!apiKey) throw new Error('ALIYUN_API_KEY 未配置')
    if (!params.model) throw new Error('请先在大模型设置中配置 TTS 模型')

    const format = (params.format || 'mp3').toLowerCase()

    // 构建请求体 — 统一用 multimodal-generation 端点
    const body: any = {
      model: params.model,
      input: { text: params.text },
      parameters: { format, sample_rate: 24000 },
    }

    // voice 参数
    if (params.voice) {
      body.input.voice = params.voice
    } else {
      body.input.voice = 'Cherry'  // 默认女声
    }

    // 速度参数
    if (params.speed && params.speed !== 1.0) {
      body.parameters.speed = params.speed
    }

    console.log(`[AliyunTTS] model=${params.model}, voice=${body.input.voice}, textLen=${params.text.length}`)

    const endpoint = `${BASE_URL}/api/v1/services/aigc/multimodal-generation/generation`
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`阿里 TTS 失败 (${res.status}): ${err}`)
    }

    const data = await res.json()
    const audioUrl =
      data.output?.audio?.url ||
      data.output?.audio_url ||
      data.output?.audio?.audio_url ||
      ''

    if (!audioUrl) {
      throw new Error(`阿里 TTS: 响应中没有音频 URL: ${JSON.stringify(data).substring(0, 500)}`)
    }

    return {
      audioUrl,
      duration: data.usage?.characters || 0,
      format,
    }
  },
}
