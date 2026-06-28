/**
 * model-adapters/images/dalle-image.adapter.ts
 *
 * OpenAI DALL-E 图片适配器
 *
 * 支持的模型:
 *   dall-e-3, dall-e-2, dall-e
 *
 * 端点: POST /v1/images/generations
 * 格式: OpenAI 原生 { model, prompt, n, size, quality, style }
 */

import { ModelAdapter, ModelAdapterInput, ModelAdapterResult } from '../types.js'

const BASE_URL = 'https://api.openai.com/v1/images/generations'

export const dalleImageAdapter: ModelAdapter = {
  name: 'dalle-image',
  supportedModels: ['dall-e-3', 'dall-e-2', 'dall-e', 'dall-e*'],
  taskTypes: ['image'],
  provider: 'openai',

  async execute(runtime: RuntimePayload, input: ModelAdapterInput): Promise<ModelAdapterResult> {
    const apiKey = runtime.apiKey || ''
    if (!apiKey) throw new Error('OpenAI API Key 未配置')

    const model = input.model || 'dall-e-3'
    const prompt = input.prompt || ''
    const n = input.n || 1
    const size = input.size || '1024x1024'

    console.log(`[DALL-E] model=${model}, size=${size}`)

    const body: any = { model, prompt, n, size, response_format: 'url' }
    if (model === 'dall-e-3') {
      body.quality = input.seed ? 'hd' : 'standard'
      body.style = 'vivid'
    }

    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    })

    if (!res.ok) throw new Error(`DALL-E 失败 (${res.status}): ${await res.text()}`)

    const data = await res.json()
    if (data.data?.[0]?.url) {
      return { imageUrl: data.data[0].url, revised_prompt: data.data[0]?.revised_prompt, provider: 'openai' }
    }

    throw new Error(`DALL-E 响应异常: ${JSON.stringify(data).substring(0, 200)}`)
  },
}
