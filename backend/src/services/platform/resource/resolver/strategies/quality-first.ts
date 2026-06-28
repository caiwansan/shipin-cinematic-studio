// ============================================================
// Quality-First Resolver Strategy
// KMKI-PLAT-008: Prefer highest qualityScore
// ============================================================

import type { ResolverStrategy, ResourceContract, ResourceCapabilityMatrix, ResourceHealth } from '../../types'
import type { ResolveRequest } from '../../types'

export const qualityFirstStrategy: ResolverStrategy = {
  name: 'quality-first',
  description: 'Select the resource with the highest quality score',

  score(
    resource: ResourceContract,
    matrix: ResourceCapabilityMatrix | null,
    health: ResourceHealth | null,
    context: ResolveRequest
  ): number {
    let score = 0

    // Base: quality score (0-1), default 0.5
    const quality = matrix?.qualityScore ?? 0.5
    score += quality * 100

    // Health bonus
    if (health) {
      if (health.status === 'healthy') score += 20
      else if (health.status === 'degraded') score += 5
    } else {
      score += 10 // unknown health, neutral
    }

    // Latency penalty (higher latency = lower score)
    if (health?.latencyMs) {
      const latencyPenalty = Math.min(30, health.latencyMs / 100)
      score -= latencyPenalty
    }

    return Math.max(0, score)
  },
}
