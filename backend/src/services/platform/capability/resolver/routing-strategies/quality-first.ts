// ============================================================
// Quality-First Routing Strategy
// Picks provider with highest qualityScore
// ============================================================

import type { RoutingStrategy } from '../resolver-interface.js'
import { RoutingStrategyType } from '../../types.js'

export const qualityFirstStrategy: RoutingStrategy = {
  name: RoutingStrategyType.QualityFirst,
  description: 'Selects the provider with the highest quality score',

  async select(contract, mappings, _request) {
    if (mappings.length === 0) {
      return { selected: null, reason: 'No provider mappings available' }
    }

    // Sort by priority (ascending = higher priority first), then by quality
    const sorted = [...mappings].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return compareQuality(a, b)
    })

    return {
      selected: sorted[0] || null,
      reason: sorted[0]
        ? `Selected by quality-first: ${sorted[0].provider} (priority: ${sorted[0].priority})`
        : 'No suitable provider found',
    }
  },
}

function compareQuality(a: { config: string | null }, b: { config: string | null }): number {
  const aQuality = extractQualityScore(a.config)
  const bQuality = extractQualityScore(b.config)
  return bQuality - aQuality // descending
}

function extractQualityScore(config: string | null): number {
  if (!config) return 0.5
  try {
    const parsed = JSON.parse(config)
    return parsed.qualityScore ?? 0.5
  } catch {
    return 0.5
  }
}
