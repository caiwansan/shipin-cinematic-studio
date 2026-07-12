// ============================================================
// Shadow Mode — Parallel Provider Comparison
// RC2-T002: DeepSeek Discovery Provider
//
// Runs two providers (primary + shadow) in parallel.
// Primary result is returned to caller; shadow result is logged
// for comparison.
//
// IMPORTANT: Shadow mode calls providers directly (not through
// the registry) to avoid infinite recursion since the registry
// calls ShadowMode.discover() when shadow mode is enabled.
//
// Toggle via env: GEO_SHADOW_MODE=true (default: false)
// ============================================================

import { GeoAIProvider, DiscoveryRequest, DiscoveryResult, ProviderName } from './types'

export interface ShadowComparison {
  id: string
  entity: string
  timestamp: string
  primary: ProviderName
  shadow: ProviderName
  primaryResult: DiscoveryResult | null
  shadowResult: DiscoveryResult | null
  primaryError?: string
  shadowError?: string
  coverageDifference: number
  scoreDifference: number
  latencyDifference: number
  costDifference: number
}

export interface ShadowResult {
  result: DiscoveryResult
  comparison?: ShadowComparison
}

export class ShadowMode {
  private primary: GeoAIProvider
  private shadow: GeoAIProvider
  private comparisons: ShadowComparison[] = []
  private maxComparisons: number = 100
  private primaryName: ProviderName
  private shadowName: ProviderName

  constructor(
    primary: GeoAIProvider,
    shadow: GeoAIProvider,
    primaryName: ProviderName = 'deepseek',
    shadowName: ProviderName = 'deepseek'
  ) {
    this.primary = primary
    this.shadow = shadow
    this.primaryName = primaryName
    this.shadowName = shadowName
  }

  /**
   * Run discovery through both providers in parallel.
   * Returns primary result to caller.
   * Logs comparison internally.
   *
   * Calls providers directly (not through registry) to avoid
   * infinite recursion when registry delegates to ShadowMode.
   */
  async discover(request: DiscoveryRequest): Promise<ShadowResult> {
    const startTime = Date.now()

    // Run both providers in parallel
    const [primaryResult, shadowResult] = await Promise.all([
      this.safeCall(this.primary.discover(request), 'primary'),
      this.safeCall(this.shadow.discover(request), 'shadow'),
    ])

    const primaryError = primaryResult.error
    const shadowError = shadowResult.error
    const primaryData = primaryResult.data
    const shadowData = shadowResult.data

    // Build comparison
    const comparison: ShadowComparison = {
      id: `sc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`,
      entity: request.entity,
      timestamp: new Date().toISOString(),
      primary: this.primaryName,
      shadow: this.shadowName,
      primaryResult: primaryData,
      shadowResult: shadowData,
      primaryError,
      shadowError,
      coverageDifference: this.safeDiff(primaryData?.coverage, shadowData?.coverage),
      scoreDifference: this.safeDiff(primaryData?.position, shadowData?.position),
      latencyDifference: this.safeDiff(primaryData?.meta.latencyMs, shadowData?.meta.latencyMs),
      costDifference: this.safeDiff(primaryData?.meta.cost, shadowData?.meta.cost),
    }

    // Store comparison
    this.comparisons.push(comparison)
    if (this.comparisons.length > this.maxComparisons) {
      this.comparisons = this.comparisons.slice(-this.maxComparisons)
    }

    // Log comparison
    const latencyStr = (primaryData && shadowData)
      ? `latency: ${primaryData.meta.latencyMs}ms vs ${shadowData.meta.latencyMs}ms`
      : ''
    console.log(
      `[ShadowMode] ${request.entity}: ` +
      `primary="${this.primaryName}" ${primaryError ? 'FAILED' : 'OK'}, ` +
      `shadow="${this.shadowName}" ${shadowError ? 'FAILED' : 'OK'} | ` +
      `coverage diff: ${comparison.coverageDifference > 0 ? '+' : ''}${comparison.coverageDifference} | ` +
      latencyStr
    )

    // Return primary result (or throw if both failed)
    if (!primaryData && !shadowData) {
      throw new Error(
        `Both providers failed for "${request.entity}": primary="${primaryError}", shadow="${shadowError}"`
      )
    }

    if (!primaryData && shadowData) {
      // Fall through: return shadow result as primary if primary failed
      return {
        result: shadowData,
        comparison,
      }
    }

    return {
      result: primaryData!,
      comparison,
    }
  }

  /**
   * Get all stored comparisons.
   */
  getComparisons(): ShadowComparison[] {
    return [...this.comparisons]
  }

  /**
   * Get recent comparisons (last N).
   */
  getRecentComparisons(count: number = 10): ShadowComparison[] {
    return this.comparisons.slice(-count)
  }

  /**
   * Get comparison summary statistics.
   */
  getComparisonSummary(): {
    total: number
    primarySuccess: number
    shadowSuccess: number
    avgCoverageDiff: number
    avgLatencyDiff: number
    avgCostDiff: number
  } {
    const total = this.comparisons.length
    const primarySuccess = this.comparisons.filter(c => !c.primaryError).length
    const shadowSuccess = this.comparisons.filter(c => !c.shadowError).length

    const avgCoverageDiff = total > 0
      ? Math.round(this.comparisons.reduce((sum, c) => sum + c.coverageDifference, 0) / total * 100) / 100
      : 0

    const avgLatencyDiff = total > 0
      ? Math.round(this.comparisons.reduce((sum, c) => sum + c.latencyDifference, 0) / total * 100) / 100
      : 0

    const avgCostDiff = total > 0
      ? Math.round(this.comparisons.reduce((sum, c) => sum + c.costDifference, 0) / total * 100000) / 100000
      : 0

    return {
      total,
      primarySuccess,
      shadowSuccess,
      avgCoverageDiff,
      avgLatencyDiff,
      avgCostDiff,
    }
  }

  /**
   * Clear all stored comparisons.
   */
  clearComparisons(): void {
    this.comparisons = []
  }

  /**
   * Check if shadow mode is enabled via env.
   */
  static isEnabled(): boolean {
    return process.env.GEO_SHADOW_MODE === 'true'
  }

  /**
   * Safely call a provider and return data or error.
   */
  private async safeCall(
    promise: Promise<DiscoveryResult>,
    label: string
  ): Promise<{ data: DiscoveryResult | null; error?: string }> {
    try {
      const data = await promise
      return { data }
    } catch (err: any) {
      return { data: null, error: err.message || `Unknown ${label} error` }
    }
  }

  private safeDiff(a?: number, b?: number): number {
    if (a === undefined && b === undefined) return 0
    if (a === undefined) return -(b ?? 0)
    if (b === undefined) return a
    return a - b
  }
}
