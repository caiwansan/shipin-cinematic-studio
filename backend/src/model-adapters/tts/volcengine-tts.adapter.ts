/**
 * model-adapters/tts/volcengine-tts.adapter.ts
 *
 * 火山引擎 TTS 适配器
 *
 * 端点: POST /api/v3/tts
 * 认证: X-Api-Key + X-Api-Resource-Id (非 Bearer token)
 * 模型: seed-tts-2.0 (豆包语音大模型)
 *
 * API 文档: https://www.volcengine.com/docs/6561/1307471
 * 音色设计: https://www.volcengine.com/docs/6561/2277844
 *
 * 火山引擎 TTS 认证方式比较特殊：
 * - Authorization: Bearer <ark-api-key> — ARK 平台标准认证（需先发布 endpoint）
 * - X-Api-Key + X-Api-Resource-Id — 豆包语音直调认证（无需先发布 endpoint）
 *
 * 当前适配器实现兼容两种方式：
 * 1. 如果 runtime.apiKey 以 "Bearer " 开头，用 Authorization: Bearer
 * 2. 否则用 X-Api-Key 认证，同时从 runtime.baseURL 提取 Resource-Id
 */

import { ModelAdapter, ModelAdapterInput, ModelAdapterResult } from '../types.js'
import type { RuntimePayload } from '../../runtime/runtime-payload.js'

const BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3/tts'

export const volcengineTtsAdapter: ModelAdapter = {
  name: 'volcengine-tts',
  supportedModels: ['doubao-tts', 'doubao-tts*', 'seed-tts-2.0'],
  taskTypes: ['tts'],
  provider: 'volcengine',

  async execute(runtime: RuntimePayload, input: ModelAdapterInput): Promise<ModelAdapterResult> {
    const rawKey = runtime.apiKey || ''
    if (!rawKey) {
      console.error(`[VolcTTS] ❌ API Key 为空`)
      throw new Error('火山引擎 API Key 未配置')
    }

    const text = input.text || input.prompt || ''
    const voice = input.voiceId || 'zh_male_deep'
    const speed = input.speed || 1.0
    const format = input.format || 'mp3'
    const model = input.model || 'seed-tts-2.0'

    console.log(`[VolcTTS] model=${model}, voice=${voice}, speed=${speed}, apiKey=${rawKey.substring(0, 12)}..., url=${BASE_URL}`)

    const body: Record<string, any> = { model, text, voice, speed, format }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }

    // 兼容两种认证方式
    if (rawKey.startsWith('Bearer ')) {
      // ARK 标准 Bearer 认证
      headers['Authorization'] = rawKey
    } else {
      // X-Api-Key 认证（豆包语音直调，推荐）
      headers['X-Api-Key'] = rawKey
      headers['X-Api-Resource-Id'] = input.model || model
    }

    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '(empty)')
      throw new Error(`火山 TTS 失败 (${res.status}): ${errBody.length > 500 ? errBody.slice(0, 500) : errBody}`)
    }

    const data = await res.json()
    return {
      url: data?.data?.audio_url || data?.url || data?.audioUrl || '',
      duration: data?.duration,
      provider: 'volcengine',
    }
  },
}
