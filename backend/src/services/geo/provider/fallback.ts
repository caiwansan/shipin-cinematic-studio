// ============================================================
// GEO AI Provider — Fallback Chain
// RC2-T001: GEO AI Provider Infrastructure
//
// Provides automatic fallback between providers.
// Default chain: ['deepseek'] — no mock in production chain.
// ============================================================

import { DiscoveryRequest, DiscoveryResult, VerificationRequest, VerificationResult, ProviderName } from './types'
import { GeoProviderRegistry } from './provider-registry'

export class FallbackChain {
  private registry: GeoProviderRegistry
  private chain: ProviderName[]

  constructor(registry: GeoProviderRegistry, chain?: ProviderName[]) {
    this.registry = registry
    this.chain = chain ?? ['deepseek']
  }

  /**
   * Discover with fallback. Tries each provider in order until one succeeds.
   */
  async discover(request: DiscoveryRequest): Promise<DiscoveryResult> {
    const errors: Array<{ provider: ProviderName; error: string }> = []

    for (const providerName of this.chain) {
      try {
        const result = await this.registry.discover(request, providerName)
        // Mark as non-cached since we got it from a fallback provider
        return result
      } catch (err: any) {
        errors.push({ provider: providerName, error: err.message || 'Unknown error' })
        console.warn(`[GeoFallback] Discover via "${providerName}" failed: ${err.message}. Trying next...`)
      }
    }

    // All providers failed
    throw new Error(
      `All providers in fallback chain failed: ${errors.map(e => `${e.provider}: ${e.error}`).join('; ')}`
    )
  }

  /**
   * Verify with fallback. Tries each provider in order until one succeeds.
   */
  async verify(request: VerificationRequest): Promise<VerificationResult> {
    const errors: Array<{ provider: ProviderName; error: string }> = []

    for (const providerName of this.chain) {
      try {
        const result = await this.registry.verify(request, providerName)
        return result
      } catch (err: any) {
        errors.push({ provider: providerName, error: err.message || 'Unknown error' })
        console.warn(`[GeoFallback] Verify via "${providerName}" failed: ${err.message}. Trying next...`)
      }
    }

    throw new Error(
      `All providers in fallback chain failed: ${errors.map(e => `${e.provider}: ${e.error}`).join('; ')}`
    )
  }

  /**
   * Get the current fallback chain.
   */
  getChain(): ProviderName[] {
    return [...this.chain]
  }

  /**
   * Set a new fallback chain.
   */
  setChain(chain: ProviderName[]): void {
    this.chain = [...chain]
  }
}
