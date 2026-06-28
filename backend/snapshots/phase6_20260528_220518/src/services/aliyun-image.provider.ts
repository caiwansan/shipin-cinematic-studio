/**
 * 阿里云百炼 通义万相 图片生成 Provider
 *
 * 统一使用 OpenAI 兼容格式：POST {baseUrl}/images/generations
 * 不对模型名做任何假设，所有模型都走统一格式
 *
 * 文生图: { model, prompt, n, size }
 * 图生图: { model, prompt, image, n, size }
 */

import { env } from '../config/env.js'
import { getRuntimeContext } from './runtime-context.js'

// 阿里百炼支持的尺寸列表（wanx2.1-t2i-turbo 限制 512~1440）
const SUPPORTED_SIZES: string[] = [
  '540*960', '576*1024', '720*1280', '768*1366', '800*800', '1024*1024',
  '1080*1080', '1152*2048', '1280*720', '1440*2560', '1536*1536', '1772*1772',
  '1920*1080', '1920*1920', '2048*2048', '2160*2160', '2400*2400', '2560*1440',
  '2880*2880', '4096*4096',
]

function normalizeSize(size: string): string {
  const normalized = size.replace(/[xX×]/g, '*')
  if (!SUPPORTED_SIZES.includes(normalized)) {
    const ratioMatch = normalized.match(/^(\d+)[:*](\d+)$/)
    if (ratioMatch) {
      const w = parseInt(ratioMatch[1]), h = parseInt(ratioMatch[2])
      if (Math.abs(w/h - 16/9) < 0.01 || Math.abs(w/h - 9/16) < 0.01) {
        const result = Math.abs(w/h - 9/16) < 0.01 ? '720*1280' : '1280*720'
        console.log(`[AliyunImage] 尺寸 ${normalized} → ${result}`)
        return result
      }
      for (const s of [...SUPPORTED_SIZES].reverse()) {
        const [sw, sh] = s.split('*').map(Number)
        if (sw > 1440 || sh > 1440) continue
        if (Math.abs(sw/sh - w/h) < 0.05) {
          console.log(`[AliyunImage] 尺寸 ${normalized} → ${s}`)
          return s
        }
      }
    }
    if (normalized === '1920*1080' || normalized === '1080*1920') return '1280*720'
    if (normalized === '1080*1920' || normalized === '720*1280' || normalized.match(/^\d+\*1[2-9]\d{2,}$/)) return '720*1280'
    console.warn(`[AliyunImage] 尺寸 ${normalized} 不在支持列表中，使用 1024*1024`)
    return '1024*1024'
  }
  return normalized
}

function getApiKey(): string {
  const ctxKey = getRuntimeContext()?.secrets?.aliyunApiKey
  if (ctxKey) return ctxKey
  throw new Error('[RuntimeConstitution] provider 必须通过 RuntimeContext 获取 API Key，禁止 process.env fallback')
}

interface ImageGenParams {
  prompt: string
  negativePrompt?: string
  size?: string
  imageUrl?: string
  model?: string
  n?: number
}

interface ImageGenResult {
  imageUrl: string
  seed?: number
}

const OLD_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis'
const V2_ENDPOINT  = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'

const COMPAT_IMG_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations'

