// ============================================================
// RC2 — ProviderHealthService + ProviderHealth 接口
// ============================================================

import type { ProviderHealthRepository } from '../repository/provider-health.repository'

// Provider 健康状态
export interface ProviderHealth {
  provider: string
  status: 'healthy' | 'degraded' | 'unhealthy' | 'circuit_open'
  latencyP50: number
  latencyP99: number
  errorRate: number
  successCount: number
  failureCount: number
  lastChecked: string
}

export class ProviderHealthService {
  constructor(private repository: ProviderHealthRepository) {}

  async recordSuccess(provider: string, latency: number): Promise<void> {
    await this.repository.recordSuccess(provider, latency)
  }

  async recordFailure(provider: string, error: string): Promise<void> {
    await this.repository.recordFailure(provider, error)
  }

  async getHealth(provider: string): Promise<ProviderHealth> {
    return this.repository.getHealth(provider)
  }

  async isCircuitOpen(provider: string): Promise<boolean> {
    const health = await this.repository.getHealth(provider)
    return health.status === 'circuit_open'
  }

  async getAllHealth(): Promise<Map<string, ProviderHealth>> {
    return this.repository.getAllHealth()
  }
}
