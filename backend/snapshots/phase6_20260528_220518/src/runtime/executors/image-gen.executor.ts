/**
 * ImageGenExecutor
 * Input: image_prompts (json) → Output: images (url[])
 * Generates real images from image prompts using Replicate/Flux.
 */

import { getImageProvider, listImageProviders } from '../providers/provider.registry.js'
import type { IExecutor, ExecutorInput, ExecutorResult } from './base.executor.js'

export class ImageGenExecutor implements IExecutor {
  type = 'image_gen'

  async execute(input: ExecutorInput): Promise<ExecutorResult> {
    const signal = input.signal
    const prompts = input.inputs.image_prompts ?? input.inputs.default ?? []

    if (!prompts || (Array.isArray(prompts) && prompts.length === 0)) {
      return {
        success: false,
        error: 'No image prompts provided',
        outputs: {},
        metadata: { durationMs: 0 },
      }
    }

    // Get image provider
    const imageProviders = listImageProviders()
    if (imageProviders.length === 0) {
      return {
        success: false,
        error: 'No image generation provider configured. Set REPLICATE_API_KEY in .env',
        outputs: {},
        metadata: { durationMs: 0 },
      }
    }

    const providerName = input.config.provider || imageProviders[0]
    const provider = getImageProvider(providerName)
    if (!provider) {
      return {
        success: false,
        error: `Image provider "${providerName}" not found. Available: ${imageProviders.join(', ')}`,
        outputs: {},
        metadata: { durationMs: 0 },
      }
    }

    const promptsList: any[] = Array.isArray(prompts) ? prompts : [prompts]
    const results: Array<{ prompt: string; urls: string[]; error?: string }> = []

    const model = input.config.model || 'flux-schnell'

    for (let i = 0; i < promptsList.length; i++) {
      const p = promptsList[i]
      const promptText = p.prompt || p.content || (typeof p === 'string' ? p : JSON.stringify(p))

      if (signal?.aborted) {
        results.push({ prompt: promptText, urls: [], error: 'aborted' })
        break
      }

      try {
        const resp = await provider.generate({
          prompt: promptText,
          negative_prompt: p.negative_prompt,
          model,
          width: parseAspectRatio(p.aspect_ratio || '16:9')[0],
          height: parseAspectRatio(p.aspect_ratio || '16:9')[1],
          steps: input.config.steps || 25,
          guidance_scale: input.config.guidanceScale || 7.5,
        }, signal)

        results.push({
          prompt: promptText,
          urls: resp.images.map(img => img.url),
        })

        console.log(`[image_gen] prompt ${i + 1}/${promptsList.length}: generated ${resp.images.length} image(s) in ${resp.metadata.latencyMs}ms`)
      } catch (err: any) {
        results.push({
          prompt: promptText,
          urls: [],
          error: err.message || String(err),
        })
      }
    }

    const errors = results.filter(r => r.error)

    return {
      success: errors.length === 0,
      error: errors.length > 0 ? `Failed ${errors.length}/${results.length}: ${errors[0].error}` : undefined,
      outputs: {
        images: results,
        image_urls: results.flatMap(r => r.urls),
        total_images: results.reduce((sum, r) => sum + r.urls.length, 0),
        failed: errors.length,
      },
      metadata: {
        durationMs: 0,
        model,
        provider: provider.name,
      },
    }
  }
}

function parseAspectRatio(ar: string): [number, number] {
  const map: Record<string, [number, number]> = {
    '1:1': [1024, 1024],
    '4:3': [1152, 896],
    '3:2': [1216, 832],
    '16:9': [1344, 768],
    '21:9': [1536, 640],
    '9:16': [768, 1344],
    '2:3': [832, 1216],
  }
  return map[ar] || [1024, 1024]
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "pipeline-executor",
  "mode": "SYNC"
};

