/**
 * model-adapters/images/wan-image.adapter.ts
 *
 * 阿里百炼万相系列图片模型适配器
 *
 * 支持的模型:
 *   wan2.7-image-pro  → 多模态端点 (V2)
 *   wan2.7-image      → 多模态端点 (V2)
 *   wan2.6-image      → text2image 原生端点
 *   wan2.6-t2i        → text2image 原生端点
 *   wan2.5-t2i        → text2image 原生端点
 *   wan2.2-t2i        → text2image 原生端点
 *   wanx2.1-t2i       → text2image 原生端点 (legacy)
 *
 * 调用格式差异:
 *   V2 多模态:  POST /api/v1/services/aigc/multimodal-generation/generation
 *     body: { model, input: { prompt }, parameters: { size, n } }
 *   text2image: POST /api/v1/services/aigc/text2image/image-synthesis
 *     body: { model, input: { prompt }, parameters: { size, n } }
 *
 * 注: 兼容模式 (compatible-mode/v1/images/generations) 已废弃，仅支持 qwen-image 系列
 */

import { ModelAdapter, ModelAdapterInput, ModelAdapterResult } from '../types.js'

const V2_ENDPOINT     = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
const TEXT2IMG_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis'
const COMPAT_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations'

/** 阿里百炼 wan2.x 图片模型列表 */
const WAN_IMAGE_MODELS = [
  'wan2.7-image-pro', 'wan2.7-image',
  'wan2.6-image', 'wan2.6-t2i',
  'wan2.5-t2i', 'wan2.5-t2i-preview',
  'wan2.2-t2i-plus', 'wan2.2-t2i-flash',
  'wanx2.1-t2i-plus', 'wanx2.1-t2i-turbo',
]

/** 千问图片模型（走兼容模式） */
const QWEN_IMAGE_MODELS = [
  'qwen-image-2.0-pro', 'qwen-image-2.0',
  'qwen-image-max', 'qwen-image-plus',
  'qwen-image',
]

export const wanImageAdapter: ModelAdapter = {
  name: 'wan-image',
  supportedModels: [
    ...WAN_IMAGE_MODELS.map(m => m),        // 精确匹配
    'wan2.7-image*', 'wan2.6-image*',        // 前缀匹配
    'wan2.5-*', 'wan2.2-*', 'wanx2.1-*',
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
    const hasImage = !!(input.imageUrl)  // 有 imageUrl 就当作图生图（不依赖 mode 字段）

    console.log(`[WanImage] model=${model}, size=${size}, hasImage=${hasImage}`)

    // ---- 判断模型走哪个端点 ----
    const isWanV2 = model.startsWith('wan2.7-image')  // V2 多模态端点
    const isWanV1 = model.startsWith('wan2.6-image') || model.startsWith('wan2.6-t2i') ||
                    model.startsWith('wan2.5-') || model.startsWith('wan2.2-') || model.startsWith('wanx2.1-')

    // ---- 组装 body ----
    if (isWanV2) {
      // wan2.7-image-pro / wan2.7-image → V2 多模态端点
      const body: any = {
        model,
        input: {
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: prompt }]
            }
          ]
        },
        parameters: { size: normalizeSize(size), n }
      }
      if (input.negativePrompt) {
        body.parameters.negative_prompt = input.negativePrompt
      }
      if (hasImage) {
        let imgUrl = input.imageUrl
        if (imgUrl?.startsWith('/')) imgUrl = (process.env.IMAGE_BASE_URL || 'https://shipin.fushtn.com') + imgUrl
        body.input.messages[0].content.push({ type: 'image_url', image_url: { url: imgUrl } })
      }

      console.log(`[WanImage] → V2 端点`)
      const res = await fetch(V2_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180000),
      })
      if (!res.ok) throw new Error(`阿里百炼 ${model} 失败 (${res.status}): ${await res.text()}`)
      return parseV2Response(await res.json())

    } else if (isWanV1) {
      // wan2.6-image / wan2.6-t2i → text2image 原生端点
      const body: any = {
        model,
        input: { prompt },
        parameters: { size: normalizeSize(size), n }
      }
      if (input.negativePrompt) {
        body.parameters.negative_prompt = input.negativePrompt
      }
      if (hasImage) {
        let imgUrl = input.imageUrl
        if (imgUrl?.startsWith('/')) imgUrl = (process.env.IMAGE_BASE_URL || 'https://shipin.fushtn.com') + imgUrl
        body.input.img_url = imgUrl
      }

      console.log(`[WanImage] → text2image 原生端点`)
      const res = await fetch(TEXT2IMG_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180000),
      })
      if (!res.ok) throw new Error(`阿里百炼 ${model} 失败 (${res.status}): ${await res.text()}`)
      return parseV1Response(await res.json(), apiKey)

    } else {
      // qwen-image 系列或其他 → 兼容模式
      const body: any = { model, prompt, n, size: normalizeSize(size) }
      if (input.negativePrompt) body.negative_prompt = input.negativePrompt
      if (hasImage) {
        let imgUrl = input.imageUrl
        if (imgUrl?.startsWith('/')) imgUrl = (process.env.IMAGE_BASE_URL || 'https://shipin.fushtn.com') + imgUrl
        body.image = imgUrl
      }

      console.log(`[WanImage] → 兼容模式端点 (qwen-image 系列)`)
      const res = await fetch(COMPAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180000),
      })
      if (!res.ok) throw new Error(`阿里百炼 ${model} 失败 (${res.status}): ${await res.text()}`)
      return parseCompatResponse(await res.json(), apiKey)
    }
  },
}

