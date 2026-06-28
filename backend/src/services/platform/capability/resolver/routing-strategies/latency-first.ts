// ============================================================
// Latency-First Routing Strategy
// Picks provider with lowest latency
// ============================================================

import type { RoutingStrategy } from '../resolver-interface.js'
import { RoutingStrategyType } from '../../types.js'

export const latencyFirstStrategy: RoutingStrategy = {
  name: RoutingStrategyType.LatencyFirst,
  description: 'Selects the provider with the lowest latency',

  async select(contract, mappings, _request) {
    if (mappings.length === 0) {
      return { selected: null, reason: 'No provider mappings available' }
    }

    const sorted = [...mappings].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return compareLatency(a, b)
    })

    return {
      selected: sorted[0] || null,
      reason: sorted[0]
        ? `Selected by latency-first: ${sorted[0].provider} (priority: ${sorted[0].priority})`
        : 'No suitable provider found',
    }
  },
}

function compareLatency(a: { config: string | null }, b: { config: string | null }): number {
  const aLatency = extractLatency(a.config)
  const bLatency = extractLatency(b.config)
  return aLatency - bLatency // ascending = fastest first
}

function extractLatency(config: string | null): number {
  if (!config) return 5000
  try {
    const parsed = JSON.parse(config)
    return parsed.avgLatencyMs ?? 5000
  } catch {
    return 5000
  }
}
