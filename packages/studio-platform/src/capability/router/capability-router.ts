/**
 * CapabilityRouter — Executes Policy Engine decisions.
 *
 * The Router does NOT make routing decisions.
 * It receives a resolution from the Policy Engine and executes it.
 * If execution fails, it delegates to the FallbackManager.
 *
 * @package @studio/platform/capability
 */

import type { CapabilityRequest, CapabilityResult, CapabilityProvider } from '../types';
import type { PolicyEngine, PolicyResolution } from '../policy/policy-engine';
import type { ProviderRegistry } from '../registries/provider-registry';
import type { HealthManager } from '../health-manager';
import type { FallbackManager } from '../fallback-manager';

// ============ RouteResult ============

/**
 * Result of routing a capability request through the Router.
 */
export interface RouteResult {
  /** Whether the execution succeeded */
  success: boolean;

  /** Capability result from the provider (present on success) */
  result?: CapabilityResult;

  /** The policy resolution that was used */
  resolution: PolicyResolution;

  /** Whether a fallback was used instead of the primary route */
  fallbackUsed?: boolean;

  /** Ordered list of providers in the fallback chain used */
  fallbackChain?: string[];
}

// ============ CapabilityRouter ============

/**
 * CapabilityRouter — executes Policy Engine routing decisions.
 *
 * Flow:
 * 1. Policy Engine resolves capabilityId → provider+model
 * 2. Router looks up the provider in ProviderRegistry
 * 3. Router calls provider.execute(request)
 * 4. On failure, Router delegates to FallbackManager
 *
 * The Router is a pure executor. It does not make decisions.
 */
export class CapabilityRouter {
  constructor(
    private readonly policyEngine: PolicyEngine,
    private readonly providerRegistry: ProviderRegistry,
    private readonly healthManager: HealthManager,
    private readonly fallbackManager: FallbackManager
  ) {}

  /**
   * Route a capability request through the policy engine to a provider.
   *
   * @param request — The capability request to route
   * @returns RouteResult with execution outcome
   */
  async route(request: CapabilityRequest): Promise<RouteResult> {
    // 1. Policy Engine decides which provider+model to use
    const resolution = await this.policyEngine.resolve(
      request.capabilityId,
      {
        workspace: request.context.workspaceType,
        workflow: request.context.metadata?.workflow as string | undefined,
        health: this.healthManager.getAll(),
      }
    );

    // 2. Router looks up the provider
    const provider = this.providerRegistry.get(resolution.providerId);
    if (!provider) {
      throw new Error(
        `[CapabilityRouter] Provider '${resolution.providerId}' not found in registry`
      );
    }

    const startTime = Date.now();

    // 3. Execute through the provider
    try {
      const result = await provider.execute(request);
      const latencyMs = Date.now() - startTime;

      // Record success in HealthManager
      this.healthManager.recordSuccess(resolution.providerId, latencyMs);

      return {
        success: true,
        result,
        resolution,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      // Record failure in HealthManager
      this.healthManager.recordFailure(
        resolution.providerId,
        error instanceof Error ? error.message : String(error)
      );

      // 4. Fallback if primary execution failed
      return this.fallbackManager.executeWithFallback(request, resolution, latencyMs);
    }
  }
}
