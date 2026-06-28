/**
 * core/circuit-breaker.ts — 熔断器（Provider 级别）
 *
 * 状态机: HEALTHY → DEGRADED → OPEN → HALF_OPEN → HEALTHY
 *
 * 防止：
 * - 平台 API 故障连锁传播
 * - 用户私有 key 失效导致的重试风暴
 * - 慢 provider 拖垮 worker
 *
 * 每个 provider（含每个用户的私有 key）独立熔断
 */

// 熔断器状态
export type CircuitState = 'HEALTHY' | 'DEGRADED' | 'OPEN' | 'HALF_OPEN'

interface CircuitBreakerState {
  state: CircuitState
  failureCount: number
  successCount: number
  totalCount: number
  lastFailureAt: number | null
  openedAt: number | null
  timeoutRate: number    // 过去 60s 超时率
  failureRate: number    // 过去 60s 失败率
  avgLatency: number     // 过去 60s 平均延迟 (ms)
}

interface CircuitBreakerOptions {
  // 触发 OPEN 的失败率阈值 (0~1)
  failureThreshold: number
  // 触发 DEGRADED 的超时率阈值 (0~1)
  timeoutThreshold: number
  // 触发 DEGRADED 的延迟阈值 (ms)
  latencyThreshold: number
  // OPEN 状态的冷却时间 (ms)
  cooldownMs: number
  // HALF_OPEN 探针超时 (ms)
  probeTimeoutMs: number
  // 统计窗口 (ms)
  windowMs: number
  // OPEN 前最少请求数（避免冷启动熔断）
  minRequestCount: number
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 0.30,    // 30% 失败率 → OPEN
  timeoutThreshold: 0.20,    // 20% 超时率 → DEGRADED
  latencyThreshold: 15000,   // 15s 平均延迟 → DEGRADED
  cooldownMs: 60_000,        // 冷却 60s
  probeTimeoutMs: 5_000,     // 探针 5s
  windowMs: 60_000,          // 60s 滑动窗口
  minRequestCount: 10,       // 最少 10 次请求才触发
}

interface WindowEntry {
  success: boolean
  latency: number
  timestamp: number
  isTimeout: boolean
}

// provider → state
const circuitStates = new Map<string, CircuitBreakerState>()
// provider → 滑动窗口记录
const circuitWindows = new Map<string, WindowEntry[]>()
// provider → options
const circuitOptions = new Map<string, CircuitBreakerOptions>()

/**
 * 注册一个 provider 熔断器
 */
export function registerProvider(
  provider: string,
  options?: Partial<CircuitBreakerOptions>
) {
  if (!circuitStates.has(provider)) {
    circuitStates.set(provider, {
      state: 'HEALTHY',
      failureCount: 0,
      successCount: 0,
      totalCount: 0,
      lastFailureAt: null,
      openedAt: null,
      timeoutRate: 0,
      failureRate: 0,
      avgLatency: 0,
    })
    circuitWindows.set(provider, [])
    circuitOptions.set(provider, { ...DEFAULT_OPTIONS, ...options })
    console.log(`[CircuitBreaker] ✅ Registered provider: ${provider}`)
  }
}

/**
 * 获取 provider 当前状态
 */
export function getProviderStatus(provider: string): {
  state: CircuitState
  stats: { successRate: number; failureRate: number; avgLatency: number; totalRequests: number }
} {
  const state = circuitStates.get(provider)
  if (!state) {
    return {
      state: 'HEALTHY',
      stats: { successRate: 1, failureRate: 0, avgLatency: 0, totalRequests: 0 },
    }
  }
  const total = state.successCount + state.failureCount
  return {
    state: state.state,
    stats: {
      successRate: total > 0 ? state.successCount / total : 1,
      failureRate: total > 0 ? state.failureCount / total : 0,
      avgLatency: state.avgLatency,
      totalRequests: total,
    },
  }
}

/**
 * 检查 provider 是否允许请求
 * @returns 是否允许 + 建议降级倍数
 */
export function canRequest(provider: string): { allowed: boolean; degradeFactor: number; reason?: string } {
  const state = circuitStates.get(provider)
  if (!state) return { allowed: true, degradeFactor: 1 }

  switch (state.state) {
    case 'OPEN': {
      // 检查冷却是否结束
      if (state.openedAt && Date.now() - state.openedAt >= (circuitOptions.get(provider)?.cooldownMs || 60_000)) {
        state.state = 'HALF_OPEN'
        console.log(`[CircuitBreaker] 🔄 ${provider} → HALF_OPEN (cooldown expired)`)
        return { allowed: true, degradeFactor: 0.5, reason: 'half_open_probe' }
      }
      return { allowed: false, degradeFactor: 0, reason: 'circuit_open' }
    }

    case 'DEGRADED':
      return { allowed: true, degradeFactor: 0.5, reason: 'degraded' }

    case 'HALF_OPEN':
      return { allowed: true, degradeFactor: 0.5, reason: 'half_open' }

    default:
      return { allowed: true, degradeFactor: 1 }
  }
}

