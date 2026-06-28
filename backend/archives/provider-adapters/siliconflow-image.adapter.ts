/**
 * Phase C — SiliconFlow Image Adapter (stub)
 *
 * Wraps the existing siliconflowImageGenerate function into the ModelPluginAdapter contract.
 * This is a thin compatibility layer — the actual implementation is still in routes/images.ts.
 */

import type { ModelPluginAdapter, Candidate, NormalizedRequest, NormalizedResponse } from '../provider-registry/types.js'

import { env } from '../../config/env.js'

async function executeRequest(params: {
  prompt: string
  negativePrompt?: string
  size?: string
  imageUrl?: string
  model?: string
}): Promise<{ imageUrl: string; provider: string }> {
  throw new Error('[RuntimeConstitution] siliconflow-image.adapter 已废弃，请使用 model-adapters/images/ 下的适配器')

  const body: any = {
    model,
    prompt: params.prompt,
    negative_prompt: params.negativePrompt || '',
    n: 1,
    size: params.size || '1024x1024',
  }

  if (params.imageUrl) {
    body.image = params.imageUrl
    body.image_style = 'photographic'
  }

  const resp = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`SiliconFlow image failed (${resp.status}): ${err}`)
  }
  const data = await resp.json()
  return { imageUrl: data.data?.[0]?.url || '', provider: 'siliconflow' }
}

export class SiliconflowImageAdapter implements ModelPluginAdapter {
  readonly provider = 'siliconflow'

  models(): Candidate[] {
    return [
      {
        provider: 'siliconflow',
        model: 'black-forest-labs/FLUX.1-dev',
        capability: 'image',
        cost: 0.7,
        latency: 0.6,
        quality: 0.7,
        reliability: 0.8,
      },
    ]
  }

  async execute(request: NormalizedRequest, candidate: Candidate, _signal?: AbortSignal): Promise<NormalizedResponse> {
    const result = await executeRequest({
      prompt: request.prompt ?? '',
      model: candidate.model,
      size: (request.params?.size as string) || undefined,
      imageUrl: (request.params?.imageUrl as string) || undefined,
    })

    return {
      content: result.imageUrl,
      model: candidate.model,
      latencyMs: 0,  // will be measured by the caller
      raw: result,
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const apiKey = process.env.SILICONFLOW_API_KEY || env.SILICONFLOW_API_KEY
      return !!apiKey
    } catch {
      return false
    }
  }

  label(): string {
    return 'SiliconFlow Image (FLUX.1-dev)'
  }
}
