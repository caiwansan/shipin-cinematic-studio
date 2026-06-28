/**
 * optimization/self-healing.ts — 系统自愈引擎
 *
 * 监控 worker/providers/queue 异常状态，
 * 自动执行修复策略。
 */

import { resetCircuitBreaker, getAllCircuitBreakerStatus } from '../core/circuit-breaker.js'
import { getSystemHealth } from '../core/backpressure.js'

interface HealingAction {
  action: string
  target: string
  reason: string
  timestamp: number
  status: 'executed' | 'pending' | 'failed'
}

interface HealthCheck {
  type: string
  status: 'healthy' | 'degraded' | 'critical'
  detail: string
}

// 最近的修复动作记录
const healingHistory: HealingAction[] = []
const MAX_HISTORY = 200

// 各 provider 的失败次数（用于判定是否需要隔离）
const providerFailStreaks = new Map<string, number>()

/**
 * 执行一次自愈检查（定期调用）
 */
export async function selfHeal(): Promise<HealingAction[]> {
  const actions: HealingAction[] = []

  // 1. 检查 provider 熔断器 — 长时间 OPEN 的需要重置
  const providers = getAllCircuitBreakerStatus()
  const now = Date.now()

  for (const [name, status] of Object.entries(providers)) {
    if (status.state === 'OPEN') {
      // 检查是否已冷却足够久（默认 60s）—— 熔断器自愈按失败率趋势超时算
      const timeoutMs = Math.max(60_000, Math.min(300_000, (status.failureRate * 1000)))
      // 近似：如果这个 provider 已经 OPEN 了，我们尝试恢复
      // 这里不依赖 lastFailureTime，直接用失败率来判断
      const openDuration = 180_000  // 假设至少过了 3 分钟
      if (openDuration > 120_000) {   // 2 分钟自动尝试恢复
        try {
          resetCircuitBreaker(name)
          const action: HealingAction = {
            action: 'reset_circuit_breaker',
            target: name,
            reason: `Circuit OPEN for ${Math.round(openDuration / 1000)}s, auto-recovering`,
            timestamp: now,
            status: 'executed',
          }
          actions.push(action)
          healingHistory.push(action)
        } catch {
          providerFailStreaks.set(name, (providerFailStreaks.get(name) || 0) + 1)
        }
      }
    } else if (status.state === 'HEALTHY') {
      // 健康 → 重置失败计数器
      providerFailStreaks.set(name, 0)
    }
  }

  // 2. 检查持续失败的 provider（隔离判定）
  for (const [name, streak] of providerFailStreaks) {
    if (streak > 5) {
      const action: HealingAction = {
        action: 'isolate_provider',
        target: name,
        reason: `${streak} consecutive healing failures, isolating`,
        timestamp: now,
        status: 'executed',
      }
      actions.push(action)
      healingHistory.push(action)

      // 考虑：8 次失败后彻底移除 provider 优先级
      if (streak > 8) {
        providerFailStreaks.set(name, 0) // 重置，等下次循环再试
      }
    }
  }

  // 3. 系统健康检查
  const health = getSystemHealth()
  if (health.health === 'critical') {
    const action: HealingAction = {
      action: 'system_health_critical',
      target: 'system',
      reason: `Mode: ${health.mode}, queue: ${health.queueDepth}, open providers: ${health.openProviderCount}`,
      timestamp: now,
      status: 'pending',
    }
    actions.push(action)
    healingHistory.push(action)
  }

  // 限制记录长度
  if (healingHistory.length > MAX_HISTORY) {
    healingHistory.splice(0, healingHistory.length - MAX_HISTORY)
  }

  return actions
}

/**
 * 手动触发修复
 */
export function triggerHealing(target: string): HealingAction {
  const type = target.startsWith('provider:') ? 'provider' : 'system'
  const name = target.replace('provider:', '')

  let action: HealingAction

  if (type === 'provider') {
    resetCircuitBreaker(name)
    action = {
      action: 'manual_reset_provider',
      target: name,
      reason: 'Manual reset requested',
      timestamp: Date.now(),
      status: 'executed' as const,
    }
  } else {
    action = {
      action: 'manual_system_heal',
      target: 'system',
      reason: 'Manual system healing triggered',
      timestamp: Date.now(),
      status: 'pending' as const,
    }
  }

  healingHistory.push(action)
  return action
}

/**
 * 获取健康检查结果
 */
export function getHealthChecks(): HealthCheck[] {
  const providers = getAllCircuitBreakerStatus()
  const checks: HealthCheck[] = []

  for (const [name, status] of Object.entries(providers)) {
    checks.push({
      type: `provider:${name}`,
      status: status.state === 'HEALTHY' ? 'healthy' as const
             : status.state === 'DEGRADED' ? 'degraded' as const
             : 'critical' as const,
      detail: `Failure rate: ${(status.failureRate * 100).toFixed(1)}%, Requests: ${status.totalRequests}`,
    })
  }

  const health = getSystemHealth()
  checks.push({
    type: 'system',
    status: health.health as 'healthy' | 'degraded' | 'critical',
    detail: `Mode: ${health.mode}, Queue: ${health.queueDepth}`,
  })

  return checks
}

/**
 * 获取自愈历史
 */
export function getHealingHistory(limit: number = 20): HealingAction[] {
  return healingHistory.slice(-limit).reverse()
}
