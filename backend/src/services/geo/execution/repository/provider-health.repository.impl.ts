// ============================================================
// RC2 — InMemoryProviderHealthRepository
// 内存实现，支持初始化默认值
// ============================================================

import type { ProviderHealthRepository } from './provider-health.repository'
import type { ProviderHealth } from '../provider/provider-health'

export class InMemoryProviderHealthRepository
  implements ProviderHealthRepository
{
  private healthMap: Map<string, ProviderHealth> = new Map()

  constructor(defaults?: Map<string, Partial<ProviderHealth>>) {
    if (defaults) {
      for (const [provider, partial] of defaults) {
        this.healthMap.set(provider, this.createDefaultHealth(provider, partial))
      }
    }
  }

  private createDefaultHealth(
    provider: string,
    overrides?: Partial<ProviderHealth>,
  ): ProviderHealth {
    return {
      provider,
      status: 'healthy',
      latencyP50: 0,
      latencyP99: 0,
      errorRate: 0,
      successCount: 0,
      failureCount: 0,
      lastChecked: new Date().toISOString(),
      ...overrides,
    }
  }

  private ensureHealth(provider: string): ProviderHealth {
    let health = this.healthMap.get(provider)
    if (!health) {
      health = this.createDefaultHealth(provider)
      this.healthMap.set(provider, health)
    }
    return health
  }

  async recordSuccess(provider: string, latency: number): Promise<void> {
    const health = this.ensureHealth(provider)
    health.successCount++
    health.lastChecked = new Date().toISOString()

    // 滑动平均 latencyP50
    if (health.latencyP50 === 0) {
      health.latencyP50 = latency
    } else {
      health.latencyP50 = health.latencyP50 * 0.9 + latency * 0.1
    }

    // 滑动平均 latencyP99 (简化：取 max)
    if (latency > health.latencyP99) {
      health.latencyP99 = latency
    }

    // 滑动平均 errorRate
    const total = health.successCount + health.failureCount
    health.errorRate = total > 0 ? health.failureCount / total : 0

    // 健康状态判定
    if (health.errorRate > 0.5) {
      health.status = 'unhealthy'
    } else if (health.errorRate > 0.2) {
      health.status = 'degraded'
    } else {
      health.status = 'healthy'
    }
  }

  async recordFailure(provider: string, _error: string): Promise<void> {
    const health = this.ensureHealth(provider)
    health.failureCount++
    health.lastChecked = new Date().toISOString()

    // 滑动平均 errorRate
    const total = health.successCount + health.failureCount
    health.errorRate = total > 0 ? health.failureCount / total : 1

    // 健康状态判定
    if (health.errorRate > 0.5) {
      health.status = 'unhealthy'
    } else if (health.errorRate > 0.2) {
      health.status = 'degraded'
    } else {
      health.status = 'healthy'
    }
  }

  async getHealth(provider: string): Promise<ProviderHealth> {
    return { ...this.ensureHealth(provider) }
  }

  async getAllHealth(): Promise<Map<string, ProviderHealth>> {
    const result = new Map<string, ProviderHealth>()
    for (const [key, value] of this.healthMap) {
      result.set(key, { ...value })
    }
    return result
  }

  clear(): void {
    this.healthMap.clear()
  }
}
