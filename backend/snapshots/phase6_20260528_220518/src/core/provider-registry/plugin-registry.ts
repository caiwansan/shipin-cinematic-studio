/**
 * Phase A — Plugin Registry
 *
 * Singleton registry that collects all ModelPluginAdapter instances
 * and provides capability-partitioned Candidate views.
 *
 * This replaces the ad-hoc "probe available providers" pattern in images.ts.
 * It does NOT replace the PolicyAdapter — it only supplies the Candidate input.
 *
 * Usage:
 *   import { pluginRegistry } from './plugin-registry.js'
 *   pluginRegistry.register(new VolcenginePlugin())
 *   const candidates = pluginRegistry.getCandidates('image')
 */

import type { Candidate, Capability, ModelPluginAdapter } from './types.js'
import { ALL_CAPABILITIES } from './types.js'

export class PluginRegistry {
  /** Adapters indexed by provider ID */
  private adapters = new Map<string, ModelPluginAdapter>()

  /** Candidates pre-partitioned by capability */
  private byCapability: Map<Capability, Candidate[]> = new Map()

  /** Whether init() has been called */
  private initialized = false

  constructor() {
    for (const cap of ALL_CAPABILITIES) {
      this.byCapability.set(cap, [])
    }
  }

  /**
   * Register a plugin adapter.
   * Calling this after init() is allowed — it rebuilds the capability index.
   */
  register(adapter: ModelPluginAdapter): void {
    this.adapters.set(adapter.provider, adapter)
    this.rebuildIndex()
  }

  /**
   * Get all candidates for a given capability.
   * Returns a new array each call (defensive copy).
   */
  getCandidates(capability: Capability): Candidate[] {
    return [...(this.byCapability.get(capability) ?? [])]
  }

  /**
   * Get all candidates across all capabilities (for admin/trace).
   */
  getAllCandidates(): Map<Capability, Candidate[]> {
    const copy = new Map<Capability, Candidate[]>()
    for (const [cap, list] of this.byCapability) {
      copy.set(cap, [...list])
    }
    return copy
  }

  /**
   * Look up an adapter by provider ID.
   */
  getAdapter(provider: string): ModelPluginAdapter | undefined {
    return this.adapters.get(provider)
  }

  /**
   * List all registered provider IDs.
   */
  listProviders(): string[] {
    return [...this.adapters.keys()]
  }

  /**
   * Check if any candidates exist for a capability.
   */
  hasCapability(capability: Capability): boolean {
    return (this.byCapability.get(capability)?.length ?? 0) > 0
  }

  /**
   * Rebuild the capability → candidates index from all registered adapters.
   */
  private rebuildIndex(): void {
    // Reset
    for (const cap of ALL_CAPABILITIES) {
      this.byCapability.set(cap, [])
    }

    // Collect from all adapters
    for (const adapter of this.adapters.values()) {
      for (const candidate of adapter.models()) {
        const list = this.byCapability.get(candidate.capability)
        if (list) {
          list.push(candidate)
        }
      }
    }
  }

  /**
   * Initialize the registry. Currently a no-op; future versions
   * may load adapters from a dynamic discovery mechanism.
   */
  async init(): Promise<void> {
    if (this.initialized) return
    this.initialized = true
  }
}

/** Singleton instance */
export const pluginRegistry = new PluginRegistry()
