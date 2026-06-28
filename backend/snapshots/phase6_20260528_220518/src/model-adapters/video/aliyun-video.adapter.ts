/**
 * model-adapters/video/aliyun-video.adapter.ts
 *
 * 阿里百炼万相视频适配器
 *
 * 支持的模型:
 *   wan2.7-i2v, wan2.7-t2v, wan2.7-r2v
 *   wan2.6-i2v, wan2.6-t2v, wan2.6-r2v
 *   wan2.5-i2v, wan2.5-t2v
 *   wan2.2-i2v, wan2.2-t2v, wan2.2-kf2v
 *   wanx2.1-i2v, wanx2.1-t2v, wanx2.1-kf2v
 *   happyhorse-1.0-*
 *
 * 端点: 原生百炼 task/sumbit 端点
 * body 格式按模型类型选择:
 *   wan2.7-i2v → input.media[{type:"first_frame"/"last_frame"}]
 *   wan2.6-i2v → input.img_url + audio_url + shot_type
 *   wan2.7-r2v → input.media[{type:"reference_image"/"reference_video"}]
 *   t2v → prompt only
 *
 * 注: 所有费时任务的端点都是异步 submit + task_id 轮询
 */

import { ModelAdapter, ModelAdapterInput, ModelAdapterResult } from '../types.js'
import { providerMiddleware } from '../../runtime/provider-middleware.js'

const SUBMIT_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis'
const QUERY_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/get-video-task'

/** wan2.7 以上多模态格式视频 */
const MODERN_MODELS = ['wan2.7', 'wan2.6', 'wanx2.1', 'wan2.5', 'happyhorse']

export const aliyunVideoAdapter: ModelAdapter = {
  name: 'aliyun-video',
  supportedModels: [
    'wan2.7-i2v', 'wan2.7-t2v', 'wan2.7-r2v', 'wan2.7-videoedit',
    'wan2.6-i2v', 'wan2.6-t2v', 'wan2.6-r2v',
    'wan2.5-i2v', 'wan2.5-t2v',
    'wan2.2-i2v', 'wan2.2-t2v', 'wan2.2-kf2v',
    'wanx2.1-i2v', 'wanx2.1-t2v', 'wanx2.1-kf2v',
    'happyhorse-1.0-r2v', 'happyhorse-1.0-i2v', 'happyhorse-1.0-t2v', 'happyhorse-1.0-video-edit',
    'happyhorse*', 'wan2*', 'wanx*',
  ],
  taskTypes: ['video'],
  provider: 'aliyun',

  async execute(runtime: RuntimePayload, input: ModelAdapterInput): Promise<ModelAdapterResult> {
    const apiKey = runtime.apiKey || ''
    if (!apiKey) throw new Error('阿里百炼 API Key 未配置')

    const model = input.model || ''
    const prompt = input.prompt || ''
    const duration = input.duration || 5
    const ratio = input.ratio || await resolveRatio(input.aspectRatio || '16:9')

    console.log(`[AliyunVideo] model=${model}, prompt=${prompt.substring(0, 40)}...`)

    // 用 middleware 的 buildVideoBody 转换 body 格式
    const body = providerMiddleware.buildVideoBody({
      model,
      prompt,
      imageUrl: input.imageUrl,
      imageUrl2: input.imageUrl2,
      referenceImages: input.referenceImages,
      audioUrl: input.audioUrl,
      shotType: input.shotType,
      duration,
      ratio,
      r2vMedia: input.r2vMedia,
    })

    console.log(`[AliyunVideo] body 构建完成, format=${JSON.stringify(body).substring(0, 100)}...`)

    // 提交异步任务
    const res = await fetch(SUBMIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) throw new Error(`阿里视频提交失败 (${res.status}): ${await res.text()}`)

    const data = await res.json()
    const taskId = data?.output?.task_id || data?.task_id || data?.request_id

    if (!taskId) {
      // 可能有同步返回的情况
      if (data?.output?.video_url) return { url: data.output.video_url, provider: 'aliyun' }
      if (data?.data?.url) return { url: data.data.url, provider: 'aliyun' }
      throw new Error(`阿里视频无 task_id: ${JSON.stringify(data).substring(0, 200)}`)
    }

    console.log(`[AliyunVideo] 任务已提交: ${taskId}`)

    // 轮询结果
    return pollAliyunVideoResult(taskId, apiKey)
  },
}

async function pollAliyunVideoResult(taskId: string, apiKey: string): Promise<ModelAdapterResult> {
  const maxPoll = 300  // 最长等 5分钟（300次×1s）
  for (let i = 0; i < maxPoll; i++) {
    const res = await fetch(QUERY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ task_id: taskId }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) throw new Error(`阿里视频任务查询失败 (${res.status}): ${await res.text()}`)

    const data = await res.json()
    const status = data?.output?.task_status || data?.status || ''

    if (status === 'SUCCEEDED' || status === 'succeeded') {
      const url = data?.output?.video_url || data?.data?.url || data?.url
      const duration = data?.output?.video_duration || undefined
      const resolution = data?.output?.video_resolution || data?.output?.resolution || undefined
      if (url) return { url, duration, resolution, provider: 'aliyun' }
      throw new Error(`阿里视频任务成功但无 URL: ${JSON.stringify(data).substring(0, 200)}`)
    }

    if (status === 'FAILED' || status === 'failed') {
      throw new Error(`阿里视频任务失败: ${data?.output?.message || data?.error || 'Unknown'}`)
    }

    if (i % 30 === 0) {
      console.log(`[AliyunVideo] 轮询中: ${i}s, status=${status}`)
    }

    await new Promise(r => setTimeout(r, 1000))
  }

  throw new Error(`阿里视频任务超时 (${maxPoll}s)`)
}

/** 解析画面比例 */
async function resolveRatio(aspectRatio?: string): Promise<string> {
  if (!aspectRatio) return '16:9'
  const map: Record<string, string> = { '16:9': '16:9', '9:16': '9:16', '1:1': '1:1', '4:3': '4:3', '3:4': '3:4', '21:9': '21:9' }
  return map[aspectRatio] || '16:9'
}
