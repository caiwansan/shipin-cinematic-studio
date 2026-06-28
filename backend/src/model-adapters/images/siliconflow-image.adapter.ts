/**
 * model-adapters/images/siliconflow-image.adapter.ts
 *
 * 硅基流动图片适配器
 *
 * 支持的模型:
 *   Pro/Qwen (硅基上的 Qwen), Qwen/Qwen2.5-VL,
 *   deepseek-ai/Janus, THUDM/CogView
 *
 * 端点: POST /v1/images/generations
 * 格式: OpenAI 兼容 { model, prompt, n, size, negative_prompt }
 */

import { ModelAdapter, ModelAdapterInput, ModelAdapterResult } from '../types.js'

const BASE_URL = 'https://api.siliconflow.cn/v1/images/generations'

const SUPPORTED_MODELS = [
  // 图片生成列在硅基流动上的后端模型
  'black-forest-labs/FLUX.1-dev',
  'black-forest-labs/FLUX.1-schnell',
  'stabilityai/stable-diffusion-3.5-large',
  'Kwai-Kolors/Kolors-Diffusers',
  'deepseek-ai/Janus-Pro-7B',
  'Pro/FLUX.1-dev',
  'Pro/FLUX.1-schnell',
  'Pro/FLUX*',
  'Pro/stable-diffusion*',
  'FLUX*',
  'stable-diffusion*',
  'Qwen/*',             // 硅基上的 Qwen 系列（Qwen/Qwen-Image, Qwen/Qwen2.5-VL 等）
  'black-forest-labs/*', // 黑森林实验室全系列
  'stabilityai/*',       // Stability AI 全系列
  'deepseek-ai/*',       // DeepSeek 全系列
]

export const siliconflowImageAdapter: ModelAdapter = {
  name: 'siliconflow-image',
  supportedModels: SUPPORTED_MODELS,
  taskTypes: ['image'],
  provider: 'siliconflow',

  async execute(runtime: RuntimePayload, input: ModelAdapterInput): Promise<ModelAdapterResult> {
    const apiKey = runtime.apiKey || ''
    if (!apiKey) throw new Error('硅基流动 API Key 未配置')

    const model = input.model || ''
    const prompt = input.prompt || ''
    const n = input.n || 1
    const size = input.size || '1024x1024'

    console.log(`[SiliconFlowImage] model=${model}, size=${size}`)

    const body: any = { model, prompt, n, size }
    if (input.negativePrompt) body.negative_prompt = input.negativePrompt

    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    })

    if (!res.ok) throw new Error(`硅基流动 ${model} 失败 (${res.status}): ${await res.text()}`)

    const data = await res.json()
    if (data.data?.[0]?.url) {
      return { imageUrl: data.data[0].url, revised_prompt: data.data[0]?.revised_prompt, provider: 'siliconflow' }
    }

    throw new Error(`硅基流动 ${model} 响应异常: ${JSON.stringify(data).substring(0, 200)}`)
  },
}
