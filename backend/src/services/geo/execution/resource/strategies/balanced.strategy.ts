// ============================================================
// RC3-2 — BalancedStrategy
// 综合 latency + errorRate + cost 加权计算得分，选最优
// ============================================================
// 权重分配:
//   latency    — 40%
//   errorRate  — 40%
//   cost       — 20%
//
// 得分越低越优（类似 golf 计分）
// 所有维度归一化到 [0, 1] 区间后加权求和

import type { IAllocationStrategy, AllocationContext } from './strategy.interface'

export class BalancedStrategy implements IAllocationStrategy {
  name = 'balanced'

  // 权重配置（可调整）
  private readonly WEIGHT_LATENCY = 0.4
  private readonly WEIGHT_ERROR_RATE = 0.4
  private readonly WEIGHT_COST = 0.2

  async allocate(context: AllocationContext) {
    if (context.candidates.length === 0) return null

    // 收集所有候选的指标，用于归一化
    type CandidateScore = {
      provider: string
      priority: number
      latency: number
      errorRate: number
      cost: number
    }

    const scores: CandidateScore[] = []

    for (const candidate of context.candidates) {
      const health = context.healthMap.get(candidate.provider)
      const cap = candidate.capabilities.find(
        c => c.capability === context.node.capability,
      )

      const latency = health?.latencyP50 ?? cap?.averageLatency ?? 0
      const errorRate = health?.errorRate ?? 0
      const cost = cap?.costPerToken ?? 0

      scores.push({
        provider: candidate.provider,
        priority: cap?.priority ?? 0,
        latency,
        errorRate,
        cost,
      })
    }

    // 归一化并计算加权得分
    let bestProvider: string | null = null
    let bestScore = Infinity
    let bestPriority = Infinity

    const maxLatency = Math.max(...scores.map(s => s.latency), 1)
    const maxErrorRate = Math.max(...scores.map(s => s.errorRate), 0.01)
    const maxCost = Math.max(...scores.map(s => s.cost), 0.01)

    for (const s of scores) {
      const normLatency = s.latency / maxLatency
      const normErrorRate = s.errorRate / maxErrorRate
      const normCost = s.cost / maxCost

      const score =
        this.WEIGHT_LATENCY * normLatency +
        this.WEIGHT_ERROR_RATE * normErrorRate +
        this.WEIGHT_COST * normCost

      if (score < bestScore) {
        bestScore = score
        bestProvider = s.provider
        bestPriority = s.priority
      }
    }

    if (bestProvider) {
      return {
        provider: bestProvider,
        priority: bestPriority,
        reason: 'balanced',
      }
    }

    return null
  }
}
