// ============================================================
// RC2 — ProviderHealthRepository 接口定义
// Provider 健康状态持久化到 Repository，不依赖内存状态
// ============================================================

import type { ProviderHealth } from '../provider/provider-health'

export interface ProviderHealthRepository {
  recordSuccess(provider: string, latency: number): Promise<void>
  recordFailure(provider: string, error: string): Promise<void>
  getHealth(provider: string): Promise<ProviderHealth>
  getAllHealth(): Promise<Map<string, ProviderHealth>>
}
