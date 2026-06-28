// ============================================================
// Cost-First Resolver Strategy
// KMKI-PLAT-008: Prefer lowest cost
// ============================================================

import type { ResolverStrategy, ResourceContract, ResourceCapabilityMatrix, ResourceHealth } from '../../types'
import type { ResolveRequest } from '../../types'

export const costFirstStrategy: ResolverStrategy = {
  name: 'cost-first',
  description: 'Select the resource with the lowest cost',

  score(
    resource: ResourceContract,
    matrix: ResourceCapabilityMatrix | null,
    health: ResourceHealth | null,
    context: ResolveRequest
  ): number {
    let score = 50 // base

    // Cost multiplier — lower is better
    const costMultiplier = matrix?.costMultiplier ?? 1.0
    score += (1 / Math.max(0.01, costMultiplier)) * 30

    // Vendor pricing — prefer free / cheap
    const vendorPricing: Record<string, number> = {
      ollama: 100,    // free local
      openai: 40,
      deepseek: 60,   // cheaper
      gemini: 45,
      claude: 30,     // expensive
    }
    score += vendorPricing[resource.vendor] || 35

    // Health bonus
    if (health) {
      if (health.status === 'healthy') score += 10
      else if (health.status === 'degraded') score -= 5
    }

    return Math.max(0, score)
  },
}
