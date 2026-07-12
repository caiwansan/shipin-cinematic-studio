// ============================================================
// RC2-3a — Circuit Breaker State Machine Types
// ============================================================
// 严格按 spec 的 `5. 数据模型` + `2. 配置参数` 定义

export type BreakerStatus = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerConfig {
  /** 连续失败阈值: 超过此值进入 OPEN */
  failureThreshold: number

  /** 熔断恢复时间 (ms): 超过此时间进入 HALF_OPEN */
  recoveryTimeoutMs: number

  /** HALF_OPEN 状态下允许的最大探针请求数 */
  halfOpenMaxRequests: number

  /** 滑动窗口 (ms): 只统计此窗口内的请求 */
  slidingWindowMs: number
}

export interface CircuitBreakerState {
  provider: string
  status: BreakerStatus
  failureCount: number
  openedAt: string | null      // OPEN 状态的开始时间
  halfOpenRequests: number     // HALF_OPEN 已发出的探针数
  rejectedCount: number        // OPEN 期间拒绝的请求数（统计用）
  lastFailureAt: string | null
  lastSuccessAt: string | null
}

export interface SlidingWindowRecord {
  timestamp: number
  success: boolean
}

export function createDefaultBreakerState(provider: string): CircuitBreakerState {
  return {
    provider,
    status: 'CLOSED',
    failureCount: 0,
    openedAt: null,
    halfOpenRequests: 0,
    rejectedCount: 0,
    lastFailureAt: null,
    lastSuccessAt: null,
  }
}

export function createDefaultBreakerConfig(overrides?: Partial<CircuitBreakerConfig>): CircuitBreakerConfig {
  return {
    failureThreshold: 5,
    recoveryTimeoutMs: 30000,
    halfOpenMaxRequests: 1,
    slidingWindowMs: 60000,
    ...overrides,
  }
}
