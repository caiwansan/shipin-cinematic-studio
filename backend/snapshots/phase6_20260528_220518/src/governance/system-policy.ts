/**
 * governance/system-policy.ts — 全局系统策略引擎
 *
 * 定义系统级"宪法规则"，任何 optimizer 决策不得违反。
 * 约束：成本上限、延迟上限、成功率下限、provider 多样性下限。
 */

import { prisma } from '../utils/index.js'
import { OptimizationProposal } from './optimization-budget.js'
import { getMetricsSnapshot } from '../observability/metrics.js'
import { getSystemHealth } from '../core/backpressure.js'

// ======== 策略定义 ========

interface SystemPolicy {
  name: string
  enabled: boolean
  check: (proposal: OptimizationProposal) => Promise<{ allowed: boolean; reason?: string }>
}

const policies: SystemPolicy[] = []

// ======== 用户成本上限 ========
policies.push({
  name: 'COST_CEILING_PER_USER',
  enabled: true,
  check: async () => {
    try {
      const metrics = getMetricsSnapshot()
      // 使用 provider 成本估算
      const totalCost = Object.values(metrics.providers).reduce((s: number, p: any) => s + (p.costEstimate || 0), 0)
      if (totalCost > 100) { // $100 硬上限
        return { allowed: false, reason: `Total cost $${totalCost.toFixed(2)} exceeds $100 ceiling` }
      }
    } catch {}
    return { allowed: true }
  },
})

// ======== 最大 P95 延迟 ========
policies.push({
  name: 'MAX_LATENCY_P95',
  enabled: true,
  check: async () => {
    try {
      const metrics = getMetricsSnapshot()
      if (metrics.system.p95Latency > 30_000) {
        return { allowed: false, reason: `P95 latency ${metrics.system.p95Latency}ms exceeds 30s ceiling` }
      }
    } catch {}
    return { allowed: true }
  },
})

// ======== 最小成功率 ========
policies.push({
  name: 'MIN_SUCCESS_RATE',
  enabled: true,
  check: async () => {
    try {
      const metrics = getMetricsSnapshot()
      if (metrics.system.successRate < 0.5) {
        return { allowed: false, reason: `Success rate ${(metrics.system.successRate * 100).toFixed(0)}% below 50%` }
      }
    } catch {}
    return { allowed: true }
  },
})

// ======== 最大队列深度 ========
policies.push({
  name: 'MAX_QUEUE_DEPTH',
  enabled: true,
  check: async () => {
    try {
      const health = getSystemHealth()
      if (health.queueDepth > 500) {
        return { allowed: false, reason: `Queue depth ${health.queueDepth} exceeds 500 ceiling` }
      }
    } catch {}
    return { allowed: true }
  },
})

// ======== 最小 Provider 多样性 ========
policies.push({
  name: 'MIN_PROVIDER_DIVERSITY',
  enabled: true,
  check: async (proposal) => {
    // 如果提议将所有流量导向单一 provider，拒绝
    if (proposal.action === 'router_update' && proposal.params.forceProvider) {
      return { allowed: false, reason: 'Cannot force all traffic to single provider (diversity violation)' }
    }
    return { allowed: true }
  },
})

// ======== 高成本 alert ========
policies.push({
  name: 'COST_SPIKE_PROTECTION',
  enabled: true,
  check: async (proposal) => {
    if (proposal.action === 'router_update' && (proposal.expectedImpact.costChange || 0) > 0.25) {
      return { allowed: false, reason: `Cost increase ${((proposal.expectedImpact.costChange || 0) * 100).toFixed(0)}% exceeds 25% spike limit` }
    }
    return { allowed: true }
  },
})

/**
 * 检查提议是否违反任何策略
 */
export async function checkSystemPolicy(proposal: OptimizationProposal): Promise<{
  allowed: boolean
  reason?: string
}> {
  for (const policy of policies) {
    if (!policy.enabled) continue
    const result = await policy.check(proposal)
    if (!result.allowed) {
      return result
    }
  }
  return { allowed: true }
}

/**
 * 获取所有策略状态
 */
export function getPolicies() {
  return policies.map(p => ({
    name: p.name,
    enabled: p.enabled,
  }))
}

/**
 * 启用/禁用策略
 */
export function setPolicyEnabled(name: string, enabled: boolean) {
  const policy = policies.find(p => p.name === name)
  if (policy) {
    policy.enabled = enabled
    return true
  }
  return false
}
