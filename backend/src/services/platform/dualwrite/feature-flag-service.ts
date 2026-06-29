// ============================================================
// FeatureFlagService — Unified Feature Flag Access Layer
// Wraps the config/feature-flags.ts with DI-friendly interface
// ============================================================

import { isFeatureEnabled, overrideFeatureFlag, resetFeatureFlag, getEffectiveFlag } from '../../../config/feature-flags'

/**
 * Service-friendly wrapper around the feature flag system.
 * Can be injected into services and the DualWriteManager.
 */
export class FeatureFlagService {
  /**
   * Check if a feature flag is enabled.
   * Checks runtime overrides first, then environment config.
   */
  isEnabled(key: string): boolean {
    return isFeatureEnabled(key)
  }

  /**
   * Temporarily override a flag at runtime.
   * Useful for tests, canary rollouts, and emergency rollbacks.
   */
  override(key: string, value: boolean): void {
    overrideFeatureFlag(key, value)
  }

  /**
   * Reset a runtime override back to its configured value.
   */
  reset(key: string): void {
    resetFeatureFlag(key)
  }

  /**
   * Get the effective flag state (override if set, otherwise config).
   */
  getFlag(key: string): { key: string; enabled: boolean; description?: string } {
    const f = getEffectiveFlag(key)
    return { key, enabled: f.enabled, description: f.description }
  }
}

// Singleton for convenience
export const featureFlagService = new FeatureFlagService()
