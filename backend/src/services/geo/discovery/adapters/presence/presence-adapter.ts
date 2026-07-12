// ============================================================
// Presence Adapter — 对 AI 平台（DeepSeek/Qwen/豆包等）进行认知扫描
// 内部管理 Provider 调用，通过 ProviderRegistry 获取启用的 Provider
// ============================================================

import { DiscoveryAdapter } from '../types'
import type { DiscoveryContext } from '../../../domain/discovery-context'
import type { PipelineStageOutput } from '../../pipeline/types'
import { providerRegistry } from '../../registry/provider-registry'
import { executePresenceScan } from '../../../presence/engine'

/**
 * PresenceAdapter — Discovery 通过此 Adapter 查询品牌在 AI 平台中的可见性
 *
 * 设计原则:
 * - Discovery 不感知具体 Provider
 * - Provider 通过 ProviderRegistry 热插拔
 * - 默认仅启用 DeepSeek（可在 registry 中配置）
 */
export class PresenceAdapter implements DiscoveryAdapter {
  id = 'presence-adapter'
  type = 'presence' as const

  async execute(ctx: DiscoveryContext): Promise<PipelineStageOutput> {
    const startTime = Date.now()
    const enabledProviders = providerRegistry.getEnabled('presence')

    if (enabledProviders.length === 0) {
      return {
        payload: { presence: { visibility: 0, sentiment: 0, authority: 0 } },
        durationMs: 0,
        confidence: 0,
        evidenceCount: 0,
        error: 'No enabled presence providers',
      }
    }

    // 对每个启用的 Provider 执行 Presence 扫描
    const results = await Promise.allSettled(
      enabledProviders.map(async (p) => {
        try {
          const scanResult = await executePresenceScan(ctx.projectId, p.name)
          return {
            provider: p.name,
            data: scanResult,
          }
        } catch (err) {
          return {
            provider: p.name,
            data: null,
            error: err instanceof Error ? err.message : String(err),
          }
        }
      }),
    )

    const successful = results.filter(
      (r) => r.status === 'fulfilled' && r.value.data !== null,
    )

    // 聚合 Presence 结果
    const presencePayload = this.aggregate(results)

    return {
      payload: { presence: presencePayload },
      durationMs: Date.now() - startTime,
      confidence: successful.length / Math.max(enabledProviders.length, 1),
      evidenceCount: successful.length,
    }
  }

  private aggregate(results: PromiseSettledResult<{ provider: string; data: unknown; error?: string }>[]): Record<string, unknown> {
    const successful = results.filter(
      (r): r is PromiseFulfilledResult<{ provider: string; data: unknown }> =>
        r.status === 'fulfilled' && r.value.data !== null,
    )

    if (successful.length === 0) {
      return { visibility: 0, sentiment: 0, authority: 0, providerResults: [] }
    }

    return {
      visibility: 50, // 暂用默认值，后续可计算平均
      sentiment: 50,
      authority: 50,
      providerResults: successful.map((r) => ({
        provider: r.value.provider,
        presence: 'partial',
        confidence: 0.5,
      })),
    }
  }
}
