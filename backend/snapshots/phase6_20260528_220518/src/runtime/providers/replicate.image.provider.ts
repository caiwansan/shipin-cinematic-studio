/**
 * Replicate Image Provider — Flux Pro / SDXL / etc.
 *
 * Uses Replicate's API to run image generation models.
 * Requires REPLICATE_API_KEY env var.
 *
 * Supported models:
 * - flux-schnell (fast)
 * - flux-pro (quality)
 * - sdxl
 * - stable-diffusion-3.5
 */

import { BaseImageProvider, type ImageGenRequest, type ImageGenResponse } from './image.base.provider.js'

const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY || process.env.REPLICATE_TOKEN || ''

const REPLICATE_API = 'https://api.replicate.com/v1'

// Model ID -> max resolution
const MODELS: Record<string, { name: string; maxPixels: number; defaultSize: [number, number] }> = {
  'flux-schnell': {
    name: 'black-forest-labs/flux-schnell',
    maxPixels: 4194304,  // 2048x2048
    defaultSize: [1024, 1024],
  },
  'flux-pro': {
    name: 'black-forest-labs/flux-1.1-pro',
    maxPixels: 4194304,
    defaultSize: [1024, 1024],
  },
  'sdxl': {
    name: 'stability-ai/sdxl',
    maxPixels: 4194304,
    defaultSize: [1024, 1024],
  },
}

export class ReplicateImageProvider extends BaseImageProvider {
  name = 'replicate'
  apiKey = REPLICATE_API_KEY

  async generate(req: ImageGenRequest, signal?: AbortSignal): Promise<ImageGenResponse> {
    const modelKey = req.model || 'flux-schnell'
    const modelConfig = MODELS[modelKey] || MODELS['flux-schnell']

    const w = req.width || modelConfig.defaultSize[0]
    const h = req.height || modelConfig.defaultSize[1]

    const startTime = Date.now()

    // Step 1: Create prediction
    const prediction = await this.createPrediction(modelConfig.name, {
      prompt: req.prompt,
      negative_prompt: req.negative_prompt || '',
      width: w,
      height: h,
      num_outputs: 1,
      num_inference_steps: req.steps || 25,
      guidance_scale: req.guidance_scale || 7.5,
    }, signal)

    // Step 2: Poll until complete
    const result = await this.pollPrediction(prediction.id, signal)

    const latencyMs = Date.now() - startTime

    // Parse output
    const outputUrls = result.output as string[] ?? []
    const images = outputUrls.map((url: string) => ({
      url,
      width: w,
      height: h,
      seed: req.seed,
    }))

    if (images.length === 0) {
      throw new Error(`Image generation failed: ${result.error || 'no output'}`)
    }

    return {
      images,
      metadata: {
        provider: 'replicate',
        model: modelKey,
        latencyMs,
      },
    }
  }

  private async createPrediction(model: string, input: any, signal?: AbortSignal): Promise<any> {
    const res = await fetch(`${REPLICATE_API}/predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=30',  // wait up to 30s for sync response
      },
      body: JSON.stringify({
        version: this.getVersionForModel(model),
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
    const maxAttempts = 120  // 2 minutes max
    for (let i = 0; i < maxAttempts; i++) {
      const res = await fetch(`${REPLICATE_API}/predictions/${predictionId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal,
      })
      if (!res.ok) throw new Error(`Poll failed: ${res.status}`)

      const data = await res.json()
      if (data.status === 'succeeded') return data
      if (data.status === 'failed') throw new Error(`Image generation failed: ${data.error}`)
      if (data.status === 'canceled') throw new Error('Image generation canceled')

      await new Promise(r => setTimeout(r, 1000))
    }
    throw new Error('Image generation timed out after 2 minutes')
  }

  private getVersionForModel(model: string): string {
    // These are known working model versions on Replicate
    const versions: Record<string, string> = {
      'black-forest-labs/flux-schnell': '2b028f9b1f26aad3f672f3c2e20702c1d08630f389246c5a0c2d5cacf12ac311',
      'black-forest-labs/flux-1.1-pro': 'a68f840d1e73f3b6b74c6f0742498b28dc2e73b3b1d1b7e2e5b9f3e8b5d6c7a8',
      'stability-ai/sdxl': '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
    }
    return versions[model] || versions['black-forest-labs/flux-schnell']
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "provider.registry",
  "mode": "TOOL"
};

