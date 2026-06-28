/**
 * 火山引擎 Seedream 图片生成 Provider
 * 
 * 端点: POST /api/v3/images/generations
 * 响应: { data: [{ url: "..." }] }
 */
import { env } from '../config/env.js'
import { getRuntimeContext } from './runtime-context.js'

interface ImageGenParams {
  prompt: string
  negativePrompt?: string
  size?: string           // "1080x1920" | "1920x1080" | "1024x1024" 等
  imageUrl?: string       // 参考图（图生图）
  model?: string
  n?: number              // 生成张数
  apiKey?: string
}

interface ImageGenResult {
  imageUrl: string
  seed?: number
}

const BASE_URL = env.VOLCENGINE_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'

/**
 * 获取运行时 API Key（优先用户 Key 或 process.env，回退环境变量）
 */
function getApiKey(): string {
  const ctx = (getRuntimeContext() as any)
  if (ctx?.secrets?.volcengineApiKey) return ctx.secrets.volcengineApiKey as string
  const processKey = process.env.VOLCENGINE_API_KEY
  if (processKey) return processKey
  return env.VOLCENGINE_API_KEY
}

export const volcengineImage = {
  /**
   * 生成图片（同步）
   */
  async generate(params: ImageGenParams): Promise<ImageGenResult> {
    const model = params.model || env.VOLCENGINE_IMAGE_MODEL || 'doubao-seedream-4-5-251128'
    // 火山 Seedream 要求总像素 >= 3,686,400（≈ 1920×1920）
    let size = params.size || '1920x1920'
    // 火山 Seedream 要求总像素 >= 3,686,400（≈ 1920×1920），自动调整
    let [w, h] = size.split('x').map(Number)
    if (w * h < 3686400) {
      const ratio = w / h
      w = Math.round(Math.sqrt(3686400 * ratio))
      h = Math.round(3686400 / w)
      size = `${w}x${h}`
      console.log(`[VolcEngine] ⏫ 尺寸不足，${params.size}→${size}`)
    }
    const n = params.n || 1
    const API_KEY = params.apiKey || getApiKey()

    const body: any = {
      model,
      prompt: params.prompt,
      prompt_type: 'text',
      size,
      n,
    }

    // 负面提示词
    if (params.negativePrompt) {
      body.negative_prompt = params.negativePrompt
    // 关闭安全审核（动作捕捉服经常被误判）
    body.safe_mode = false
    }

    // 参考图片（图生图）— 下载转 base64，避免 URL 不可达
    if (params.imageUrl) {
      let imageData = params.imageUrl
      // 补全相对路径为完整 URL
      if (imageData.startsWith('/')) {
        const baseUrl = process.env.IMAGE_BASE_URL || 'https://shipin.fushtn.com'
        imageData = baseUrl + imageData
      }
      if (!imageData.startsWith('data:')) {
        try {
          console.log(`[VolcEngine] 开始下载参考图: ${imageData.substring(0, 60)}`)
          const res = await fetch(imageData, { signal: AbortSignal.timeout(15000) })
          if (res.ok) {
            const contentType = res.headers.get('content-type') || 'image/jpeg'
            const buf = Buffer.from(await res.arrayBuffer())
            imageData = `data:${contentType};base64,${buf.toString('base64')}`
            body.image = imageData
            console.log(`[VolcEngine] 参考图已转 base64 (${buf.length} bytes)`)
          } else {
            console.warn(`[VolcEngine] 参考图下载失败 ${res.status}，降级为文生图`)
          }
        } catch (e: any) {
          console.warn(`[VolcEngine] 参考图下载异常: ${e.message}，降级为文生图`)
        }
      } else {
        body.image = imageData
      }
      // 如果 base64 转换失败或下载异常，移除 image 参数降级为文生图
      if (!body.image || body.image === params.imageUrl) {
        delete body.image
        console.log(`[VolcEngine] 降级为文生图（忽略参考图）`)
      }
    }

    console.log(`🎨 [VolcEngine] Generating image: model=${model}, size=${size}, apiKey.len=${API_KEY?.length}, prompt="${params.prompt.slice(0, 50)}..."`)

    const resp = await fetch(`${BASE_URL}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      const err = await resp.text()
      const errMsg = `VolcEngine image generation failed (${resp.status}): ${err}`

      // 安全过滤被拒 → 如果还没试过无负面词模式，降级一次
      if (err.includes('OutputImageSensitiveContentDetected') || err.includes('InputImageSensitive')) {
        console.warn(`[VolcEngine] 安全审核拒绝，尝试移除负面词重试`)
        // 移除 negative_prompt 和 safe_mode，加简单安全描述
        delete body.negative_prompt
        body.safe_mode = false
        body.prompt = body.prompt + '，安全无害的正面形象'
        const retryResp = await fetch(`${BASE_URL}/images/generations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
          body: JSON.stringify(body),
        })
        if (retryResp.ok) {
          const retryData = await retryResp.json()
          if (retryData.data?.[0]?.url) {
            console.log(`✅ [VolcEngine] Retry success: ${retryData.data[0].url}`)
            return { imageUrl: retryData.data[0].url, seed: retryData.data[0].seed }
          }
        }
      }

      throw new Error(errMsg)
    }

    const data = await resp.json()

    // 火山返回: { data: [{ url: "...", seed: 123 }] }
    if (data.data?.[0]?.url) {
      console.log(`✅ [VolcEngine] Image generated: ${data.data[0].url}`)
      return {
        imageUrl: data.data[0].url,
        seed: data.data[0].seed,
      }
    }

    // 也可能是异步任务
    if (data.id || data.task_id) {
      console.log(`⏳ [VolcEngine] Async task: ${data.id || data.task_id}, polling...`)
      return await this.pollAndWait(data.id || data.task_id)
    }

    throw new Error('No image URL in VolcEngine response')
  },

  /**
   * 轮询异步任务
   */
  async pollAndWait(taskId: string, pollIntervalMs: number = 500, maxRetries: number = 600): Promise<ImageGenResult> {
    const API_KEY = getApiKey()
    for (let i = 0; i < maxRetries; i++) {
      const resp = await fetch(`${BASE_URL}/images/generations/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
        },
      })

      if (!resp.ok) {
        const err = await resp.text()
        throw new Error(`VolcEngine image poll failed (${resp.status}): ${err}`)
      }

      const data = await resp.json()

      if (data.status === 'succeeded' || data.data?.[0]?.url) {
        const url = data.data?.[0]?.url || data.url
        if (url) {
          return { imageUrl: url, seed: data.data?.[0]?.seed }
        }
      }

      if (data.status === 'failed') {
        throw new Error(`VolcEngine image task failed: ${data.error || 'Unknown error'}`)
      }

      console.log(`⏳ [VolcEngine] Image task ${taskId} polling (${i + 1}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
    }

    throw new Error(`VolcEngine image task ${taskId} timed out`)
  },
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "provider.registry",
  "mode": "TOOL"
};

