/**
 * Phase 1A/1B — Aliyun Video Adapter
 *
 * Wraps aliyunVideo via submit → waitForCompletion chain.
 * Phase 1B: Added try/catch + normalizeVideoFailure for symmetry with VolcengineVideoAdapter.
 */

import type { ModelPluginAdapter, Candidate, NormalizedRequest, NormalizedResponse } from '../provider-registry/types.js'
import { aliyunVideo } from '../../services/aliyun-video.provider.js'
import { normalizeVideoFailure } from './video.failure.js'

export class AliyunVideoAdapter implements ModelPluginAdapter {
  readonly provider = 'aliyun'

  models(): Candidate[] {
    return [
      {
        provider: 'aliyun',
        model: 'wan2.7-t2v',
        capability: 'video',
        cost: 0.4,
        latency: 0.5,
        quality: 0.8,
        reliability: 0.8,
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

      const genResult = await aliyunVideo.submit(params)
      const result = await aliyunVideo.waitForCompletion(genResult.taskId, 5000)

      return {
        content: result.videoUrl || '',
        model: candidate.model,
        latencyMs: 0,
        raw: { taskId: genResult.taskId, status: result.status, videoUrl: result.videoUrl, provider: 'aliyun' },
      }
    } catch (err) {
      const failure = normalizeVideoFailure('aliyun', err)
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
    return 'Aliyun Video'
  }
}
