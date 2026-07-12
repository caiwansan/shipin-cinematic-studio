// ============================================================
// RC2 — CapabilityRouter
// 按能力（capability）选择 Provider，不绑定具体 Provider 实现
// ============================================================

import type { ProviderPolicy } from '../types'
import { ProviderRegistry } from './provider-registry'
import { ProviderHealthService } from './provider-health'
import type { ProviderRegistration, RouterContext } from './types'

export class CapabilityRouter {
  constructor(
    private registry: ProviderRegistry,
    private healthService: ProviderHealthService,
  ) {}

  /**
   * 根据所需能力和策略解析出最佳 Provider
   * Runtime 层不感知具体 Provider 实现细节
   */
  async resolve(
    capability: string,
    policy: ProviderPolicy,
    context?: RouterContext,
  ): Promise<string> {
    const candidates = this.registry.getProvidersByCapability(capability)
    if (candidates.length === 0) {
      throw new Error(`No provider found for capability: ${capability}`)
    }

    switch (policy) {
      case 'FASTEST':
        return this.selectFastest(candidates, capability)
      case 'CHEAPEST':
        return this.selectCheapest(candidates, capability)
      case 'MOST_RELIABLE':
        return this.selectMostReliable(candidates, capability)
      case 'LOCAL_ONLY':
        return this.selectLocal(candidates, capability)
      case 'CN_PROVIDER_FIRST':
        return this.selectCNFirst(candidates, capability)
      default:
        return candidates[0].provider
    }
  }

  private async selectFastest(
    candidates: ProviderRegistration[],
    capability: string,
  ): Promise<string> {
    let best = candidates[0].provider
    let bestLatency = Infinity

    for (const c of candidates) {
      const health = await this.healthService.getHealth(c.provider)
      const avgLatency = c.capabilities.find(
        cap => cap.capability === capability,
      )?.averageLatency
      const latency = health.latencyP50 || avgLatency || Infinity

      if (latency < bestLatency) {
        bestLatency = latency
        best = c.provider
      }
    }

    return best
  }

  private async selectCheapest(
    candidates: ProviderRegistration[],
    capability: string,
  ): Promise<string> {
    let best = candidates[0].provider
    let bestCost = Infinity

    for (const c of candidates) {
      const cap = c.capabilities.find(cap => cap.capability === capability)
      if (cap && cap.costPerToken < bestCost) {
        bestCost = cap.costPerToken
        best = c.provider
      }
    }

    return best
  }

  private async selectMostReliable(
    candidates: ProviderRegistration[],
    capability: string,
  ): Promise<string> {
    // RC2-3 完善：从 health service 获取成功率和错误率
    // 目前返回第一个候选
    let best = candidates[0].provider
    let bestErrorRate = Infinity

    for (const c of candidates) {
      const health = await this.healthService.getHealth(c.provider)
      if (health.errorRate < bestErrorRate) {
        bestErrorRate = health.errorRate
        best = c.provider
      }
    }

    return best
  }

  private async selectLocal(
    candidates: ProviderRegistration[],
    _capability: string,
  ): Promise<string> {
    const local = candidates.find(
      c =>
        c.provider.startsWith('local-') || c.provider.startsWith('ollama-'),
    )
    return local?.provider || candidates[0].provider
  }

  private async selectCNFirst(
    candidates: ProviderRegistration[],
    _capability: string,
  ): Promise<string> {
    // 优先选择中国 Provider — 使用通用列表，不硬编码业务逻辑
    const cnProviders = [
      'deepseek',
      'doubao',
      'xinghuo',
      'qwen',
      'kimi',
      'tongyi',
      'wenxin',
      'baidu',
      'yuantai',
    ]
    for (const cn of cnProviders) {
      const found = candidates.find(c => c.provider === cn)
      if (found) return found.provider
    }
    return candidates[0].provider
  }
}
