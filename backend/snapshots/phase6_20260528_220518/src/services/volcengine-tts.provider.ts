/**
 * Volcengine TTS Provider — 火山引擎语音合成
 *
 * 使用 Ark 语音合成 API（Doubao TTS）。
 * 文档：https://www.volcengine.com/docs/6561/97418
 *
 * 🔥 不持有顶层 API_KEY 常量，从 process.env 读取（由 TTSAdapter 注入）。
 */

interface TTSRequest {
  text: string
  voiceId?: string
  speed?: number
  pitch?: number
  volume?: number
  emotion?: string
  model?: string
}

interface TTSResult {
  audioUrl: string
  duration: number
  format: string
}

const BASE_URL = process.env.VOLCENGINE_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'

function getApiKey(): string {
  return process.env.VOLCENGINE_API_KEY || ''
}

export const volcengineTTS = {
  /**
   * 生成语音 — 返回 Base64 数据 URL
   */
  async synthesize(params: TTSRequest): Promise<TTSResult> {
    const apiKey = getApiKey()
    if (!apiKey) throw new Error('VOLCENGINE_API_KEY 未配置')

    const voiceId = params.voiceId || 'zh_male_deep'
    const speed = params.speed || 1.0
    const pitch = params.pitch || 1.0
    const model = params.model || 'doubao-tts-1'

    console.log(`[VolcTTS] Synthesizing: model=${model}, voice=${voiceId}, text="${params.text.substring(0, 30)}..."`)

    const body: Record<string, any> = {
      model,
      input: {
        text: params.text,
        voice: { voice_type: voiceId, speed, pitch },
      },
      parameters: { format: 'mp3', sample_rate: 24000 },
    }

    const resp = await fetch(`${BASE_URL}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`VolcTTS failed (${resp.status}): ${err}`)
    }

    const contentType = resp.headers.get('content-type') || ''
    if (contentType.includes('audio/') || contentType.includes('octet-stream')) {
      const buffer = Buffer.from(await resp.arrayBuffer())
      const base64 = buffer.toString('base64')
      return { audioUrl: `data:${contentType};base64,${base64}`, duration: params.text.length * 0.3, format: 'mp3' }
    }

    const data = await resp.json()
    if (data.data?.audio_url) {
      return { audioUrl: data.data.audio_url, duration: data.data.duration || params.text.length * 0.3, format: 'mp3' }
    }

    throw new Error(`VolcTTS: unexpected response: ${JSON.stringify(data).substring(0, 100)}`)
  },
}
