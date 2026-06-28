/**
 * Phase 1A/1B — Volcengine Video Adapter
 *
 * Wraps volcengineVideoWrapped via submit → waitForCompletion chain.
 * Phase 1B: Added try/catch + normalizeVideoFailure for symmetry with AliyunVideoAdapter.
 */

import type { ModelPluginAdapter, Candidate, NormalizedRequest, NormalizedResponse } from '../provider-registry/types.js'
import { volcengineVideoWrapped } from '../provider-wrapper/volcengine/volcengine-video.wrapper.js'
import { normalizeVideoFailure } from './video.failure.js'

export class VolcengineVideoAdapter implements ModelPluginAdapter {
  readonly provider = 'volcengine'

  models(): Candidate[] {
    return [
      {
        provider: 'volcengine',
        model: 'doubao-seedance-1-5-pro-251215',
        capability: 'video',
        cost: 0.3,
        latency: 0.4,
        quality: 0.85,
        reliability: 0.85,
      },
    ]
  }

  async execute(request: NormalizedRequest, candidate: Candidate, _signal?: AbortSignal): Promise<NormalizedResponse> {
    try {
      const params: any = {
        prompt: request.prompt ?? '',
        duration: request.params?.duration ?? 5,
        ratio: request.params?.ratio ?? '16:9',
        model: candidate.model,
      }

      if (request.params) {
        Object.assign(params, request.params)
      }

      const taskId = await volcengineVideoWrapped.submit(params)
      const result = await volcengineVideoWrapped.waitForCompletion(taskId, 5000)

      return {
        content: result.videoUrl || '',
        model: candidate.model,
        latencyMs: 0,
        raw: { taskId, status: result.status, videoUrl: result.videoUrl, provider: 'volcengine' },
      }
    } catch (err) {
      const failure = normalizeVideoFailure('volcengine', err)
      return {
        content: '',
        model: candidate.model,
        latencyMs: 0,
        raw: failure,
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    return true
  }

  label(): string {
    return 'Volcengine Video'
  }
}
