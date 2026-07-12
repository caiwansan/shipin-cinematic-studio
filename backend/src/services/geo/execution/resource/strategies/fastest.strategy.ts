// ============================================================
// RC3-2 — FastestStrategy
// 选择 latencyP50 最低的 Provider
// ============================================================
// 选择逻辑:
//   1. 优先使用 health 提供的实时 latencyP50
//   2. 无 health 数据时，fallback 到注册的 averageLatency
//   3. 如果都没有，标记为 Infinity（不选）

import type { IAllocationStrategy, AllocationContext } from './strategy.interface'

export class FastestStrategy implements IAllocationStrategy {
  name = 'fastest'

  async allocate(context: AllocationContext) {
    let bestProvider: string | null = null
    let bestLatency = Infinity
    let bestPriority = Infinity

    for (const candidate of context.candidates) {
      const health = context.healthMap.get(candidate.provider)
      const cap = candidate.capabilities.find(
        c => c.capability === context.node.capability,
      )
      const latency =
        health?.latencyP50 ||
        cap?.averageLatency ||
        Infinity

      if (latency < bestLatency) {
        bestLatency = latency
        bestProvider = candidate.provider
        bestPriority = cap?.priority ?? 0
      }
    }

    if (bestProvider) {
      return {
        provider: bestProvider,
        priority: bestPriority,
        reason: 'fastest',
      }
    }

    return null
  }
}
