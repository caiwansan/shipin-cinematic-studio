/**
 * FallbackManager — Multi-level fallback chain for capability execution.
 *
 * When primary provider fails, FallbackManager iterates through fallback chains
 * defined in the policy. Each level can have multiple alternative providers.
 * Unhealthy providers are skipped.
 *
 * @package @studio/platform/capability
 */

import type { CapabilityRequest, CapabilityResult, CapabilityProvider } from './types';
import type { PolicyEngine, PolicyResolution, PolicyRule } from './policy/policy-engine';
import type { ProviderRegistry } from './registries/provider-registry';
import type { HealthManager } from './health-manager';
import type { RouteResult } from './router/capability-router';

/**
 * FallbackManager — handles multi-level fallback execution.
 *
 * Flow:
 * 1. Get fallback chains from PolicyEngine for the capability
 * 2. For each fallback level (1st, 2nd, 3rd...):
 *    a. Try each provider in the level
 *    b. Skip unhealthy providers
 *    c. Return first successful result
 * 3. If all levels exhausted, throw error
 */
export class FallbackManager {
  constructor(
    private readonly policyEngine: PolicyEngine,
    private readonly providerRegistry: ProviderRegistry,
    private readonly healthManager: HealthManager
  ) {}

  /**
   * Execute a capability request with fallback support.
   * Called after the primary provider fails.
   *
   * @param request — Original capability request
   * @param failedResolution — The resolution that failed
   * @param primaryLatencyMs — Latency of the failed primary call
   * @returns RouteResult from the first successful fallback
   * @throws Error if all fallback providers are exhausted
   */
  async executeWithFallback(
    request: CapabilityRequest,
    failedResolution: PolicyResolution,
    primaryLatencyMs?: number
  ): Promise<RouteResult> {
    // Get fallback chains from policy
    const fallbackLevels = this.policyEngine.getFallbacks(request.capabilityId);

    if (fallbackLevels.length === 0) {
      throw new Error(
        `[FallbackManager] No fallback configured for capability '${request.capabilityId}'. ` +
        `Primary provider '${failedResolution.providerId}' failed.`
      );
    }

    const fallbackChain: string[] = [];
    fallbackChain.push(failedResolution.providerId);

    // Iterate through fallback levels
    for (const [levelIndex, levelRules] of fallbackLevels.entries()) {
      for (const rule of levelRules) {
        // Skip if this provider was already tried at primary or earlier fallback
        if (fallbackChain.includes(rule.provider)) continue;

        // Skip unhealthy providers
        if (!this.healthManager.isHealthy(rule.provider)) continue;

        const provider = this.providerRegistry.get(rule.provider);
        if (!provider) {
          console.warn(`[FallbackManager] Fallback provider '${rule.provider}' not found in registry, skipping`);
          continue;
        }

        const startTime = Date.now();

        try {
          const result = await provider.execute(request);
          const latencyMs = Date.now() - startTime;

          // Record success in HealthManager
          this.healthManager.recordSuccess(rule.provider, latencyMs);

          fallbackChain.push(rule.provider);

          return {
            success: true,
            result,
            resolution: {
              providerId: rule.provider,
              modelId: rule.model || '',
              policyId: failedResolution.policyId,
              ruleIndex: levelIndex,
            },
            fallbackUsed: true,
            fallbackChain,
          };
        } catch (error) {
          const latencyMs = Date.now() - startTime;

          // Record failure in HealthManager
          this.healthManager.recordFailure(
            rule.provider,
            error instanceof Error ? error.message : String(error)
          );

          fallbackChain.push(rule.provider);
          // Continue to next fallback rule
        }
      }
    }

    // All fallbacks exhausted
    throw new Error(
      `[FallbackManager] All providers exhausted for capability '${request.capabilityId}'. ` +
      `Tried chain: ${fallbackChain.join(' → ')}`
    );
  }
}
