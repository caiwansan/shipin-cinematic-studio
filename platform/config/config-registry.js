"use strict";
// ============================================================
// Config Registry — unified configuration management
// ARCH-001-G: All magic numbers/strings must be registered here
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.configRegistry = exports.PLATFORM_DEFAULTS = void 0;
const configStore = new Map();
/**
 * Default configurations for the entire platform.
 */
exports.PLATFORM_DEFAULTS = {
    // Asset Runtime
    ASSET_DEFAULT_LANGUAGE: 'zh',
    ASSET_DEFAULT_STATUS: 'draft',
    ASSET_PAGE_SIZE: 50,
    ASSET_MAX_CONTENT_SIZE: 10 * 1024 * 1024, // 10MB
    // Semantic Runtime
    SEMANTIC_CHUNK_SIZE: 5000,
    SEMANTIC_CONFIDENCE_THRESHOLD: 0.3,
    SEMANTIC_MAX_KEYWORDS: 20,
    SEMANTIC_MAX_TOPICS: 10,
    SEMANTIC_PAGE_SIZE: 50,
    // Goal Runtime
    GOAL_DEFAULT_PRIORITY: 3,
    GOAL_DEFAULT_MAX_RETRIES: 3,
    GOAL_TASK_PAGE_SIZE: 100,
    GOAL_EXECUTABLE_LIMIT: 20,
    // Capability Runtime
    CAPABILITY_DEFAULT_STATUS: 'active',
    CAPABILITY_DEFAULT_VERSION: '1.0.0',
    CAPABILITY_REGISTRY_LIMIT: 10000,
    CAPABILITY_PAGE_SIZE: 50,
    // Event Bus
    EVENT_BUS_MAX_HISTORY: 200,
    // Lifecycle
    TIMER_REGISTRY_CLEANUP_INTERVAL_MS: 60000,
    EVENT_BUFFER_MAX_SIZE: 200,
    SNAPSHOT_HISTORY_MAX_SIZE: 50,
};
/**
 * Config Registry — provides values from in-memory store or falls back to defaults.
 */
exports.configRegistry = {
    /**
     * Get a config value by key.
     */
    get(key) {
        if (configStore.has(key)) {
            return configStore.get(key);
        }
        return exports.PLATFORM_DEFAULTS[key];
    },
    /**
     * Set a config value at runtime.
     */
    set(key, value) {
        configStore.set(key, value);
    },
    /**
     * Reset a config to its default value.
     */
    reset(key) {
        configStore.delete(key);
    },
    /**
     * Reset all configs to defaults.
     */
    resetAll() {
        configStore.clear();
    },
    /**
     * Get all config values (defaults + overrides).
     */
    getAll() {
        const result = { ...exports.PLATFORM_DEFAULTS };
        for (const [key, value] of configStore) {
            result[key] = value;
        }
        return result;
    },
    /**
     * Load config from an environment variable key.
     */
    loadFromEnv(envKey, configKey) {
        const value = process.env[envKey];
        if (value !== undefined) {
            const defaultValue = exports.PLATFORM_DEFAULTS[configKey];
            if (typeof defaultValue === 'number') {
                this.set(configKey, Number(value));
            }
            else if (typeof defaultValue === 'boolean') {
                this.set(configKey, value === 'true' || value === '1');
            }
            else {
                this.set(configKey, value);
            }
        }
    },
};
