/**
 * Phase C — Aliyun Image Adapter (stub)
 *
 * Wraps the existing aliyunImage.generate function into the ModelPluginAdapter contract.
 */

import type { ModelPluginAdapter, Candidate, NormalizedRequest, NormalizedResponse } from '../provider-registry/types.js'
import { aliyunImage } from '../../services/aliyun-image.provider.js'

export class AliyunImageAdapter implements ModelPluginAdapter {
  readonly provider = 'aliyun'

  models(): Candidate[] {
    return [
      {
        provider: 'aliyun',
        model: 'wanx2.1-t2i-turbo',
        capability: 'image',
        cost: 0.5,
        latency: 0.7,
        quality: 0.8,
        reliability: 0.85,
      },
    ]
  }

  async execute(request: NormalizedRequest, candidate: Candidate, _signal?: AbortSignal): Promise<NormalizedResponse> {
    const params: any = {
      prompt: request.prompt ?? '',
      n: 1,
      size: request.params?.size || '1024x1024',
      source: request.params?.source || 'direct',
      model: candidate.model,
    }

    if (request.params?.imageUrl) {
      params.imageUrl = request.params.imageUrl
    }

    const result = await aliyunImage.generate(params)

    return {
      content: result.imageUrl || '',
      model: candidate.model,
      latencyMs: 0,
      raw: result,
    }
  }

  async healthCheck(): Promise<boolean> {
    return true // Delegate to env check at call time
  }

  label(): string {
    return 'Aliyun Image (Wanx)'
  }
}
