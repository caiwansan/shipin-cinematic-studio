/**
 * 阿里云百炼 通义万相 视频生成 Provider
 *
 * API: POST https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis
 * 文档: https://help.aliyun.com/zh/model-studio/text-to-video-api-reference
 *
 * 异步模式：创建任务 → 轮询结果
 *
 * 关于 body 组装：
 *   不同视频模型格式不同（wan2.7-i2v vs wan2.6 vs wan2.7-r2v）
 *   body 组装逻辑统一在 providerMiddleware.buildVideoBody() 中
 *   此 provider 不再关心模型格式，只负责 fetch + poll
 */

import { env } from '../config/env.js'
import { getRuntimeContext } from './runtime-context.js'
import { providerMiddleware } from '../runtime/provider-middleware.js'

// 获取当前有效的 API Key（优先从 RuntimeContext 获取）
function getApiKey(): string {
  const fromCtx = getRuntimeContext()?.secrets?.aliyunApiKey
  const fromEnv = process.env['阿里百炼 API Key']
  // 调试日志：看看实际用的是哪个 Key
  if (fromCtx) console.log(`[getApiKey] using context key, prefix=${fromCtx.substring(0, 8)}, len=${fromCtx.length}`)
  else if (fromEnv) console.log(`[getApiKey] using env key, prefix=${fromEnv.substring(0, 8)}, len=${fromEnv.length}`)
  else console.log(`[getApiKey] no key found!`)
  return fromCtx || fromEnv || ''
}

function getVideoModel(): string {
  return getRuntimeContext()?.secrets?.aliyunVideoModel
    || 'wan2.7-i2v-2026-04-25'
}

// 阿里百炼兼容 OpenAI 格式的端点（图生视频专用）
const COMPAT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

interface VideoGenParams {
  prompt: string
  duration?: number        // 2-15秒，默认5
  ratio?: string           // "16:9" | "9:16" | "1:1"
  imageUrl?: string        // 参考图（图生视频首帧）
  imageUrl2?: string       // 尾帧
  referenceImages?: string[]  // 中帧参考图数组
  model?: string
  negativePrompt?: string
  audioUrl?: string        // 驱动音频
  shotType?: string        // wan2.6: "multi" | "single"
}

/** wan2.7-r2v 参考图/视频 + 参考音频 */
interface VideoGenR2VParams {
  prompt: string
  duration?: number
  ratio?: string
  model?: string
  /** media 列表: reference_image / reference_video */
  media: Array<{
    type: 'reference_image' | 'reference_video'
    url: string
    reference_voice?: string   // 每个 reference 可独立配音频
  }>
  prompt_extend?: boolean
  watermark?: boolean
}

interface VideoGenResult {
  taskId: string
}

interface VideoPollResult {
  status: 'running' | 'succeeded' | 'failed'
  videoUrl?: string
  error?: string
  resolution?: string
  duration?: number
}

// 阿里云百炼视频端点
const BASE_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis'
// 查询任务状态端点
const TASK_URL = 'https://dashscope.aliyuncs.com/api/v1/tasks'

/** 把图片/音频相对路径转成公网 URL */
function toPublicUrl(url: string): string {
  if (url.startsWith('http')) return url
  if (url.startsWith('data:')) return url
  return `https://aigc.fushtn.com${url.startsWith('/') ? '' : '/'}${url}`
}

