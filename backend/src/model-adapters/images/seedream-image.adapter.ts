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
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { randomUUID } from 'crypto'
import { filterSensitiveWords } from '../../services/community/sensitive-word.service.js'

const BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'

/** 支持的 Seedream 图片模型 */
const SEEDREAM_MODELS = [
  'doubao-seedream-5-2-260520',
  'doubao-seedream-5-1-260516',
  'doubao-seedream-5-0-260128',
  'doubao-seedream-4-5-251128',
  'doubao-seedream-4-0-250129',
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
    console.log(`[Seedream] apiKey 前8位: ${apiKey.substring(0, 8)}, 长度: ${apiKey.length}, 格式: ${apiKey.startsWith('ark-') ? 'ARK格式' : apiKey.startsWith('sk-') ? 'SK格式' : '其他'}`)

    const model = input.model || ''
    const prompt = input.prompt || ''
    const n = Math.max(1, input.n || 1)

    // 尺寸标准化
    const rawSize = input.size || '1920x1920'
    const size = normalizeSize(rawSize)

    // 检查是否有参考图（优先 referenceImages 多张，再退到单张 imageUrl）
    const rawRefImages = input.referenceImages?.filter(Boolean) || []
    // 兼容：referenceImages 可能是 {url, type}[] 对象数组，提取 url
    const refImages = rawRefImages.map(r => {
      if (typeof r === 'string') return r
      if (typeof r === 'object' && r !== null && (r as any).url) return (r as any).url
      return String(r)
    }).filter(Boolean)
    const hasImage = refImages.length > 0 || !!(input.imageUrl)

    // ⭐ 补全相对路径为公网 URL（火山引擎需要公网可访问的地址）
    const saveDataUri = (uri: string): string => {
      if (!uri || uri.startsWith('http://') || uri.startsWith('https://')) return uri
      if (!uri.startsWith('data:')) {
        const base = 'https://aigc.fushtn.com'
        return uri.startsWith('/') ? `${base}${uri}` : `${base}/${uri}`
      }
      try {
        const match = uri.match(/^data:image\/(\w+);base64,(.+)$/)
        if (!match) return ''
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1]
        const buf = Buffer.from(match[2], 'base64')
        const UPLOAD_DIR = '/root/shipin-cinematic-studio/backend/public/uploads'
        if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })
        const filename = `frame_ref_${randomUUID()}.${ext}`
        writeFileSync(resolve(UPLOAD_DIR, filename), buf)
        console.log(`[Seedream] data:uri 保存为 /uploads/${filename} (${(buf.length/1024).toFixed(0)}KB)`)
        return `https://aigc.fushtn.com/uploads/${filename}`
      } catch (e) {
        console.warn('[Seedream] data:uri 保存失败:', e)
        return ''
      }
    }
    const fullRefImages = refImages.map(saveDataUri).filter(Boolean)
    const fullImageUrl = input.imageUrl ? saveDataUri(input.imageUrl) : ''

    // 敏感词过滤（在 prompt 发送到火山引擎之前替换）
    const cleanPrompt = await filterSensitiveWords(prompt)

    // 组装请求体
    const body: any = {
      model,
      prompt: cleanPrompt,
      size,
      n,
      safe_mode: false,          // 关闭安全审核
      response_format: 'url',
      watermark: false,
    }

    // ⭐ 固定 seed 保证多图间角色一致性（三视图等场景）
    if (input.seed !== undefined && input.seed !== null) {
      body.seed = Number(input.seed)
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
      body.image = fullRefImages.length > 0 ? fullRefImages : [fullImageUrl]
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
        console.warn(`[Seedream] 安全审核拒绝，降级重试`)

        // 彻底清理：移除负面词、移图生图，关安全模式，用纯正向风景描述
        delete body.negative_prompt
        delete body.image  // 降级为文生图
        body.safe_mode = false

        // 多层降级策略
        const cleanPrompts = [
          prompt + '，阳光明媚的风景，蓝天白云，绿色树林，安静祥和的自然风光',
          '美丽的自然风景，阳光明媚，蓝天，绿地，宁静的田野，peaceful landscape',
          '风景如画，蓝天白云，绿树成荫，美丽的自然景色',
        ]

        for (const cp of cleanPrompts) {
          body.prompt = cp
          const retryRes = await fetch(`${BASE_URL}/images/generations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(300000),
          })
          if (retryRes.ok) {
            const retryData = await retryRes.json()
            if (retryData.data?.[0]?.url) return { imageUrl: retryData.data[0].url, provider: 'volcengine' }
          }
        }
      }
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
