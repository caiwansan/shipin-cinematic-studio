// ============================================================
// RC2-3a — Circuit Breaker Repository 内存实现
// ============================================================

import type { CircuitBreakerState } from '../circuit-breaker/circuit-breaker.types'
import type { CircuitBreakerRepository } from './circuit-breaker.repository'

export class InMemoryCircuitBreakerRepository implements CircuitBreakerRepository {
  private store = new Map<string, CircuitBreakerState>()

  async save(state: CircuitBreakerState): Promise<void> {
    this.store.set(state.provider, { ...state })
  }

  async get(provider: string): Promise<CircuitBreakerState | null> {
    const state = this.store.get(provider)
    return state ? { ...state } : null
  }

  async getAll(): Promise<Map<string, CircuitBreakerState>> {
    return new Map(this.store)
  }

  async delete(provider: string): Promise<void> {
    this.store.delete(provider)
  }
}
