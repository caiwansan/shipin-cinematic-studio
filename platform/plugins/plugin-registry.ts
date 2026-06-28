// ============================================================
// Plugin Registry — unified plugin registration and discovery
// ARCH-002 / ADR-011: All Runtime dispatch/convergence uses this pattern
// Eliminates switch/case hardcoded dispatch
// ============================================================

/**
 * Base plugin interface.
 * All plugins must implement at minimum name, type, and execute.
 */
export interface Plugin<T = any> {
  name: string
  type: string
  execute(input: any, ctx?: any): Promise<T>
}

/**
 * Plugin Registry — type-safe registry with register/resolve/discover.
 * Replaces all switch/case dispatch logic in Runtimes.
 */
export class PluginRegistry<T extends Plugin<any>> {
  private plugins = new Map<string, T>()

  /**
   * Register a plugin.
   * Overwrites existing plugin with the same name.
   */
  register(plugin: T): void {
    if (this.plugins.has(plugin.name)) {
      console.warn(`[PluginRegistry] Overwriting existing plugin: ${plugin.name}`)
    }
    this.plugins.set(plugin.name, plugin)
  }

  /**
   * Resolve a plugin by exact name.
   */
  resolve(name: string): T | undefined {
    return this.plugins.get(name)
  }

  /**
   * Discover all plugins, optionally filtered by type.
   */
  discover(type?: string): T[] {
    if (type) {
      return Array.from(this.plugins.values()).filter(p => p.type === type)
    }
    return Array.from(this.plugins.values())
  }

  /**
   * Unregister a plugin by name.
   */
  unregister(name: string): void {
    this.plugins.delete(name)
  }

  /**
   * Check if a plugin is registered.
   */
  has(name: string): boolean {
    return this.plugins.has(name)
  }

  /**
   * Get count of registered plugins.
   */
  get count(): number {
    return this.plugins.size
  }

  /**
   * List all registered plugin names.
   */
  listNames(): string[] {
    return Array.from(this.plugins.keys())
  }

  /**
   * Clear all plugins (for testing).
   */
  clear(): void {
    this.plugins.clear()
  }
}