export const aliyunImage = {
  /**
   * 生成图片 — 统一使用 OpenAI 兼容格式
   * POST {baseUrl}/images/generations
   * 不对模型名做任何假设，所有模型走统一格式
   *
   * 文生图: { model, prompt, n, size }
   * 图生图: { model, prompt, image, n, size }
   */
  async generate(params: ImageGenParams): Promise<ImageGenResult> {
    const apiKey = getApiKey()
    if (!apiKey) throw new Error('ALIYUN_API_KEY not configured')
    // 从用户配置读取模型，不硬编码
    const model = params.model || getRuntimeContext()?.secrets?.aliyunImageModel || ''
    const resolvedModel = model || ''
    const n = params.n || 1
    const size = params.size || '1024x1024'

    const body: any = {
      model: resolvedModel,
      prompt: params.prompt,
      n,
      size,
    }

    // 图生图：传入 image
    if (params.imageUrl) {
      let imgUrl = params.imageUrl
      if (imgUrl.startsWith('/')) imgUrl = (process.env.IMAGE_BASE_URL || 'https://shipin.fushtn.com') + imgUrl
      body.image = imgUrl
    }

    // 反向提示词
    if (params.negativePrompt) {
      body.negative_prompt = params.negativePrompt
    }

    console.log(`[AliyunImage] generate: model=${resolvedModel}, size=${size}, hasImage=${!!params.imageUrl}`)

    // endpoint 根据模型名自动选择
    // wan2.x 系列走多模态端点，其余走兼容模式
    const userBaseUrl = getRuntimeContext()?.secrets?.aliyunBaseUrl
    const isWanModel = resolvedModel.startsWith('wan2.')
    const endpoint = userBaseUrl || (isWanModel ? V2_ENDPOINT : COMPAT_IMG_ENDPOINT)

    // wan2.x 系列用原生 API 格式
    if (isWanModel && !userBaseUrl) {
      body.input = { prompt: params.prompt }
      if (body.negative_prompt) {
        body.input.negative_prompt = body.negative_prompt
        delete body.negative_prompt
      }
      body.parameters = { size: body.size, n: body.n }
      delete body['model']
      delete body.prompt
      delete body.size
      delete body.n
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000),
    })
    if (!res.ok) throw new Error(`阿里百炼图片生成失败 (${res.status}): ${await res.text()}`)
    
    const data = await res.json()
    // OpenAI 兼容格式返回: { data: [{ url: "..." }] }
    if (Array.isArray(data.data) && data.data[0]?.url) {
      console.log(`[AliyunImage] 生成成功: ${data.data[0].url?.substring(0, 60)}`)
      return { imageUrl: data.data[0].url }
    }
    // 百炼原生格式（某些模型可能返回）
    const results = data?.output?.choices?.[0]?.message?.content || []
    for (const item of results) {
      if (item.image) {
        console.log(`[AliyunImage] 生成成功 (v2 format)`)
        return { imageUrl: item.image, seed: data.usage?.seed }
      }
    }
    // 异步任务模式
    if (data?.output?.task_id) {
      console.log(`[AliyunImage] 异步任务已提交: ${data.output.task_id}`)
      return await pollTask(data.output.task_id, apiKey)
    }
    throw new Error(`阿里百炼图片生成响应异常: ${JSON.stringify(data).substring(0, 200)}`)
  },
}

/**
 * generateWithImage — 图生图（编辑模式）
 * 使用阿里百炼兼容 OpenAI 格式 images/generations
 */
export async function generateWithImage(params: {
  prompt: string
  imageUrl: string
  negativePrompt?: string
  model?: string
}): Promise<ImageGenResult> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('ALIYUN_API_KEY not configured')

  const model = params.model || ''

  // 使用 OpenAI 兼容格式：POST {baseUrl}/images/generations
  const body: any = {
    model,
    prompt: params.prompt,
    n: 1,
    size: '1024x1024',
  }

  // 图生图：传入 image
  let imageUrl = params.imageUrl
  if (imageUrl.startsWith('/')) imageUrl = (process.env.IMAGE_BASE_URL || 'https://shipin.fushtn.com') + imageUrl
  body.image = imageUrl

  console.log(`[AliyunImage/Edit] model=${model}, image=${imageUrl.substring(0, 60)}...`)

  const COMPAT_ENDPOINT = getRuntimeContext()?.secrets?.aliyunBaseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations'

  const res = await fetch(COMPAT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`阿里百炼图生图失败 (${res.status}): ${errText}`)
  }

  const data = await res.json()
  const imageUrlResult = data?.data?.[0]?.url || data?.output?.choices?.[0]?.message?.content?.[0]?.image

  if (imageUrlResult) {
    console.log(`[AliyunImage/Edit] 生成成功`)
    return { imageUrl: imageUrlResult }
  }

  throw new Error(`阿里百炼图生图响应异常: ${JSON.stringify(data).substring(0, 200)}`)
}

/** 轮询异步任务直到完成 */
async function pollTask(taskId: string, apiKey: string): Promise<ImageGenResult> {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const res = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`阿里百炼任务查询失败 (${res.status}): ${await res.text()}`)
    const data = await res.json()
    const status = data?.output?.task_status
    if (status === 'SUCCEEDED') {
      const results = data?.output?.results
      if (results?.length) return { imageUrl: results[0].url || results[0].image_url || results[0].image, seed: data?.output?.seed }
      throw new Error(`阿里百炼图片任务完成但无结果: ${JSON.stringify(data)}`)
    }
    if (status === 'FAILED') throw new Error(`阿里百炼图片任务失败: ${data?.output?.message || JSON.stringify(data).substring(0, 200)}`)
  }
  throw new Error(`阿里百炼图片任务轮询超时 (90s)`)
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "provider.registry",
  "mode": "TOOL"
};

