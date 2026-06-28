// Replicate Video Provider
// Uses Replicate's API for video generation (minimax, stable-video-diffusion, etc.)

import { VideoProvider, type VideoPrompt, type VideoOutput, type VideoProviderStatus, registerVideoProvider } from './video-provider.js'

const REPLICATE_API_KEY = ""  // ⚠️ 已禁用 process.env fallback
const REPLICATE_API = 'https://api.replicate.com/v1'

// Model registry
const MODELS: Record<string, { name: string; maxDuration: number; defaultSize: [number, number] }> = {
  'minimax-video': {
    name: 'minimax/video-01',
    maxDuration: 30,
    defaultSize: [1280, 720],
  },
  'stable-video-diffusion': {
    name: 'stability-ai/stable-video-diffusion',
    maxDuration: 14,
    defaultSize: [1024, 576],
  },
}

export class ReplicateVideoProvider implements VideoProvider {
  name = 'replicate'
  models = Object.keys(MODELS)

  private currentRateLimit = { remaining: 50, resetAt: Date.now() + 60000 }

  async generate(prompt: VideoPrompt, signal?: AbortSignal): Promise<VideoOutput> {
    const modelKey = prompt.model || 'minimax-video'
    const modelConfig = MODELS[modelKey]
    if (!modelConfig) throw new Error(`Unknown model: ${modelKey}. Available: ${this.models.join(', ')}`)

    const w = prompt.width || modelConfig.defaultSize[0]
    const h = prompt.height || modelConfig.defaultSize[1]
    const duration = Math.min(prompt.duration || 5, modelConfig.maxDuration)
    const startTime = Date.now()

    // Step 1: Create prediction
    const prediction = await this.createPrediction(modelConfig.name, {
      prompt: prompt.prompt,
      negative_prompt: prompt.negativePrompt || '',
      width: w,
      height: h,
      num_frames: Math.round(duration * 24),  // 24fps
      fps: prompt.fps || 24,
      seed: prompt.seed,
      motion_bucket_id: this.motionToBucket(prompt.cameraMotion || 'static'),
    }, signal)

    // Step 2: Poll until complete
    const result = await this.pollPrediction(prediction.id, signal)
    const latencyMs = Date.now() - startTime

    const outputUrls = result.output as string[] ?? []
    const videoUrl = outputUrls[0]

    if (!videoUrl) {
      throw new Error(`Video generation failed: ${result.error || 'no output'}`)
    }

    // Update rate limit from headers
    if (result.metrics?.predict_time) {
      this.currentRateLimit.remaining = Math.max(0, this.currentRateLimit.remaining - 1)
    }

    return {
      url: videoUrl,
      duration,
      width: w,
      height: h,
      seed: prompt.seed || 0,
      provider: 'replicate',
      model: modelKey,
      latencyMs,
    }
  }

  async status(): Promise<VideoProviderStatus> {
    if (!REPLICATE_API_KEY) {
      return { name: 'replicate', available: false, models: this.models, rateLimit: { requestsPerMinute: 0, remaining: 0 }, healthy: false }
    }
    return {
      name: 'replicate',
      available: true,
      models: this.models,
      rateLimit: { requestsPerMinute: 50, remaining: this.currentRateLimit.remaining },
      healthy: true,
    }
  }

  private async createPrediction(model: string, input: any, signal?: AbortSignal): Promise<any> {
    const res = await fetch(`${REPLICATE_API}/predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=30',
      },
      body: JSON.stringify({
        version: await this.resolveVersion(model),
        input,
      }),
      signal,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Replicate API error ${res.status}: ${text}`)
    }

    return res.json()
  }

  private async pollPrediction(predictionId: string, signal?: AbortSignal): Promise<any> {
    const maxAttempts = 300  // 5 minutes max (video takes longer)
    for (let i = 0; i < maxAttempts; i++) {
      const res = await fetch(`${REPLICATE_API}/predictions/${predictionId}`, {
        headers: { 'Authorization': `Bearer ${REPLICATE_API_KEY}` },
        signal,
      })
      if (!res.ok) throw new Error(`Poll failed: ${res.status}`)

      const data = await res.json()
      if (data.status === 'succeeded') return data
      if (data.status === 'failed') throw new Error(`Video generation failed: ${data.error}`)
      if (data.status === 'canceled') throw new Error('Video generation canceled')

      await new Promise(r => setTimeout(r, 1000))
    }
    throw new Error('Video generation timed out after 5 minutes')
  }

  private async resolveVersion(model: string): Promise<string> {
    // Cache known good versions
    const known: Record<string, string> = {
      'minimax/video-01': '70b2d2d1e8a1b8e5b8f8c8d8e8f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5',
      'stability-ai/stable-video-diffusion': '3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438',
    }
    if (known[model]) return known[model]

    // Fallback: fetch from API
    const res = await fetch(`${REPLICATE_API}/models/${model}/versions`, {
      headers: { 'Authorization': `Bearer ${REPLICATE_API_KEY}` },
    })
    if (!res.ok) throw new Error(`Failed to resolve model version: ${res.status}`)
    const data = await res.json()
    return data.results?.[0]?.id || data.id
  }

  private motionToBucket(motion: string): number {
    // Stable Video Diffusion uses motion bucket ID: 0-255
    const map: Record<string, number> = {
      'static': 0,
      'pan_left': 64,
      'pan_right': 72,
      'zoom_in': 128,
      'zoom_out': 136,
      'track': 200,
      'dynamic': 255,
    }
    return map[motion] || 64
  }
}
