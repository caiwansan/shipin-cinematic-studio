// 阿里百炼（DashScope）视频生成 Provider
// API: https://help.aliyun.com/zh/model-studio/text-to-video

import { VideoProvider, VideoPrompt, VideoOutput, VideoProviderStatus } from './video-provider.js'

export class BailianVideoProvider implements VideoProvider {
  readonly name = 'bailian'
  readonly models = ['qwen-video-plus', 'qwen-video-turbo', 'wan-aigc-video']

  private apiKey: string
  private baseUrl: string

  constructor() {
    this.apiKey = ''  // ⚠️ 已禁止 process.env fallback：API Key 必须通过 RuntimePayload 显式传入
    this.baseUrl = 'https://dashscope.aliyuncs.com/api/v1'
  }

  async generate(prompt: VideoPrompt, _signal?: AbortSignal): Promise<VideoOutput> {
    if (!this.apiKey) {
      throw new Error('阿里百炼 API Key 未配置')
    }

    const model = prompt.model || 'wan-aigc-video'

    // 阿里百炼视频生成 API
    const taskUrl = `${this.baseUrl}/services/aigc/video/generation`
    const body: any = {
      model,
      input: { prompt: prompt.prompt },
      parameters: {
        duration: prompt.duration || 5,
        size: `${prompt.width || 1280}x${prompt.height || 720}`,
      }
    }

    if (prompt.negativePrompt) {
      body.parameters.negative_prompt = prompt.negativePrompt
    }
    if (prompt.seed !== undefined) {
      body.parameters.seed = prompt.seed
    }

    // 1. 提交任务
    const startTime = Date.now()
    const submitRes = await fetch(taskUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!submitRes.ok) {
      const errText = await submitRes.text()
      throw new Error(`百炼 API 提交失败 (${submitRes.status}): ${errText}`)
    }

    const taskData: any = await submitRes.json()
    const taskId = taskData.output?.task_id
    if (!taskId) {
      throw new Error(`百炼 API 未返回 task_id: ${JSON.stringify(taskData)}`)
    }

    // 2. 轮询任务状态
    const maxRetries = 60  // 最多等 5 分钟
    const queryUrl = `${this.baseUrl}/tasks/${taskId}`

    for (let i = 0; i < maxRetries; i++) {
      await new Promise(r => setTimeout(r, 5000)) // 每 5 秒轮询

      const queryRes = await fetch(queryUrl, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      })

      if (!queryRes.ok) continue

      const statusData: any = await queryRes.json()
      const taskStatus = statusData.output?.task_status

      if (taskStatus === 'SUCCEEDED') {
        const videoUrl = statusData.output?.video_url
        if (!videoUrl) {
          throw new Error(`百炼任务成功但无视频 URL: ${JSON.stringify(statusData)}`)
        }

        const latencyMs = Date.now() - startTime
        return {
          url: videoUrl,
          duration: prompt.duration,
          width: prompt.width || 1280,
          height: prompt.height || 720,
          seed: prompt.seed || Math.floor(Math.random() * 1000000),
          provider: this.name,
          model,
          latencyMs,
        }
      }

      if (taskStatus === 'FAILED') {
        const errMsg = statusData.output?.message || statusData.output?.error || '未知错误'
        throw new Error(`百炼视频生成失败: ${errMsg}`)
      }
    }

    throw new Error('百炼视频生成超时')
  }

  async status(): Promise<VideoProviderStatus> {
    const available = !!this.apiKey
    return {
      name: this.name,
      available,
      models: this.models,
      rateLimit: { requestsPerMinute: available ? 10 : 0, remaining: available ? 10 : 0 },
      healthy: available,
    }
  }
}
