/**
 * governance/system-health.ts — 统一系统健康评分
 *
 * 单一指标代表系统状态（0-100）
 * 公式: 30%成功率 + 20%延迟 + 20%成本效率 + 20%稳定性 + 10%队列效率
 */

import { getMetricsSnapshot } from '../observability/metrics.js'
import { getSystemHealth as getBackpressureHealth } from '../core/backpressure.js'
import { getAllCircuitBreakerStatus } from '../core/circuit-breaker.js'

export interface UnifiedHealthScore {
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'
  score: number
  dimensions: {
    success: number
    latency: number
    cost: number
    stability: number
    queue: number
  }
}

/**
 * 计算统一健康评分
 */
export function getSystemHealthScore(): UnifiedHealthScore {
  const metrics = getMetricsSnapshot()
  const health = getBackpressureHealth()
  const providers = getAllCircuitBreakerStatus()

  // 成功率维度 (30%)
  const successScore = metrics.system.successRate * 100
  const successDim = Math.round(successScore * 0.3)

  // 延迟维度 (20%) — 低于 3s 满分，30s 以上 0 分
  const latencyRatio = Math.max(0, 1 - metrics.system.p95Latency / 30_000)
  const latencyDim = Math.round(latencyRatio * 20)

  // 成本效率 (20%) — provider 平均成本越低越好
  const providerList = Object.values(metrics.providers)
  const avgCost = providerList.length > 0
    ? providerList.reduce((s: number, p: any) => s + (p.costEstimate || 0), 0) / providerList.length
    : 0
  const costScore = Math.max(0, 1 - avgCost / 0.05)
  const costDim = Math.round(costScore * 20)

  // 稳定性 (20%) — 熔断器 OPEN 的数量越少越好
  const providerEntries = Object.entries(providers)
  const openCount = providerEntries.filter(([_, s]) => s.state === 'OPEN').length
  const totalCount = Math.max(providerEntries.length, 1)
  const stabilityRatio = 1 - (openCount / totalCount)
  const stabilityDim = Math.round(stabilityRatio * 20)

  // 队列效率 (10%)
  const queueRatio = Math.max(0, 1 - health.queueCapacityRatio)
  const queueDim = Math.round(queueRatio * 10)

  const total = successDim + latencyDim + costDim + stabilityDim + queueDim

  const status: UnifiedHealthScore['status'] =
    total >= 70 ? 'HEALTHY' :
    total >= 40 ? 'DEGRADED' : 'CRITICAL'

  return {
    status,
    score: total,
    dimensions: {
      success: successDim,
      latency: latencyDim,
      cost: costDim,
      stability: stabilityDim,
      queue: queueDim,
    },
  }
}
