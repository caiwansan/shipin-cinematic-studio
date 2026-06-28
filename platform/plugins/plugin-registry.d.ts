/**
 * Base plugin interface.
 * All plugins must implement at minimum name, type, and execute.
 */
export interface Plugin<T = any> {
    name: string;
    type: string;
    execute(input: any, ctx?: any): Promise<T>;
}
/**
 * Plugin Registry — type-safe registry with register/resolve/discover.
 * Replaces all switch/case dispatch logic in Runtimes.
 */
export declare class PluginRegistry<T extends Plugin<any>> {
    private plugins;
    /**
     * Register a plugin.
     * Overwrites existing plugin with the same name.
     */
    register(plugin: T): void;
    /**
     * Resolve a plugin by exact name.
     */
    resolve(name: string): T | undefined;
    /**
     * Discover all plugins, optionally filtered by type.
     */
    discover(type?: string): T[];
    /**
     * Unregister a plugin by name.
     */
    unregister(name: string): void;
    /**
     * Check if a plugin is registered.
     */
    has(name: string): boolean;
    /**
     * Get count of registered plugins.
     */
    get count(): number;
    /**
     * List all registered plugin names.
     */
    listNames(): string[];
    /**
     * Clear all plugins (for testing).
     */
    clear(): void;
}
