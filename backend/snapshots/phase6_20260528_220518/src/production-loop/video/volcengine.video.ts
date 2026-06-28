// 火山引擎方舟 Volcengine Ark Provider
// 视频生成模型适配器（doubao-seedance-2.0 / 1.5 / 1.0）
// 火山引擎使用 OpenAI 兼容接口

import { VideoProvider, type VideoPrompt, type VideoOutput, type VideoProviderStatus, registerVideoProvider } from './video-provider.js'

// ⚠️ 已禁止 process.env fallback：API Key 必须通过 RuntimePayload 显式传入
const API_KEY = ''  // 不再从 process.env 读取
const BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
const VIDEO_MODEL = 'doubao-seedance-2-0-260128'

// Model registry with constraints
const MODELS: Record<string, { name: string; maxDuration: number; defaultSize: [number, number]; taskType: string }> = {
  'seedance-2-0': {
    name: 'doubao-seedance-2-0-260128',
    maxDuration: 60,
    defaultSize: [1280, 720],
    taskType: 'TextToVideo',
  },
  'seedance-2-0-fast': {
    name: 'doubao-seedance-2-0-fast-260128',
    maxDuration: 30,
    defaultSize: [1280, 720],
    taskType: 'TextToVideo',
  },
  'seedance-1-5-pro': {
    name: 'doubao-seedance-1-5-pro-251215',
    maxDuration: 30,
    defaultSize: [1280, 720],
    taskType: 'TextToVideo',
  },
  'seedance-1-0-fast': {
    name: 'doubao-seedance-1-0-pro-fast-251015',
    maxDuration: 15,
    defaultSize: [1280, 720],
    taskType: 'TextToVideo',
  },
}

export class VolcengineVideoProvider implements VideoProvider {
  name = 'volcengine'
  models = Object.values(MODELS).map(m => m.name)

  private lastRequestTime = 0
  private minRequestInterval = 1000  // 1 request/sec

  async generate(prompt: VideoPrompt, signal?: AbortSignal): Promise<VideoOutput> {
    const modelKey = prompt.model || VIDEO_MODEL
    const modelConfig = Object.values(MODELS).find(m => m.name === modelKey || m.name.startsWith(modelKey))
      || MODELS['seedance-2-0']

    if (!API_KEY) {
      throw new Error('火山引擎 API key 未配置 (VOLCENGINE_API_KEY)')
    }

    const w = prompt.width || modelConfig.defaultSize[0]
    const h = prompt.height || modelConfig.defaultSize[1]
    const duration = Math.min(prompt.duration || 5, modelConfig.maxDuration)
    const startTime = Date.now()

    // ── Step 1: Submit text-to-video task ──
    // 火山引擎方舟视频生成使用 create video task API
    const taskBody = {
      model: modelConfig.name,
      prompt: this.buildPrompt(prompt),
      parameters: {
        duration: duration,
        width: w,
        height: h,
        fps: prompt.fps || 24,
        style: prompt.styleRef || undefined,
        seed: prompt.seed || undefined,
      },
    }

    const res = await fetch(`${BASE_URL}/video/video_generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskBody),
      signal,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`火山引擎 API 错误 ${res.status}: ${text}`)
    }

    const taskResult = await res.json()
    const taskId = taskResult.id || taskResult.task_id

    if (!taskId) {
      throw new Error(`火山引擎：未获取到任务 ID, response: ${JSON.stringify(taskResult)}`)
    }

    // ── Step 2: Poll for completion ──
    const output = await this.pollTask(taskId, signal)

    const latencyMs = Date.now() - startTime
    const videoUrl = output.asset_url || output.video_url || output.output?.video_url || (Array.isArray(output.output) ? output.output[0] : output.output)

    if (!videoUrl) {
      throw new Error(`视频生成失败: ${JSON.stringify(output)}`)
    }

    return {
      url: typeof videoUrl === 'string' ? videoUrl : videoUrl.url,
      duration,
      width: w,
      height: h,
      seed: prompt.seed || 0,
      provider: 'volcengine',
      model: modelConfig.name,
      latencyMs,
    }
  }

  async status(): Promise<VideoProviderStatus> {
    if (!API_KEY) {
      return {
        name: 'volcengine',
        available: false,
        models: Object.values(MODELS).map(m => m.name),
        rateLimit: { requestsPerMinute: 0, remaining: 0 },
        healthy: false,
      }
    }

    return {
      name: 'volcengine',
      available: true,
      models: Object.values(MODELS).map(m => m.name),
      rateLimit: { requestsPerMinute: 60, remaining: 50 },
      healthy: true,
    }
  }

  // ── Private ──

  private async pollTask(taskId: string, signal?: AbortSignal): Promise<any> {
    const maxAttempts = 120  // 2 minutes max for video
    const pollInterval = 1000

    for (let i = 0; i < maxAttempts; i++) {
      const res = await fetch(`${BASE_URL}/video/video_generations/${taskId}`, {
        headers: { 'Authorization': `Bearer ${API_KEY}` },
        signal,
      })

      if (!res.ok) {
        if (res.status === 404) {
          // Task not yet visible, keep polling
          await new Promise(r => setTimeout(r, pollInterval))
          continue
        }
        throw new Error(`Poll failed: ${res.status}`)
      }

      const data = await res.json()
      const status = data.status || data.state

      if (status === 'succeeded' || status === 'completed') {
        return data
      }
      if (status === 'failed' || status === 'error') {
        throw new Error(`视频生成失败: ${data.error || data.message || '未知错误'}`)
      }
      if (status === 'canceled' || status === 'cancelled') {
        throw new Error('视频生成已取消')
      }

      await new Promise(r => setTimeout(r, pollInterval))
    }

    throw new Error('视频生成超时：2分钟内未完成')
  }

  private buildPrompt(prompt: VideoPrompt): string {
    let fullPrompt = prompt.prompt

    // Add camera motion instruction
    if (prompt.cameraMotion && prompt.cameraMotion !== 'static') {
      const motionMap: Record<string, string> = {
        'pan_left': 'Camera pans slowly to the left.',
        'pan_right': 'Camera pans slowly to the right.',
        'zoom_in': 'Camera slowly zooms in.',
        'zoom_out': 'Camera slowly zooms out.',
        'track': 'Camera tracks the subject.',
        'dolly': 'Camera dollies forward.',
      }
      if (motionMap[prompt.cameraMotion]) {
        fullPrompt += ' ' + motionMap[prompt.cameraMotion]
      }
    }

    return fullPrompt
  }

  register(): void {
    registerVideoProvider(this)
  }
}
