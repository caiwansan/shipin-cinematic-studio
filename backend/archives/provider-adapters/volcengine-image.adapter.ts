/**
 * Phase C — Volcengine Image Adapter (stub)
 *
 * Wraps the existing volcengineImage.generate function into the ModelPluginAdapter contract.
 */

import type { ModelPluginAdapter, Candidate, NormalizedRequest, NormalizedResponse } from '../provider-registry/types.js'
import { bindVolcengineImageMethods } from '../provider-wrapper/volcengine/volcengine-method-bindings.js'

const volcengineImage = bindVolcengineImageMethods

export class VolcengineImageAdapter implements ModelPluginAdapter {
  readonly provider = 'volcengine'

  models(): Candidate[] {
    return [
      {
        provider: 'volcengine',
        model: 'doubao-seedream-4-0-250828',
        capability: 'image',
        cost: 0.3,
        latency: 0.8,
        quality: 0.9,
        reliability: 0.9,
      },
      {
        provider: 'volcengine',
        model: 'seed-x50',
        capability: 'image',
        cost: 0.35,
        latency: 0.75,
        quality: 0.85,
        reliability: 0.88,
      },
    ]
  }

  async execute(request: NormalizedRequest, candidate: Candidate, _signal?: AbortSignal): Promise<NormalizedResponse> {
    const params: any = {
      prompt: request.prompt ?? '',
      n: 1,
      size: request.params?.size || '1024x1024',
      model: candidate.model,
    }

    if (request.params?.imageUrl) {
      params.imageUrl = request.params.imageUrl
    }

    const result = await volcengineImage.generate(params)

    return {
      content: result.imageUrl || '',
      model: candidate.model,
      latencyMs: 0,
      raw: result,
    }
  }

  async healthCheck(): Promise<boolean> {
    return true
  }

  label(): string {
    return 'Volcengine Image (Doubao Seedream)'
  }
}
