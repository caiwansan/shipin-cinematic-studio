/**
 * production-loop/video/volcengine.image.ts — 火山引擎图片 Provider
 *
 * ⚠️ 已重构为 Credential Injection 模式
 *
 * 不再使用 const API_KEY = '' 硬编码
 * 改为通过 setApiKey() 注入运行时凭据
 */

import { registerVideoProvider } from './video-provider.js'

const BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
const IMAGE_MODEL = 'doubao-seedream-4-5-251128'

/** 运行时注入的 API Key */
let _injectedApiKey: string | null = null

/**
 * 由 CredentialService 在运行时注入凭据
 * 在调用 generate() 之前必须调用此函数
 */
export function setVolcImageCredential(credential: { apiKey: string; baseURL?: string }): void {
  _injectedApiKey = credential.apiKey
}

export function clearVolcImageCredential(): void {
  _injectedApiKey = null
}

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
    if (!_injectedApiKey) {
      throw new Error('火山引擎图片生成: API Key 未注入。请先调用 setVolcImageCredential()')
    }

    const apiKey = _injectedApiKey
    const model = options?.model || IMAGE_MODEL
    const size = options?.size || '1920x1920'
    const n = options?.n || 1

    const res = await fetch(`${BASE_URL}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
