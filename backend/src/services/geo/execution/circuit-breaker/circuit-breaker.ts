// ============================================================
// RC2-3a — CircuitBreakerService
// ============================================================
// 严格按 spec 的 `3. 状态转换逻辑` + `6. 接口定义` 实现
//
// 架构约束:
//   Circuit Breaker MUST NOT influence routing decisions
//   只提供 availability signals（allowRequest 返回值）

import { createExecutionEvent } from '../event'
import type { ExecutionEvent } from '../types'
import type {
  BreakerStatus,
  CircuitBreakerConfig,
  CircuitBreakerState,
} from './circuit-breaker.types'
import { createDefaultBreakerState } from './circuit-breaker.types'
import type { CircuitBreakerRepository } from '../repository/circuit-breaker.repository'

// ─── Public Interface ───

export interface ICircuitBreaker {
  /** 记录一次成功 */
  recordSuccess(provider: string): Promise<{ events: ExecutionEvent[] }>

  /** 记录一次失败 */
  recordFailure(provider: string): Promise<{ events: ExecutionEvent[] }>

  /** 检查是否允许请求通过 */
  allowRequest(provider: string): Promise<boolean>

  /** 获取当前状态 */
  getState(provider: string): Promise<CircuitBreakerState>

  /** 获取所有 Provider 状态 */
  getAllStates(): Promise<Map<string, CircuitBreakerState>>

  /** 重置某个 Provider（手动恢复） */
  reset(provider: string): Promise<{ events: ExecutionEvent[] }>
}

// ─── Implementation ───

export class CircuitBreakerService implements ICircuitBreaker {
  constructor(
    private repository: CircuitBreakerRepository,
    private config: CircuitBreakerConfig = createDefaultBreakerConfig(),
    private graphId?: string,
    private executionId?: string,
  ) {}

  // ── recordSuccess ──

  async recordSuccess(provider: string): Promise<{ events: ExecutionEvent[] }> {
    const state = await this.loadState(provider)
    const events: ExecutionEvent[] = []

    if (state.status === 'HALF_OPEN') {
      // HALF_OPEN → CLOSED: 探针成功，恢复
      const newState = createDefaultBreakerState(provider)
      newState.lastSuccessAt = new Date().toISOString()
      await this.repository.save(newState)

      const recoveryTime = state.openedAt
        ? Date.now() - new Date(state.openedAt).getTime()
        : 0
      events.push(
        this.createEvent('circuit_breaker_closed', {
          provider,
          recoveryTime,
        }),
      )
      return { events }
    }

    // CLOSED: 正常成功，重置计数器
    state.failureCount = 0
    state.lastSuccessAt = new Date().toISOString()
    await this.repository.save(state)
    return { events }
  }

  // ── recordFailure ──

  async recordFailure(provider: string): Promise<{ events: ExecutionEvent[] }> {
    const state = await this.loadState(provider)
    const events: ExecutionEvent[] = []

    if (state.status === 'HALF_OPEN') {
      // HALF_OPEN → OPEN: 探针失败，回退熔断
      state.status = 'OPEN'
      state.failureCount++
      state.openedAt = new Date().toISOString()
      state.halfOpenRequests = 0
      state.lastFailureAt = new Date().toISOString()
      await this.repository.save(state)

      events.push(
        this.createEvent('circuit_breaker_open', {
          provider,
          failureCount: state.failureCount,
          threshold: this.config.failureThreshold,
          openedAt: state.openedAt,
          probeFailed: true,
        }),
      )
      return { events }
    }

    // CLOSED: 记录失败
    state.failureCount++
    state.lastFailureAt = new Date().toISOString()

    if (state.failureCount >= this.config.failureThreshold) {
      state.status = 'OPEN'
      state.openedAt = new Date().toISOString()
      await this.repository.save(state)

      events.push(
        this.createEvent('circuit_breaker_open', {
          provider,
          failureCount: state.failureCount,
          threshold: this.config.failureThreshold,
          openedAt: state.openedAt,
        }),
      )
    } else {
      await this.repository.save(state)
    }

    return { events }
  }

  // ── allowRequest ──

  async allowRequest(provider: string): Promise<boolean> {
    const state = await this.loadState(provider)

    if (state.status === 'CLOSED') {
      return true
    }

    if (state.status === 'OPEN') {
      const elapsed = Date.now() - new Date(state.openedAt!).getTime()
      if (elapsed >= this.config.recoveryTimeoutMs) {
        // OPEN → HALF_OPEN: 到恢复时间
        if (state.halfOpenRequests < this.config.halfOpenMaxRequests) {
          state.status = 'HALF_OPEN'
          state.halfOpenRequests++

          // 生成 half_open 事件
          const events = [
            this.createEvent('circuit_breaker_half_open', {
              provider,
              elapsed,
              recoveryTimeout: this.config.recoveryTimeoutMs,
            }),
          ]
          await this.repository.save(state)
          // 事件已写入 repository（不在此返回但作为 side effect）
          return true
        }
        // 已有探针在进行
        return false
      }
      // 还在熔断时间内
      state.rejectedCount++
      await this.repository.save(state)
      return false
    }

    if (state.status === 'HALF_OPEN') {
      if (state.halfOpenRequests < this.config.halfOpenMaxRequests) {
        state.halfOpenRequests++
        await this.repository.save(state)
        return true
      }
      return false // 探针已满，等待
    }

    return true // fallback
  }

  // ── getState ──

  async getState(provider: string): Promise<CircuitBreakerState> {
    const existing = await this.repository.get(provider)
    return existing || createDefaultBreakerState(provider)
  }

  // ── getAllStates ──

  async getAllStates(): Promise<Map<string, CircuitBreakerState>> {
    return this.repository.getAll()
  }

  // ── reset ──

  async reset(provider: string): Promise<{ events: ExecutionEvent[] }> {
    const state = createDefaultBreakerState(provider)
    state.lastSuccessAt = new Date().toISOString()
    await this.repository.save(state)

    return {
      events: [
        this.createEvent('circuit_breaker_closed', {
          provider,
          recoveryTime: 0,
          manual: true,
        }),
      ],
    }
  }

  // ── Private Helpers ──

  private async loadState(provider: string): Promise<CircuitBreakerState> {
    const existing = await this.repository.get(provider)
    return existing || createDefaultBreakerState(provider)
  }

  private createEvent(
    type: string,
    data: Record<string, unknown>,
  ): ExecutionEvent {
    return createExecutionEvent({
      executionId: this.executionId || `cb-${Date.now()}`,
      graphId: this.graphId || `cb-graph-${Date.now()}`,
      type: type as any,
      data,
    })
  }
}
