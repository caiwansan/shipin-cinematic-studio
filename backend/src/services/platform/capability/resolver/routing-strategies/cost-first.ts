// ============================================================
// Cost-First Routing Strategy
// Picks provider with lowest cost
// ============================================================

import type { RoutingStrategy } from '../resolver-interface.js'
import { RoutingStrategyType } from '../../types.js'

export const costFirstStrategy: RoutingStrategy = {
  name: RoutingStrategyType.CostFirst,
  description: 'Selects the provider with the lowest cost',

  async select(contract, mappings, _request) {
    if (mappings.length === 0) {
      return { selected: null, reason: 'No provider mappings available' }
    }

    const sorted = [...mappings].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return compareCost(a, b)
    })

    return {
      selected: sorted[0] || null,
      reason: sorted[0]
        ? `Selected by cost-first: ${sorted[0].provider} (priority: ${sorted[0].priority})`
        : 'No suitable provider found',
    }
  },
}

function compareCost(a: { config: string | null }, b: { config: string | null }): number {
  const aCost = extractCost(a.config)
  const bCost = extractCost(b.config)
  return aCost - bCost // ascending = cheapest first
}

function extractCost(config: string | null): number {
  if (!config) return 0.01
  try {
    const parsed = JSON.parse(config)
    return parsed.costPerCall ?? 0.01
  } catch {
    return 0.01
  }
}
