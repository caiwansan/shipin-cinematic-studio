/**
 * model-adapters/images/seedream-image.adapter.ts
 *
 * 火山引擎 Seedream 图片适配器 v2
 * （适配 Seedream 5.0 图生图 API）
 *
 * 支持的模型:
 *   doubao-seedream-4-5-251128
 *   doubao-seedream-4-0-250129
 *   doubao-seedream-5-0-260128
 *   doubao-seedream-5-1-260516
 *   doubao-seedream-5-2-260520
 *   doubao-seedream-5-x-pro
 *
 * 端点: POST /api/v3/images/generations
 *
 * 文生图: { model, prompt, size, n, safe_mode: false }
 *   图生图: { model, prompt, image: [url1, url2, ...], size, n, safe_mode: false,
 *              sequential_image_generation: "disabled", response_format: "url", watermark: true }
 *
 * Seedream 5.0 图生图特性:
 *   - image 参数为 URL 数组（直接传 URL，不需转 base64）
 *   - 第一张图为主图（保留主体），后续图为参考特征
 *   - sequential_image_generation: 是否顺序生成（关闭可并行）
 *   - 支持 "2K" / "1920x1920" 等尺寸
 *
 * 注: 火山 Seedream 要求总像素 >= 3,686,400 (≈ 1920×1920)
 */

import { ModelAdapter, ModelAdapterInput, ModelAdapterResult } from '../types.js'
import type { RuntimePayload } from '../../runtime/runtime-payload.js'

const BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'

/** 支持的 Seedream 图片模型 */
const SEEDREAM_MODELS = [
  'doubao-seedream-4-5-251128',
  'doubao-seedream-4-0-250129',
  'doubao-seedream-5-0-260128',
  'doubao-seedream-5-1-260516',
  'doubao-seedream-5-2-260520',
  'doubao-seedream-5-x-pro',
  'doubao-seedream*',   // 前缀 — 覆盖所有 doubao-seedream 变体
  'doubao-image*',      // 前缀 — 覆盖 doubao-image / doubao-image-pro 等
]

/** 最短安全边缘像素数 */
const MIN_PIXEL = 3686400

export const seedreamImageAdapter: ModelAdapter = {
  name: 'seedream-image',
  supportedModels: SEEDREAM_MODELS,
  taskTypes: ['image'],
  provider: 'volcengine',

  async execute(runtime: RuntimePayload, input: ModelAdapterInput): Promise<ModelAdapterResult> {
    const apiKey = runtime.apiKey || ''
    if (!apiKey) throw new Error('火山引擎 API Key 未配置')

    const model = input.model || ''
    const prompt = input.prompt || ''
    const n = Math.max(1, input.n || 1)

    // 尺寸标准化
    const rawSize = input.size || '1920x1920'
    const size = normalizeSize(rawSize)

    // 检查是否有参考图（优先 referenceImages 多张，再退到单张 imageUrl）
    const refImages = input.referenceImages?.filter(Boolean) || []
    const hasImage = refImages.length > 0 || !!(input.imageUrl)

    // 组装请求体
    const body: any = {
      model,
      prompt,
      size,
      n,
      safe_mode: false,          // 关闭安全审核
      response_format: 'url',
      watermark: false,
    }

    // 负面提示词
    if (input.negativePrompt) {
      body.negative_prompt = input.negativePrompt
    }

    // 场景风格参考图（非角色 image 参考，而是加到 prompt 描述场景风格）
    if (input.sceneStyle && !hasImage) {
      body.sceneStyle = input.sceneStyle
    }

    // 参考图片（图生图）— 角色图作为 image 参考（保留角色形象）
    // 注意：只传角色图，场景图不放进 image 数组（避免污染角色特征）
    if (hasImage) {
      body.image = refImages.length > 0 ? refImages : [input.imageUrl]
      body.sequential_image_generation = 'disabled'
    }

    console.log(`[Seedream] model=${model}, size=${size}, hasImage=${hasImage}, refImages=${refImages.length}`)

    const res = await fetch(`${BASE_URL}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000),
    })

    if (!res.ok) {
      const errText = await res.text()
      const errMsg = `火山引擎 ${model} 失败 (${res.status}): ${errText}`

      // 安全审核被拒 → 降级重试
      if (errText.includes('OutputImageSensitiveContentDetected') || errText.includes('InputImageSensitive')) {
        console.warn(`[Seedream] 安全审核拒绝，移除负面词重试`)
        delete body.negative_prompt
        delete body.image  // 降级为文生图
        body.safe_mode = false
        body.prompt = prompt + '，安全无害的正面形象'
        const retryRes = await fetch(`${BASE_URL}/images/generations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(120000),
        })
        if (retryRes.ok) {
          const retryData = await retryRes.json()
          if (retryData.data?.[0]?.url) return { imageUrl: retryData.data[0].url, provider: 'volcengine' }
        }
      }

      throw new Error(errMsg)
    }

    const data = await res.json()
    // 同步响应: { data: [{ url: "...", seed: 123 }] }
    if (data.data?.[0]?.url) {
      return { imageUrl: data.data[0].url, seed: data.data[0].seed, provider: 'volcengine' }
    }
    // 异步任务 (Seedream 4.x 异步)
    if (data.id || data.task_id) {
      return pollSeedreamTask(data.id || data.task_id, apiKey)
    }
    throw new Error(`火山引擎 ${model} 响应异常: ${JSON.stringify(data).substring(0, 200)}`)
  },
}

/** 尺寸标准化：支持 "2K", "1920x1920", "1920*1920" 等各种格式 */
function normalizeSize(size: string): string {
  const s = size.trim().toLowerCase()
  // 命名尺寸
  if (s === '2k') return '2048x2048'
  if (s === '4k') return '4096x4096'
  if (s === 'hd' || s === '720p') return '1280x720'
  if (s === 'fhd' || s === '1080p') return '1920x1080'
  // 解析数字
  const parts = s.split(/[xX×*]/).map(Number).filter(Boolean)
  if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
    let [w, h] = parts
    if (w * h < MIN_PIXEL) {
      const ratio = w / h
      w = Math.round(Math.sqrt(MIN_PIXEL * ratio))
      h = Math.round(MIN_PIXEL / w)
      console.log(`[Seedream] ⏫ 尺寸不足，${size}→${w}x${h}`)
    }
    return `${w}x${h}`
  }
  return '1920x1920'
}

/** 轮询火山引擎异步任务 */
async function pollSeedreamTask(taskId: string, apiKey: string): Promise<ModelAdapterResult> {
  for (let i = 0; i < 120; i++) {
    const res = await fetch(`${BASE_URL}/images/generations/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`火山引擎任务查询失败 (${res.status})`)
    const data = await res.json()
    if (data.status === 'succeeded' || data.data?.[0]?.url) {
      const url = data.data?.[0]?.url || data.url
      if (url) return { imageUrl: url, provider: 'volcengine' }
    }
    if (data.status === 'failed') throw new Error(`火山引擎任务失败: ${data.error || 'Unknown'}`)
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error('火山引擎任务轮询超时')
}