export const aliyunVideo = {
  /**
   * 提交视频生成任务（body 由 middleware 统一构建）
   *
   * 文档: https://help.aliyun.com/zh/model-studio/image-to-video-general-api-reference
   * 支持: wan2.7-i2v / wan2.6-legacy / wan2.7-r2v / t2v-standard 四种格式
   *
   * body 格式由 providerMiddleware.buildVideoBody() 根据 model 名自动选择
   */
  async submit(params: VideoGenParams): Promise<VideoGenResult> {
    const apiKey = getApiKey()
    if (!apiKey) {
      throw new Error('ALIYUN_API_KEY 未配置')
    }

    const model = params.model || getVideoModel()
    const execId = (params as any).traceId || 'no-trace'
    console.log(`[TRACE-${execId}] aliyunVideo.submit: model=${model}, format=${providerMiddleware.getVideoFormat(model)}`)

    // 由 middleware 统一构建 body（根据模型名自动匹配格式）
    const body = providerMiddleware.buildVideoBody({
      model,
      prompt: params.prompt || '',
      imageUrl: params.imageUrl,
      imageUrl2: params.imageUrl2,
      audioUrl: params.audioUrl,
      shotType: params.shotType,
      r2vMedia: (params as any).r2vMedia,
      duration: params.duration,
      ratio: params.ratio,
      negativePrompt: params.negativePrompt,
      seed: (params as any).seed,
    })

    console.log(`[AliyunVideo] 提交 body (原生): ${JSON.stringify(body).substring(0, 500)}`)

    const resp = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => 'unknown error')
      const reqBodyStr = JSON.stringify(body).substring(0, 600)
      console.error(`[AliyunVideo] API 错误: status=${resp.status} ${resp.statusText}, body=${errText}`)
      console.error(`[AliyunVideo] 请求 body (前600字): ${reqBodyStr}`)
      throw new Error(`阿里百炼视频生成失败 (${resp.status}): ${errText}`)
    }

    const data = await resp.json()
    console.log(`[AliyunVideo] 原始响应: ${JSON.stringify(data).substring(0, 500)}`)
    const taskId = data.output?.task_id || data.task_id || data.id || ''
    console.log(`[AliyunVideo] 提交成功: taskId=${taskId}`)
    return {
      taskId,
      status: 'running',
    }
  },

  /**
   * 轮询任务状态
   */
  async poll(taskId: string): Promise<VideoPollResult> {
    const apiKey = getApiKey()
    console.log(`[TRACE] aliyunVideo.poll: taskId=${taskId}`)
    const resp = await fetch(`${TASK_URL}/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`Aliyun video poll failed (${resp.status}): ${err}`)
    }

    const data = await resp.json()
    const status = data.output?.task_status || 'unknown'
    console.log(`[TRACE] aliyunVideo.poll result: taskId=${taskId}, status=${status}`)

    if (status === 'SUCCEEDED') {
      const videoUrl = typeof data.output?.video_url === 'string' ? data.output.video_url : (data.output?.video_url?.[0] || data.output?.results?.[0]?.url)
      console.log(`[TRACE] aliyunVideo.poll succeeded: taskId=${taskId}, videoUrl=${videoUrl?.substring(0, 60) || 'N/A'}`)
      return {
        status: 'succeeded',
        videoUrl,
        resolution: data.output?.resolution,
        duration: data.output?.duration,
      }
    }

    if (status === 'FAILED') {
      const errMsg = data.output?.message || data.message || 'Unknown error'
      console.log(`[TRACE] aliyunVideo.poll failed: taskId=${taskId}, error=${errMsg}`)
      return {
        status: 'failed',
        error: errMsg,
      }
    }

    return { status: 'running' }
  },

  /**
   * 图生视频（原生百炼 API）
   * 使用 POST {BASE_URL} 原生格式，非 OpenAI 兼容
   */
  async submitWithImage(params: {
    prompt: string
    imageUrl: string
    secondImageUrl?: string
    duration?: number
    model?: string
    negativePrompt?: string
  }): Promise<VideoGenResult> {
    const apiKey = getApiKey()
    if (!apiKey) {
      throw new Error('ALIYUN_API_KEY 未配置')
    }

    const model = params.model || getVideoModel()
    const duration = Math.min(15, Math.max(2, Math.round(Number(params.duration || 5))))

    const media: Array<{ type: string; url: string }> = [{ type: 'first_frame', url: toPublicUrl(params.imageUrl) as string }]
    if (params.secondImageUrl) {
      media.push({ type: 'last_frame', url: toPublicUrl(params.secondImageUrl) as string })
    }

    const body: Record<string, any> = {
      model,
      input: {
        prompt: params.prompt,
        media,
      },
      parameters: {
        duration,
        resolution: '720P',
        prompt_extend: true,
        watermark: false,
      },
    }

    // 反向提示词
    if (params.negativePrompt) {
      body.input.negative_prompt = params.negativePrompt
    }

    console.log(`🎬 [Aliyun/I2V] Submit: model=${model}, image=${params.imageUrl.substring(0, 40)}..., prompt=${params.prompt?.substring(0, 60)}`)

    const resp = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`阿里百炼图生视频失败 (${resp.status}): ${err}`)
    }

    const data = await resp.json()
    const taskId = data?.output?.task_id || data?.id || ''
    console.log(`✅ [Aliyun/I2V] Task submitted: ${taskId}`)
    return { taskId }
  },

  /**
   * wan2.7-r2v: 参考图+参考视频生成（原生百炼 API）
   * 文档: https://help.aliyun.com/zh/model-studio/wan-reference-to-video-api-reference
   */
  async submitR2V(params: VideoGenR2VParams): Promise<VideoGenResult> {
    const apiKey = getApiKey()
    if (!apiKey) {
      throw new Error('ALIYUN_API_KEY 未配置')
    }

    const model = params.model || 'wan2.7-r2v'
    const duration = Math.min(15, Math.max(2, Math.round(Number(params.duration || 5))))

    const body: Record<string, any> = {
      model,
      input: {
        prompt: params.prompt,
        media: params.media.map(m => ({
          type: m.type,
          url: toPublicUrl(m.url),
          ...(m.reference_voice ? { reference_voice: toPublicUrl(m.reference_voice) } : {}),
        })),
      },
      parameters: {
        duration,
        resolution: params.ratio === '9:16' ? '720P' : '720P',
        prompt_extend: params.prompt_extend ?? false,
        watermark: params.watermark ?? true,
      },
    }

    console.log(`[AliyunVideo/R2V] submit: model=${model}, mediaCount=${params.media.length}`)

    const resp = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`阿里百炼 R2V 失败 (${resp.status}): ${err}`)
    }

    const data = await resp.json()
    const taskId = data?.output?.task_id || data?.id || ''
    console.log(`[AliyunVideo/R2V] 提交成功: taskId=${taskId}`)
    return { taskId }
  },

  /**
   * 等待任务完成（阻塞轮询）
   */
  async waitForCompletion(taskId: string, pollIntervalMs: number = 5000, timeoutMs: number = 180000): Promise<VideoPollResult> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const result = await this.poll(taskId)
      if (result.status === 'succeeded') {
        console.log(`✅ [Aliyun] Task ${taskId} completed: ${result.videoUrl}`)
        return result
      }
      if (result.status === 'failed') {
        console.error(`❌ [Aliyun] Task ${taskId} failed: ${result.error}`)
        return result
      }
      console.log(`⏳ [Aliyun] Task ${taskId} still running...`)
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
    }
    return { status: 'failed', error: 'Task timed out' }
  },
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "provider.registry",
  "mode": "TOOL"
};

