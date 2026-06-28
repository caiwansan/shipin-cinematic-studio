// ============================================================
// Latency-First Resolver Strategy
// KMKI-PLAT-008: Prefer lowest latency
// ============================================================

import type { ResolverStrategy, ResourceContract, ResourceCapabilityMatrix, ResourceHealth } from '../../types'
import type { ResolveRequest } from '../../types'

export const latencyFirstStrategy: ResolverStrategy = {
  name: 'latency-first',
  description: 'Select the resource with the lowest latency',

  score(
    resource: ResourceContract,
    matrix: ResourceCapabilityMatrix | null,
    health: ResourceHealth | null,
    context: ResolveRequest
  ): number {
    let score = 50 // base

    // Latency — lower is better
    if (health?.latencyMs) {
      const latencyMs = health.latencyMs
      if (latencyMs < 200) score += 50       // excellent
      else if (latencyMs < 500) score += 40  // good
      else if (latencyMs < 1000) score += 25 // acceptable
      else if (latencyMs < 3000) score += 10 // slow
      else score -= 10                        // very slow
    } else {
      score += 20 // unknown — assume reasonable
    }

    // Vendor latency reputation
    const vendorLatency: Record<string, number> = {
      ollama: 60,     // local = fastest
      openai: 35,
      deepseek: 40,
      gemini: 30,
      claude: 25,
    }
    score += vendorLatency[resource.vendor] || 20

    // Health bonus
    if (health) {
      if (health.status === 'healthy') score += 10
      else if (health.status === 'degraded') score -= 10
    }

    return Math.max(0, score)
  },
}
