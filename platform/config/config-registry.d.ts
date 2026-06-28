/**
 * Default configurations for the entire platform.
 */
export declare const PLATFORM_DEFAULTS: {
    readonly ASSET_DEFAULT_LANGUAGE: "zh";
    readonly ASSET_DEFAULT_STATUS: "draft";
    readonly ASSET_PAGE_SIZE: 50;
    readonly ASSET_MAX_CONTENT_SIZE: number;
    readonly SEMANTIC_CHUNK_SIZE: 5000;
    readonly SEMANTIC_CONFIDENCE_THRESHOLD: 0.3;
    readonly SEMANTIC_MAX_KEYWORDS: 20;
    readonly SEMANTIC_MAX_TOPICS: 10;
    readonly SEMANTIC_PAGE_SIZE: 50;
    readonly GOAL_DEFAULT_PRIORITY: 3;
    readonly GOAL_DEFAULT_MAX_RETRIES: 3;
    readonly GOAL_TASK_PAGE_SIZE: 100;
    readonly GOAL_EXECUTABLE_LIMIT: 20;
    readonly CAPABILITY_DEFAULT_STATUS: "active";
    readonly CAPABILITY_DEFAULT_VERSION: "1.0.0";
    readonly CAPABILITY_REGISTRY_LIMIT: 10000;
    readonly CAPABILITY_PAGE_SIZE: 50;
    readonly EVENT_BUS_MAX_HISTORY: 200;
    readonly TIMER_REGISTRY_CLEANUP_INTERVAL_MS: 60000;
    readonly EVENT_BUFFER_MAX_SIZE: 200;
    readonly SNAPSHOT_HISTORY_MAX_SIZE: 50;
};
export type ConfigKey = keyof typeof PLATFORM_DEFAULTS;
/**
 * Config Registry — provides values from in-memory store or falls back to defaults.
 */
export declare const configRegistry: {
    /**
     * Get a config value by key.
     */
    get<K extends ConfigKey>(key: K): (typeof PLATFORM_DEFAULTS)[K];
    /**
     * Set a config value at runtime.
     */
    set<K extends ConfigKey>(key: K, value: (typeof PLATFORM_DEFAULTS)[K]): void;
    /**
     * Reset a config to its default value.
     */
    reset<K extends ConfigKey>(key: K): void;
    /**
     * Reset all configs to defaults.
     */
    resetAll(): void;
    /**
     * Get all config values (defaults + overrides).
     */
    getAll(): Record<string, any>;
    /**
     * Load config from an environment variable key.
     */
    loadFromEnv(envKey: string, configKey: ConfigKey): void;
};
