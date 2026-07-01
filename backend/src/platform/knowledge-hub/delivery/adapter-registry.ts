// ════════════════════════════════════════════════════════════
// K4 RC2 Sprint 1 — Adapter Registry
// ════════════════════════════════════════════════════════════
// Central registry for all DeliveryAdapters.
// Adapters register by targetType + provider.
// No Runtime code modification needed to add new adapters.
// ════════════════════════════════════════════════════════════

import {
  DeliveryAdapter, AdapterMeta, ProviderCapability,
  AdapterCapability, AdapterHealthStatus, AdapterConfig,
} from '../../types'

export class DeliveryAdapterRegistry {
  private adapters = new Map<string, DeliveryAdapter>()    // key = `${targetType}:${provider}`
  private providers = new Map<string, ProviderCapability>()

  /**
   * Register an adapter.
   */
  register(adapter: DeliveryAdapter): void {
    const key = this.key(adapter.meta.targetType, adapter.meta.provider)
    this.adapters.set(key, adapter)

    this.providers.set(adapter.meta.provider, {
      provider: adapter.meta.provider,
      adapterType: adapter.meta.targetType,
      supports: adapter.meta.capabilities,
      configTemplate: adapter.meta.configSchema,
    })

    console.log(`[AdapterRegistry] Registered: ${adapter.meta.provider} (${adapter.meta.targetType}) — ${adapter.meta.name}`)
  }

  /**
   * Get an adapter by type + provider.
   */
  get(targetType: string, provider: string): DeliveryAdapter | undefined {
    return this.adapters.get(this.key(targetType, provider))
  }

  /**
   * Get all adapters for a specific target type.
   */
  getByType(targetType: string): DeliveryAdapter[] {
    return Array.from(this.adapters.values())
      .filter(a => a.meta.targetType === targetType)
  }

  /**
   * Get all adapters.
   */
  getAll(): DeliveryAdapter[] {
    return Array.from(this.adapters.values())
  }

  /**
   * Get all providers for a target type.
   */
  getProviders(targetType: string): ProviderCapability[] {
    return Array.from(this.providers.values())
      .filter(p => p.adapterType === targetType)
  }

  /**
   * Check if a specific capability is supported.
   */
  supports(targetType: string, provider: string, capability: AdapterCapability): boolean {
    const adapter = this.get(targetType, provider)
    return adapter?.meta.capabilities.includes(capability) ?? false
  }

  /**
   * Discover all available adapters and their capabilities.
   */
  discover(): Array<{
    targetType: string
    provider: string
    name: string
    version: string
    capabilities: AdapterCapability[]
    description: string
  }> {
    return this.getAll().map(a => ({
      targetType: a.meta.targetType,
      provider: a.meta.provider,
      name: a.meta.name,
      version: a.meta.version,
      capabilities: a.meta.capabilities,
      description: a.meta.description,
    }))
  }

  /**
   * Run health check on all (or specific) adapters.
   */
  async healthCheckAll(): Promise<Array<{
    provider: string
    status: AdapterHealthStatus
    latencyMs?: number
    error?: string
  }>> {
    const results: Array<{ provider: string; status: AdapterHealthStatus; latencyMs?: number; error?: string }> = []

    for (const adapter of this.adapters.values()) {
      try {
        if (adapter.healthCheck) {
          const result = await adapter.healthCheck()
          results.push({
            provider: adapter.meta.provider,
            status: result.status,
            latencyMs: result.latencyMs,
          })
        } else {
          results.push({
            provider: adapter.meta.provider,
            status: AdapterHealthStatus.Unconfigured,
          })
        }
      } catch (err: any) {
        results.push({
          provider: adapter.meta.provider,
          status: AdapterHealthStatus.Down,
          error: err.message,
        })
      }
    }

    return results
  }

  private key(targetType: string, provider: string): string {
    return `${targetType}:${provider}`
  }
}
