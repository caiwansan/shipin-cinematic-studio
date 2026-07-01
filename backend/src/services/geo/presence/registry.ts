// ============================================================
// AI Presence Engine — ProviderAdapterRegistry
// P0-T005: AI Presence Engine Foundation
// P0-T005.1: 12 Platform Extension — added meta/group management
//
// Registry Pattern: All adapters register here at startup.
// PresenceEngine consumes adapters exclusively through Registry.
// No importer should directly instantiate an adapter.
// ============================================================

import { ProviderAdapter, ProviderAdapterMeta } from './adapter.interface.js'

export interface RegisteredAdapterInfo {
  provider: string
  displayName: string
  meta: ProviderAdapterMeta
}

export class ProviderAdapterRegistry {
  private adapters: Map<string, ProviderAdapter> = new Map()

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.provider, adapter)
  }

  get(provider: string): ProviderAdapter | undefined {
    return this.adapters.get(provider)
  }

  getAll(): ProviderAdapter[] {
    return Array.from(this.adapters.values())
  }

  getPresenceCapable(): ProviderAdapter[] {
    return this.getAll().filter((a) => a.supportsPresence)
  }

  /**
   * Get all adapters sorted by displayOrder (from meta).
   */
  getAllSorted(): ProviderAdapter[] {
    return this.getAll().sort(
      (a, b) => (a.meta?.displayOrder ?? 99) - (b.meta?.displayOrder ?? 99)
    )
  }

  /**
   * Get provider info grouped by group (international/china).
   */
  getGroupedProviders(): { international: ProviderAdapter[]; china: ProviderAdapter[] } {
    const all = this.getAll()
    return {
      international: all.filter((a) => a.meta?.group === 'international').sort((a, b) => (a.meta?.displayOrder ?? 99) - (b.meta?.displayOrder ?? 99)),
      china: all.filter((a) => a.meta?.group === 'china').sort((a, b) => (a.meta?.displayOrder ?? 99) - (b.meta?.displayOrder ?? 99)),
    }
  }

  /**
   * Get all registered adapter info (for listing/frontend use).
   */
  getAdapterInfos(): RegisteredAdapterInfo[] {
    return this.getAll().map((a) => ({
      provider: a.provider,
      displayName: a.displayName,
      meta: a.meta || { group: 'international', displayOrder: 99 },
    }))
  }
}

// Singleton
export const providerAdapterRegistry = new ProviderAdapterRegistry()
