/**
 * model-adapters/video/volcengine-video.adapter.ts
 *
 * 火山引擎视频适配器（豆包 Seedance）
 *
 * 支持的模型:
 *   doubao-seedance-1.0 豆包视频生成
 *   doubao-seedance-X 系列
 *
 * API: POST /api/v3/contents/generations/tasks
 * 格式: { model, content: [{type:"text",text}, {type:"image_url",image_url:{url}}] }
 *
 * 种子视频 API 文档:
 *   POST https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks
 *   GET  https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/:taskId
 *
 * 注: 异步轮询模式
 *   SDK 返回: ContentGenerationTask { id, status, content: { video_url, last_frame_url, file_url } }
 *
 * 验证时间: 2026-05-24 21:10（用户提供官方 curl 示例 + SDK 代码）
 */

import { ModelAdapter, ModelAdapterInput, ModelAdapterResult } from '../types.js'

const BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
const SUBMIT_URL = `${BASE_URL}/contents/generations/tasks`

export const volcengineVideoAdapter: ModelAdapter = {
  name: 'volcengine-video',
  supportedModels: ['doubao-seedance-1.0', 'doubao-seedance*', 'seedance*', 'doubao-video*'],
  taskTypes: ['video'],
  provider: 'volcengine',

  async execute(runtime: RuntimePayload, input: ModelAdapterInput): Promise<ModelAdapterResult> {
    const apiKey = runtime.apiKey || input.apiKey
    if (!apiKey) throw new Error('火山引擎 API Key 未配置')

    const model = input.model || 'doubao-seedance-1.0'
    const prompt = input.prompt || ''
    const duration = input.duration || 5

    console.log(`[VolcVideo] model=${model}, hasImage=${!!input.imageUrl}`)

    // 构建 content 数组（种子视频 API 格式）
    // 文本部分：后端参数通过 -- key value 格式传递
    const textArgs = `--duration ${duration} --camerafixed false --watermark true`
    const content: any[] = [
      { type: 'text', text: `${prompt} ${textArgs}`.trim() },
    ]

    // 图生视频：传入图片 URL（不用转 base64，种子 API 直接支持 URL）
    if (input.imageUrl) {
      const imageUrl = resolveImageUrl(input.imageUrl)
      content.push({
        type: 'image_url',
        image_url: { url: imageUrl },
      })
    }

    const body = {
      model,
      content,
    }

    const res = await fetch(SUBMIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) throw new Error(`火山视频提交失败 (${res.status}): ${await res.text()}`)

    const data = await res.json()
    // 种子 API 返回: { id: "cgt-..." }
    const taskId = data?.id

    if (!taskId) {
      // 同步返回（无 taskId 可能是同步结果）
      if (data?.data?.url) return { url: data.data.url, provider: 'volcengine' }
      if (data?.url) return { url: data.url, provider: 'volcengine' }
      throw new Error(`火山视频无 task_id: ${JSON.stringify(data).substring(0, 200)}`)
    }

    console.log(`[VolcVideo] 任务已提交: ${taskId}`)

    // 轮询结果
    return pollVolcVideoResult(taskId, apiKey)
  },
}

async function pollVolcVideoResult(taskId: string, apiKey: string): Promise<ModelAdapterResult> {
  const queryUrl = `${SUBMIT_URL}/${taskId}`

  for (let i = 0; i < 300; i++) {
    const res = await fetch(queryUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) throw new Error(`火山视频任务查询失败 (${res.status}): ${await res.text()}`)

    const data = await res.json()
    const status: string = data?.status || ''

    if (status === 'succeeded' || status === 'completed') {
      // 种子 API SDK 返回: { id, status, content: { video_url, last_frame_url, file_url }, ... }
      // 后端可能返回 output.url 或 data.contents[].video_url
      let url = ''
      if (data?.content?.video_url) {
        url = data.content.video_url
      } else if (data?.content?.file_url) {
        url = data.content.file_url
      } else if (data?.output?.url) {
        url = data.output.url
      } else if (data?.data?.contents?.[0]?.video_url) {
        url = data.data.contents[0].video_url
      } else if (data?.data?.url) {
        url = data.data.url
      } else if (data?.url) {
        url = data.url
      }
      if (url) return { url, duration: data.duration, resolution: data.resolution, provider: 'volcengine' }
      console.log(`[VolcVideo] 任务完成但无视频 URL，继续重试`)
    }

    if (status === 'failed' || data?.status === 'error') {
      const errMsg = data?.error?.message || data?.error?.code || data?.message || 'Unknown'
      throw new Error(`火山视频任务失败: ${errMsg}`)
    }

    if (i % 30 === 0) console.log(`[VolcVideo] 轮询中: ${i}s, status=${status}`)
    await new Promise(r => setTimeout(r, 1000))
  }

  throw new Error('火山视频任务轮询超时')
}

/** 解析图片 URL：支持本地路径、相对路径 */
function resolveImageUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url
  if (url.startsWith('/')) {
    return (process.env.IMAGE_BASE_URL || 'https://shipin.fushtn.com') + url
  }
  return url
}