/** V2 多模态端点响应解析 */
async function parseV2Response(data: any, _apiKey?: string): Promise<ModelAdapterResult> {
  // 格式: { output: { choices: [{ message: { content: [{ image: "url" }] } }] } }
  const results = data?.output?.choices?.[0]?.message?.content || []
  for (const item of results) {
    if (item.image) return { imageUrl: item.image, provider: 'aliyun' }
  }
  // 异步任务
  if (data?.output?.task_id) {
    return await pollTask(data.output.task_id, _apiKey || '')
  }
  throw new Error(`V2 端点响应异常: ${JSON.stringify(data).substring(0, 200)}`)
}

/** V1 text2image 端点响应解析 */
async function parseV1Response(data: any, apiKey: string): Promise<ModelAdapterResult> {
  // 格式: { output: { results: [{ url: "..." }] } }
  const results = data?.output?.results
  if (results?.length) {
    return { imageUrl: results[0].url || results[0].image_url, provider: 'aliyun' }
  }
  // 异步任务
  if (data?.output?.task_id) {
    return await pollTask(data.output.task_id, apiKey)
  }
  throw new Error(`V1 端点响应异常: ${JSON.stringify(data).substring(0, 200)}`)
}

/** 兼容模式响应解析 */
async function parseCompatResponse(data: any, apiKey: string): Promise<ModelAdapterResult> {
  // OpenAI 兼容格式: { data: [{ url: "..." }] }
  if (Array.isArray(data.data) && data.data[0]?.url) {
    return { imageUrl: data.data[0].url, provider: 'aliyun' }
  }
  // V2 格式
  const results = data?.output?.choices?.[0]?.message?.content || []
  for (const item of results) {
    if (item.image) return { imageUrl: item.image, provider: 'aliyun' }
  }
  // 异步任务
  if (data?.output?.task_id) {
    return await pollTask(data.output.task_id, apiKey)
  }
  throw new Error(`兼容模式响应异常: ${JSON.stringify(data).substring(0, 200)}`)
}

/** 轮询异步任务 */
async function pollTask(taskId: string, apiKey: string): Promise<ModelAdapterResult> {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const res = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`任务查询失败 (${res.status}): ${await res.text()}`)
    const data = await res.json()
    const status = data?.output?.task_status
    if (status === 'SUCCEEDED') {
      const results = data?.output?.results
      if (results?.length) return { imageUrl: results[0].url || results[0].image_url, provider: 'aliyun' }
      throw new Error(`任务完成但无结果: ${JSON.stringify(data)}`)
    }
    if (status === 'FAILED') throw new Error(`任务失败: ${data?.output?.message || JSON.stringify(data).substring(0, 200)}`)
  }
  throw new Error(`任务轮询超时 (90s)`)
}

/** 尺寸标准化 */
function normalizeSize(size: string): string {
  const s = size.replace(/[xX×]/g, '*')
  // wan2.x 系列用 * 分隔，兼容模式用 x 分隔
  return s
}

export { qwenImageAdapter } from './qwen-image.adapter.js'
