// ============================================================
// Balanced Routing Strategy
// Weighted scoring across quality, cost, latency
// ============================================================

import type { RoutingStrategy } from '../resolver-interface.js'
import { RoutingStrategyType } from '../../types.js'

export interface BalancedWeights {
  quality: number
  cost: number
  latency: number
}

const defaultWeights: BalancedWeights = {
  quality: 0.4,
  cost: 0.3,
  latency: 0.3,
}

export const balancedStrategy: RoutingStrategy = {
  name: RoutingStrategyType.Balanced,
  description: 'Selects provider based on weighted score of quality, cost, and latency',

  async select(contract, mappings, _request) {
    if (mappings.length === 0) {
      return { selected: null, reason: 'No provider mappings available' }
    }

    const weights = _request.context?.priority
      ? { quality: 0.5, cost: 0.25, latency: 0.25 }
      : defaultWeights

    const scored = mappings.map(m => ({
      mapping: m,
      score: calculateScore(m, weights),
    }))

    scored.sort((a, b) => {
      if (a.mapping.priority !== b.mapping.priority) return a.mapping.priority - b.mapping.priority
      return b.score - a.score // descending = best first
    })

    return {
      selected: scored[0]?.mapping || null,
      reason: scored[0]
        ? `Selected by balanced: ${scored[0].mapping.provider} (score: ${scored[0].score.toFixed(3)})`
        : 'No suitable provider found',
    }
  },
}

function calculateScore(
  mapping: { config: string | null; priority: number },
  weights: BalancedWeights,
): number {
  const config = parseConfig(mapping.config)

  const quality = config.qualityScore ?? 0.5
  const cost = config.costPerCall ?? 0.01
  const latency = config.avgLatencyMs ?? 1000

  // Normalize: cost and latency are lower-is-better
  const costScore = Math.max(0, 1 - cost / 0.1) // cap at $0.10
  const latencyScore = Math.max(0, 1 - latency / 10000) // cap at 10s

  return (
    weights.quality * quality +
    weights.cost * costScore +
    weights.latency * latencyScore
  )
}

function parseConfig(config: string | null): Record<string, any> {
  if (!config) return {}
  try {
    return JSON.parse(config)
  } catch {
    return {}
  }
}
