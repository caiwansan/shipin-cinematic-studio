// ============================================================
// RC2-3a — Circuit Breaker Repository 接口
// ============================================================

import type { CircuitBreakerState } from '../circuit-breaker/circuit-breaker.types'

export interface CircuitBreakerRepository {
  save(state: CircuitBreakerState): Promise<void>
  get(provider: string): Promise<CircuitBreakerState | null>
  getAll(): Promise<Map<string, CircuitBreakerState>>
  delete(provider: string): Promise<void>
}
