// Volcengine Ark Image Provider (doubao-seedream)
// OpenAI-compatible Image Generation API

import { registerVideoProvider } from './video-provider.js'

// ⚠️ 已禁止 process.env fallback
const API_KEY = ''  // 不再从 process.env 读取
const BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
const IMAGE_MODEL = 'doubao-seedream-4-5-251128'

export interface ImageGenResult {
  url: string
  size: string
  seed?: number
}

export class VolcengineImageProvider {
  name = 'volcengine-image'
  models = [IMAGE_MODEL, 'doubao-seedream-4-5-251128', 'doubao-seedream-4-0-250828']

  async generate(
    prompt: string,
    options?: { size?: string; n?: number; seed?: number; model?: string },
    signal?: AbortSignal,
  ): Promise<ImageGenResult[]> {
    if (!API_KEY) throw new Error('VOLCENGINE_API_KEY not configured')

    const model = options?.model || IMAGE_MODEL
    const size = options?.size || '1920x1920'
    const n = options?.n || 1

    const res = await fetch(`${BASE_URL}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        n,
        size,
        seed: options?.seed,
      }),
      signal,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`火山引擎图片生成失败 ${res.status}: ${text}`)
    }

    const data = await res.json()
    return (data.data || []).map((item: any) => ({
      url: item.url,
      size: item.size || size,
      seed: data.created || options?.seed,
    }))
  }
}

export const volcengineImage = new VolcengineImageProvider()
