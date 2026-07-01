// ============================================================
// AI Presence Engine — PresenceEngine
// P0-T005: AI Presence Engine Foundation
// P0-T005.1: 12 Platform Extension — added platformGroups to output
//
// SSOT: This is the one and only entry point for AI presence
// information. All presence data flows through checkAll() or
// checkProvider(). Pages consume AIPresenceResult only.
// ============================================================

import { ProviderAdapterRegistry } from './registry.js'
import { PresenceContext, AIPresenceResult, ProviderResult } from './types.js'

export class PresenceEngine {
  constructor(private registry: ProviderAdapterRegistry) {}

  /**
   * Check presence across all registered, presence-capable providers.
   * This is the single source of truth for AI presence data.
   */
  async checkAll(context: PresenceContext): Promise<AIPresenceResult> {
    const adapters = this.registry.getPresenceCapable()
    const checkedAt = new Date().toISOString()

    // Run all adapter checks in parallel
    const results = await Promise.all(
      adapters.map((adapter) =>
        adapter.checkPresence(context).catch((err) => {
          // Graceful degradation — single adapter failure doesn't crash the scan
          console.error(`[PresenceEngine] ${adapter.provider} check failed:`, err)
          const group = adapter.meta?.group || 'international'
          return {
            provider: adapter.provider,
            displayName: adapter.displayName,
            group,
            visibility: 'unknown' as const,
            evidenceLevel: 'N/A' as const,
            confidence: 0,
            lastCheckedAt: checkedAt,
            evidenceCount: 0,
            summary: `${adapter.displayName} 检查失败: ${err.message}`,
            recommendations: ['重试检查'],
          } as ProviderResult
        })
      )
    )

    // Sort by visibility priority: visible → partial → missing → checking → unknown
    const visibilityOrder: Record<string, number> = {
      visible: 0,
      partial: 1,
      missing: 2,
      checking: 3,
      unknown: 4,
    }
    results.sort(
      (a, b) => (visibilityOrder[a.visibility] ?? 99) - (visibilityOrder[b.visibility] ?? 99)
    )

    // Calculate overall metrics
    const visibleCount = results.filter(
      (r) => r.visibility === 'visible' || r.visibility === 'partial'
    ).length
    const providersWithKnowledge = results.filter(
      (r) => typeof r.knowledgeQuality === 'number'
    )
    const avgKnowledge =
      providersWithKnowledge.length > 0
        ? Math.round(
            providersWithKnowledge.reduce((s, r) => s + (r.knowledgeQuality ?? 0), 0) /
              providersWithKnowledge.length
          )
        : 0

    // Overall score: weighted combination of visibility, knowledge quality, and confidence
    const visibilityScore = adapters.length > 0 ? (visibleCount / adapters.length) * 40 : 0
    const knowledgeScore = avgKnowledge * 0.3
    const confidenceAvg =
      results.length > 0
        ? results.reduce((s, r) => s + r.confidence, 0) / results.length
        : 0
    const confidenceScore = confidenceAvg * 0.3
    const overallScore = Math.round(Math.min(100, visibilityScore + knowledgeScore + confidenceScore))

    // Build platform groups from registry metadata
    const grouped = this.registry.getGroupedProviders()

    return {
      overall: {
        score: overallScore,
        visibilityCount: visibleCount,
        totalChecked: adapters.length,
        averageKnowledge: avgKnowledge,
      },
      providers: results,
      platformGroups: {
        international: grouped.international.map((a) => a.provider),
        china: grouped.china.map((a) => a.provider),
      },
      checkedAt,
    }
  }

  /**
   * Check a single provider by name.
   */
  async checkProvider(
    provider: string,
    context: PresenceContext
  ): Promise<ProviderResult> {
    const adapter = this.registry.get(provider)
    if (!adapter) {
      throw new Error(`Unknown provider: ${provider}`)
    }
    return adapter.checkPresence(context)
  }
}
