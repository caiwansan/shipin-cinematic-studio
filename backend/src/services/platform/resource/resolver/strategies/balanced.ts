// ============================================================
// Balanced Resolver Strategy
// KMKI-PLAT-008: Balance quality, cost, and latency
// ============================================================

import type { ResolverStrategy, ResourceContract, ResourceCapabilityMatrix, ResourceHealth } from '../../types'
import type { ResolveRequest } from '../../types'

export const balancedStrategy: ResolverStrategy = {
  name: 'balanced',
  description: 'Balance quality score, cost, and latency for optimal selection',

  score(
    resource: ResourceContract,
    matrix: ResourceCapabilityMatrix | null,
    health: ResourceHealth | null,
    context: ResolveRequest
  ): number {
    let score = 50 // base

    // Quality (40% weight)
    const quality = matrix?.qualityScore ?? 0.5
    score += quality * 40

    // Cost (30% weight)
    const costMultiplier = matrix?.costMultiplier ?? 1.0
    score += (1 / Math.max(0.01, costMultiplier)) * 15
    const cheapVendors = ['ollama', 'deepseek']
    if (cheapVendors.includes(resource.vendor)) score += 10

    // Latency (20% weight)
    if (health?.latencyMs) {
      const latencyMs = health.latencyMs
      if (latencyMs < 500) score += 20
      else if (latencyMs < 2000) score += 12
      else if (latencyMs < 5000) score += 5
    } else {
      score += 10
    }

    // Health (10% weight)
    if (health) {
      if (health.status === 'healthy') score += 10
      else if (health.status === 'degraded') score += 3
    } else {
      score += 5
    }

    return Math.max(0, score)
  },
}
