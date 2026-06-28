/**
 * model-adapters/tts/volcengine-tts.adapter.ts
 *
 * 火山引擎 TTS 适配器
 *
 * 支持的模型: doubao-tts (豆包TTS)
 * 端点: POST /api/v3/tts
 */

import { ModelAdapter, ModelAdapterInput, ModelAdapterResult } from '../types.js'

const BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3/tts'

export const volcengineTtsAdapter: ModelAdapter = {
  name: 'volcengine-tts',
  supportedModels: ['doubao-tts', 'doubao-tts*'],
  taskTypes: ['tts'],
  provider: 'volcengine',

  async execute(runtime: RuntimePayload, input: ModelAdapterInput): Promise<ModelAdapterResult> {
    const apiKey = runtime.apiKey || ''
    if (!apiKey) throw new Error('火山引擎 API Key 未配置')

    const text = input.text || input.prompt || ''
    const voice = input.voiceId || 'zh_male_deep'
    const speed = input.speed || 1.0
    const format = input.format || 'mp3'
    const model = input.model || 'doubao-tts'

    console.log(`[VolcTTS] voice=${voice}, speed=${speed}`)

    const body = { model, text, voice, speed, format }

    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    })

    if (!res.ok) throw new Error(`火山 TTS 失败 (${res.status}): ${await res.text()}`)

    const data = await res.json()
    return {
      url: data?.data?.audio_url || data?.url || data?.audioUrl || '',
      duration: data?.duration,
      provider: 'volcengine',
    }
  },
}