/**
 * 记录一次请求结果（成功或失败）
 */
export function recordResult(
  provider: string,
  success: boolean,
  latency: number,
  isTimeout: boolean = false
) {
  const state = circuitStates.get(provider)
  const options = circuitOptions.get(provider)
  if (!state || !options) return

  const now = Date.now()

  // 记录到滑动窗口
  const window = circuitWindows.get(provider) || []
  window.push({ success, latency, timestamp: now, isTimeout })

  // 清理过期记录（> windowMs）
  const cutoff = now - options.windowMs
  while (window.length > 0 && window[0].timestamp < cutoff) {
    window.shift()
  }

  // 计算窗口内的统计数据
  const windowEntries = window.filter(e => e.timestamp >= cutoff)
  const totalInWindow = windowEntries.length
  const failuresInWindow = windowEntries.filter(e => !e.success).length
  const timeoutsInWindow = windowEntries.filter(e => e.isTimeout).length
  const totalLatency = windowEntries.reduce((sum, e) => sum + e.latency, 0)

  state.totalCount++
  if (success) state.successCount++
  else state.failureCount++

  state.failureRate = totalInWindow > 0 ? failuresInWindow / totalInWindow : 0
  state.timeoutRate = totalInWindow > 0 ? timeoutsInWindow / totalInWindow : 0
  state.avgLatency = totalInWindow > 0 ? totalLatency / totalInWindow : 0

  if (!success) state.lastFailureAt = now

  // 状态机转换
  if (totalInWindow >= options.minRequestCount) {
    if (state.state === 'HEALTHY' || state.state === 'DEGRADED') {
      // 条件: 失败率 > 阈值 → OPEN
      if (state.failureRate >= options.failureThreshold) {
        state.state = 'OPEN'
        state.openedAt = now
        console.warn(`[CircuitBreaker] 🔴 ${provider} → OPEN (failureRate=${(state.failureRate * 100).toFixed(1)}% >= ${(options.failureThreshold * 100).toFixed(0)}%)`)
      }
      // 条件: 超时率 > 阈值 或 延迟 > 阈值 → DEGRADED
      else if (state.timeoutRate >= options.timeoutThreshold || state.avgLatency >= options.latencyThreshold) {
        if (state.state === 'HEALTHY') {
          state.state = 'DEGRADED'
          console.warn(`[CircuitBreaker] 🟡 ${provider} → DEGRADED (timeoutRate=${(state.timeoutRate * 100).toFixed(1)}%, avgLatency=${(state.avgLatency / 1000).toFixed(1)}s)`)
        }
      }
    }

    if (state.state === 'HALF_OPEN') {
      if (!success) {
        // 探针失败 → 回到 OPEN
        state.state = 'OPEN'
        state.openedAt = now
        console.warn(`[CircuitBreaker] 🔴 ${provider} → OPEN (probe failed)`)
      } else if (state.successCount % 5 === 0) {
        // 连续成功 → 恢复 HEALTHY
        state.state = 'HEALTHY'
        state.openedAt = null
        console.log(`[CircuitBreaker] 🟢 ${provider} → HEALTHY (recovered)`)
      }
    }
  }

  // DEGRADED 状态下如果恢复 → HEALTHY
  if (state.state === 'DEGRADED' && totalInWindow >= options.minRequestCount) {
    if (state.failureRate < options.failureThreshold * 0.5 &&
        state.timeoutRate < options.timeoutThreshold * 0.5 &&
        state.avgLatency < options.latencyThreshold * 0.5) {
      state.state = 'HEALTHY'
      console.log(`[CircuitBreaker] 🟢 ${provider} → HEALTHY (recovered from degraded)`)
    }
  }
}

/**
 * 获取所有 provider 状态快照
 */
export function getAllCircuitBreakerStatus(): Record<string, {
  state: CircuitState;
  failureRate: number;
  avgLatency: number;
  totalRequests: number;
}> {
  const result: Record<string, any> = {}
  for (const [provider, state] of circuitStates) {
    result[provider] = {
      state: state.state,
      failureRate: state.failureRate,
      avgLatency: state.avgLatency,
      totalRequests: state.totalCount,
    }
  }
  return result
}

/**
 * 手动重置熔断器
 */
export function resetCircuitBreaker(provider?: string) {
  if (provider) {
    circuitStates.delete(provider)
    circuitWindows.delete(provider)
    circuitOptions.delete(provider)
    console.log(`[CircuitBreaker] 🔄 Reset provider: ${provider}`)
  } else {
    circuitStates.clear()
    circuitWindows.clear()
    circuitOptions.clear()
    console.log(`[CircuitBreaker] 🔄 Reset all providers`)
  }
}
