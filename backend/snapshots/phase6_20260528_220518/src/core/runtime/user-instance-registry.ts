/**
 * Phase B — User Instance Registry
 *
 * Runtime cache for per-user plugin configuration.
 * Maps userId → enabled plugins + API keys, read from prisma.userApiKey at first access.
 *
 * This is NOT a source of truth — the source is the DB (userApiKey table).
 * This is a read-through cache that avoids DB round-trips on every generation request.
 */

import type { Capability } from '../provider-registry/types.js'

// ============================================================
// Types
// ============================================================

export interface UserPluginContext {
  userId: string
  /** API keys per provider: { volcengine: 'sk-xxx', openai: 'sk-yyy' } */
  apiKeys: Record<string, string>
  /** List of enabled plugin IDs (provider IDs the user has active keys for) */
  enabledPlugins: string[]
  /** Model overrides: { volcengine: 'seedream-v3' } */
  modelOverrides: Record<string, string>
}

// ============================================================
// Registry Implementation
// ============================================================

class UserInstanceRegistry {
  /** In-memory cache: userId → context */
  private cache = new Map<string, UserPluginContext>()

  /** 
   * Get (or load) user plugin context.
   * Returns null if user has no registered API keys.
   */
  async get(userId: string): Promise<UserPluginContext | null> {
    // Check cache first
    const cached = this.cache.get(userId)
    if (cached) return cached

    // Load from DB
    const ctx = await this.loadFromDb(userId)
    if (!ctx) return null

    // Cache
    this.cache.set(userId, ctx)
    return ctx
  }

  /**
   * Invalidate cache for a user (call after key/plugin config change).
   */
  invalidate(userId: string): void {
    this.cache.delete(userId)
  }

  /**
   * Check if a user has a specific plugin enabled.
   */
  isPluginEnabled(userId: string, pluginId: string): boolean {
    const ctx = this.cache.get(userId)
    return ctx?.enabledPlugins.includes(pluginId) ?? false
  }

  /**
   * Get a user's API key for a specific provider.
   */
  getApiKey(userId: string, provider: string): string | null {
    return this.cache.get(userId)?.apiKeys[provider] ?? null
  }

  /**
   * Get user's model override for a provider (if set).
   */
  getModelOverride(userId: string, provider: string): string | null {
    return this.cache.get(userId)?.modelOverrides[provider] ?? null
  }

  /**
   * Load user plugin context from database.
   */
  private async loadFromDb(userId: string): Promise<UserPluginContext | null> {
    try {
      // Dynamic import to avoid circular dependency at module level
      const { prisma } = await import('../../utils/index.js')

      const keys = await prisma.userApiKey.findMany({
        where: { userId, isActive: true },
        select: { provider: true, keyValue: true, modelType: true, modelName: true },
      })

      if (!keys || keys.length === 0) return null

      const apiKeys: Record<string, string> = {}
      const enabledPlugins: Set<string> = new Set()
      const modelOverrides: Record<string, string> = {}

      for (const key of keys) {
        if (key.keyValue) {
          apiKeys[key.provider] = key.keyValue
          enabledPlugins.add(key.provider)
        }
        if (key.modelName) {
          modelOverrides[key.provider] = key.modelName
        }
      }

      return {
        userId,
        apiKeys,
        enabledPlugins: [...enabledPlugins],
        modelOverrides,
      }
    } catch (err) {
      console.error(`[UserInstanceRegistry] Failed to load for user ${userId}:`, err)
      return null
    }
  }
}

/** Singleton */
export const userInstanceRegistry = new UserInstanceRegistry()
