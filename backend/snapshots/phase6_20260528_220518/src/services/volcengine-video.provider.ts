/**
 * 火山引擎 Seedance 视频生成 Provider
 * 
 * 端點: POST /api/v3/contents/generations/tasks
 * 响应: { id: "task-xxx" } → 轮询 GET /api/v3/contents/generations/tasks/{id} 获取状态
 */
import { env } from '../config/env.js'

interface VideoGenParams {
  prompt: string
  duration?: number        // 4-12秒，默认5
  ratio?: string           // "16:9" | "9:16" | "adaptive"
  imageUrl?: string        // 参考图（图生视频）
  model?: string
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

const BASE_URL = env.VOLCENGINE_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'
const API_KEY = env.VOLCENGINE_API_KEY

export const volcengineVideo = {
  /**
   * 提交视频生成任务
   */
  async submit(params: VideoGenParams): Promise<VideoGenResult> {
    const model = params.model || env.VOLCENGINE_VIDEO_MODEL || 'doubao-seedance-1-5-pro-251215'
    const duration = Math.min(12, Math.max(4, Math.round(Number(params.duration || 5))))
    const ratio = params.ratio || '16:9'

    const content: any[] = [{ type: 'text', text: params.prompt }]

    // 如果有参考图
    if (params.imageUrl) {
      content.push({ type: 'image_url', image_url: { url: params.imageUrl } })
    }

    const body: Record<string, any> = {
      model,
      content,
      generate_audio: true,
      duration,
      watermark: false,
    }
    // Seedance 支持 ratio 参数（标准比例如 16:9, 9:16, 1:1, 4:3）
    if (params.ratio) {
      body.ratio = params.ratio
    }

    console.log(`🎬 [VolcEngine] Submitting video task: model=${model}, duration=${duration}s, ratio=${ratio}`)

    const resp = await fetch(`${BASE_URL}/contents/generations/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`VolcEngine video submit failed (${resp.status}): ${err}`)
    }

    const data = await resp.json()
    console.log(`✅ [VolcEngine] Task submitted: ${data.id}`)
    return { taskId: data.id }
  },

  /**
   * 轮询任务状态
   */
  async poll(taskId: string): Promise<VideoPollResult> {
    const resp = await fetch(`${BASE_URL}/contents/generations/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    })

    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`VolcEngine video poll failed (${resp.status}): ${err}`)
    }

    const data = await resp.json()
    const status = data.status || 'unknown'

    if (status === 'succeeded') {
      return {
        status: 'succeeded',
        videoUrl: data.content?.video_url,
        resolution: data.resolution,
        duration: data.duration,
      }
    }

    if (status === 'failed') {
      return {
        status: 'failed',
        error: data.error || 'Unknown error',
      }
    }

    return { status: 'running' }
  },

  /**
   * 等待任务完成（阻塞轮询）
   */
  async waitForCompletion(taskId: string, pollIntervalMs: number = 5000, timeoutMs: number = 120000): Promise<VideoPollResult> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const result = await this.poll(taskId)

      if (result.status === 'succeeded') {
        console.log(`✅ [VolcEngine] Task ${taskId} completed: ${result.videoUrl}`)
        return result
      }

      if (result.status === 'failed') {
        console.error(`❌ [VolcEngine] Task ${taskId} failed: ${result.error}`)
        return result
      }

      console.log(`⏳ [VolcEngine] Task ${taskId} still running...`)
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
    }
    console.error(`❌ [VolcEngine] Task ${taskId} timed out after ${timeoutMs}ms`)
    return { status: 'failed', error: `Task timed out after ${timeoutMs / 1000}s` }
  },
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "provider.registry",
  "mode": "TOOL"
};

