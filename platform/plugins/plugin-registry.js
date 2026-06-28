"use strict";
// ============================================================
// Plugin Registry — unified plugin registration and discovery
// ARCH-002 / ADR-011: All Runtime dispatch/convergence uses this pattern
// Eliminates switch/case hardcoded dispatch
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginRegistry = void 0;
/**
 * Plugin Registry — type-safe registry with register/resolve/discover.
 * Replaces all switch/case dispatch logic in Runtimes.
 */
class PluginRegistry {
    plugins = new Map();
    /**
     * Register a plugin.
     * Overwrites existing plugin with the same name.
     */
    register(plugin) {
        if (this.plugins.has(plugin.name)) {
            console.warn(`[PluginRegistry] Overwriting existing plugin: ${plugin.name}`);
        }
        this.plugins.set(plugin.name, plugin);
    }
    /**
     * Resolve a plugin by exact name.
     */
    resolve(name) {
        return this.plugins.get(name);
    }
    /**
     * Discover all plugins, optionally filtered by type.
     */
    discover(type) {
        if (type) {
            return Array.from(this.plugins.values()).filter(p => p.type === type);
        }
        return Array.from(this.plugins.values());
    }
    /**
     * Unregister a plugin by name.
     */
    unregister(name) {
        this.plugins.delete(name);
    }
    /**
     * Check if a plugin is registered.
     */
    has(name) {
        return this.plugins.has(name);
    }
    /**
     * Get count of registered plugins.
     */
    get count() {
        return this.plugins.size;
    }
    /**
     * List all registered plugin names.
     */
    listNames() {
        return Array.from(this.plugins.keys());
    }
    /**
     * Clear all plugins (for testing).
     */
    clear() {
        this.plugins.clear();
    }
}
exports.PluginRegistry = PluginRegistry;
