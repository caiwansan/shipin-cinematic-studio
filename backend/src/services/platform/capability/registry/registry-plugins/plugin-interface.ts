// ============================================================
// Registry Plugin Interface — Extensible plugin system
// ============================================================

import type { CapabilityContract } from '../../types.js'

/**
 * RegistryPlugin — hook into registry lifecycle events
 * Plugins can validate, transform, or react to registry changes.
 */
export interface RegistryPlugin {
  name: string
  version: string

  onBeforeRegister?: (contract: CapabilityContract) => Promise<CapabilityContract | null>
  onAfterRegister?: (contract: CapabilityContract) => Promise<void>
  onBeforeDeprecate?: (contract: CapabilityContract) => Promise<boolean>
  onAfterDeprecate?: (contract: CapabilityContract) => Promise<void>
  onBeforeRemove?: (contract: CapabilityContract) => Promise<boolean>
  onAfterRemove?: (id: string) => Promise<void>
}

class RegistryPluginManager {
  private plugins: Map<string, RegistryPlugin> = new Map()

  register(plugin: RegistryPlugin): void {
    if (this.plugins.has(plugin.name)) {
      console.warn(`[RegistryPluginManager] Overwriting plugin: ${plugin.name}`)
    }
    this.plugins.set(plugin.name, plugin)
    console.log(`[RegistryPluginManager] ✅ Plugin registered: ${plugin.name} v${plugin.version}`)
  }

  get(name: string): RegistryPlugin | undefined {
    return this.plugins.get(name)
  }

  list(): RegistryPlugin[] {
    return Array.from(this.plugins.values())
  }

  async runBeforeRegister(contract: CapabilityContract): Promise<CapabilityContract | null> {
    let result: CapabilityContract | null = contract
    for (const plugin of this.plugins.values()) {
      if (plugin.onBeforeRegister) {
        result = await plugin.onBeforeRegister(result)
        if (!result) return null
      }
    }
    return result
  }

  async runAfterRegister(contract: CapabilityContract): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.onAfterRegister) {
        await plugin.onAfterRegister(contract)
      }
    }
  }

  async runBeforeDeprecate(contract: CapabilityContract): Promise<boolean> {
    for (const plugin of this.plugins.values()) {
      if (plugin.onBeforeDeprecate) {
        const ok = await plugin.onBeforeDeprecate(contract)
        if (!ok) return false
      }
    }
    return true
  }

  async runAfterDeprecate(contract: CapabilityContract): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.onAfterDeprecate) {
        await plugin.onAfterDeprecate(contract)
      }
    }
  }

  clear(): void {
    this.plugins.clear()
  }
}

export const registryPluginManager = new RegistryPluginManager()
