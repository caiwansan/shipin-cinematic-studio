/**
 * model-adapters/images/qwen-image.adapter.ts
 *
 * 阿里百炼千问图片系列适配器
 *
 * 支持的模型:
 *   qwen-image-2.0-pro, qwen-image-2.0
 *   qwen-image-max, qwen-image-plus, qwen-image
 *   qwen-image-edit-max, qwen-image-edit-plus, qwen-image-edit
 *
 * 走兼容模式: POST /v1/images/generations
 *   body: { model, prompt, n, size, image(可选), negative_prompt(可选) }
 *
 * 注: 千问图片系列兼容模式在大部分百炼账号上仍可用，
 *     但如果 404 则需要检查阿里云控制台是否开通了该模型
 */

import { ModelAdapter, ModelAdapterInput, ModelAdapterResult } from '../types.js'

const COMPAT_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations'

export const qwenImageAdapter: ModelAdapter = {
  name: 'qwen-image',
  supportedModels: [
    'qwen-image-2.0-pro', 'qwen-image-2.0',
    'qwen-image-max', 'qwen-image-plus', 'qwen-image',
    'qwen-image-edit-max', 'qwen-image-edit-plus', 'qwen-image-edit',
    'qwen-image-2.0-pro-2026-03-03', 'qwen-image-2.0-2026-03-03',
    'qwen-image-max-2025-12-30', 'qwen-image-plus-2026-01-09',
    'qwen-image-edit-plus-2025-12-15', 'qwen-image-edit-plus-2025-10-30',
    'qwen-image*',  // 前缀匹配
  ],
  taskTypes: ['image'],
  provider: 'aliyun',

  async execute(runtime: RuntimePayload, input: ModelAdapterInput): Promise<ModelAdapterResult> {
    const apiKey = runtime.apiKey || ''
    if (!apiKey) throw new Error('阿里百炼 API Key 未配置')

    const model = input.model || ''
    const prompt = input.prompt || ''
    const n = input.n || 1
    const size = input.size || '1024x1024'
    const hasImage = !!(input.imageUrl)  // 有 imageUrl 就当作图生图

    console.log(`[QwenImage] model=${model}, size=${size}, hasImage=${hasImage}`)

    const body: any = { model, prompt, n, size }

    if (input.negativePrompt) body.negative_prompt = input.negativePrompt

    if (hasImage) {
      let imgUrl = input.imageUrl
      if (imgUrl?.startsWith('/')) imgUrl = (process.env.IMAGE_BASE_URL || 'https://shipin.fushtn.com') + imgUrl
      body.image = imgUrl
    }

    const res = await fetch(COMPAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000),
    })

    if (!res.ok) {
      const errText = await res.text()
      // 404 说明兼容模式不可用，给用户明确的提示
      if (res.status === 404) {
        throw new Error(`阿里百炼 ${model} 兼容端点不可用 (404)。请在阿里云百炼控制台确认该模型已开通。`)
      }
      throw new Error(`阿里百炼 ${model} 失败 (${res.status}): ${errText}`)
    }

    const data = await res.json()
    // OpenAI 兼容格式: { data: [{ url: "..." }] }
    if (Array.isArray(data.data) && data.data[0]?.url) {
      return { imageUrl: data.data[0].url, provider: 'aliyun' }
    }

    throw new Error(`阿里百炼 ${model} 响应异常: ${JSON.stringify(data).substring(0, 200)}`)
  },
}
