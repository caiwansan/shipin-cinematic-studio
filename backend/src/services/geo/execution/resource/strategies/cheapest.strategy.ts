// ============================================================
// RC3-2 — CheapestStrategy
// 选择 costPerToken 最低的 Provider
// ============================================================
// 选择逻辑:
//   1. 优先使用注册的 costPerToken
//   2. 如果能力未定义 cost，标记为 Infinity（不选）

import type { IAllocationStrategy, AllocationContext } from './strategy.interface'

export class CheapestStrategy implements IAllocationStrategy {
  name = 'cheapest'

  async allocate(context: AllocationContext) {
    let bestProvider: string | null = null
    let bestCost = Infinity
    let bestPriority = Infinity

    for (const candidate of context.candidates) {
      const cap = candidate.capabilities.find(
        c => c.capability === context.node.capability,
      )
      const cost = cap?.costPerToken ?? Infinity

      if (cost < bestCost) {
        bestCost = cost
        bestProvider = candidate.provider
        bestPriority = cap?.priority ?? 0
      }
    }

    if (bestProvider) {
      return {
        provider: bestProvider,
        priority: bestPriority,
        reason: 'cheapest',
      }
    }

    return null
  }
}
