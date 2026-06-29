/**
 * CapabilityOrchestrator — Unified entry point for all capability execution.
 *
 * The Orchestrator ties together:
 * - CapabilityRegistry: validates capability exists
 * - PolicyEngine: decides which provider+model to use
 * - Router: executes the policy decision
 * - HealthManager: tracks provider health
 * - CostManager: records every call for billing
 * - FallbackManager: handles failures gracefully
 * - EventBus: publishes execution events
 *
 * This is the ONLY class that ExecutionKernel talks to for capability execution.
 *
 * @package @studio/platform/capability
 */

import type {
  CapabilityId,
  CapabilityRequest,
  CapabilityResult,
} from './types';
import type { CapabilityRuntime } from './capability-runtime';
import type { CapabilityRegistry } from './registries/capability-registry';
import type { ProviderRegistry } from './registries/provider-registry';
import type { ModelRegistry } from './registries/model-registry';
import type { PolicyEngine } from './policy/policy-engine';
import type { CapabilityRouter, RouteResult } from './router/capability-router';
import type { HealthManager } from './health-manager';
import type { CostManager } from './cost-manager';
import type { FallbackManager } from './fallback-manager';
import type { EventBus } from '../event/event-bus';

/**
 * Simple ID generator for usage records.
 */
function generateId(): string {
  return `usage-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * CapabilityOrchestrator — unified capability execution entry point.
 *
 * Implements the CapabilityRuntime interface for backward compatibility
 * with ExecutionCapabilityHandler.
 *
 * All capability execution flows through:
 * 1. Capability validation (CapabilityRegistry)
 * 2. Policy resolution (PolicyEngine)
 * 3. Provider execution (Router → Provider)
 * 4. Cost recording (CostManager)
 * 5. Event publishing (EventBus)
 */
export class CapabilityOrchestrator implements CapabilityRuntime {
  constructor(
    private readonly capabilityRegistry: CapabilityRegistry,
    private readonly providerRegistry: ProviderRegistry,
    private readonly modelRegistry: ModelRegistry,
    private readonly policyEngine: PolicyEngine,
    private readonly router: CapabilityRouter,
    private readonly healthManager: HealthManager,
    private readonly costManager: CostManager,
    private readonly fallbackManager: FallbackManager,
    private readonly eventBus: EventBus
  ) {}

  /**
   * Execute a capability through the full orchestration pipeline.
   *
   * @param capabilityId — The capability to execute
   * @param request — The capability request with context + input + options
   * @returns Capability result
   */
  async execute(
    capabilityId: CapabilityId,
    request: CapabilityRequest
  ): Promise<CapabilityResult> {
    const startTime = Date.now();
    const traceId = request.context?.traceId || `trace-${Date.now()}`;

    try {
      // 1. Validate capability exists
      const descriptor = this.capabilityRegistry.get(capabilityId);
      if (!descriptor) {
        throw new Error(`[CapabilityOrchestrator] Unknown capability: ${capabilityId}`);
      }

      // 2. Route through Policy Engine → Provider
      const routeResult = await this.router.route(request);

      // 3. Record usage (every call, no opt-out)
      const duration = Date.now() - startTime;
      this.recordUsage(request, routeResult, duration);

      // 4. Publish success event
      await this.eventBus.publish({
        type: 'capability.executed',
        payload: {
          capabilityId,
          providerId: routeResult.resolution.providerId,
          modelId: routeResult.resolution.modelId,
          success: true,
          duration,
          traceId,
          fallbackUsed: routeResult.fallbackUsed,
          fallbackChain: routeResult.fallbackChain,
        },
        metadata: {
          source: 'orchestrator',
          userId: request.context?.userId,
          projectId: request.context?.projectId,
        },
        timestamp: new Date().toISOString(),
        traceId,
        eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 12)}`,
        version: 1,
      });

      return routeResult.result!;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Publish failure event
      await this.eventBus.publish({
        type: 'capability.failed',
        payload: {
          capabilityId,
          error: errorMessage,
          duration,
          traceId,
        },
        metadata: {
          source: 'orchestrator',
          userId: request.context?.userId,
          projectId: request.context?.projectId,
        },
        timestamp: new Date().toISOString(),
        traceId,
        eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 12)}`,
        version: 1,
      });

      throw error;
    }
  }

  /**
   * Register a provider with the orchestrator.
   * Convenience method that delegates to ProviderRegistry.
   */
  registerProvider(provider: import('./types').CapabilityProvider): void {
    this.providerRegistry.register(provider);
  }

  /**
   * Register a capability descriptor.
   * Convenience method that delegates to CapabilityRegistry.
   */
  registerCapability(descriptor: import('./types').CapabilityDescriptor): void {
    this.capabilityRegistry.register(descriptor);
  }

  /**
   * Load a policy into the orchestrator.
   * Convenience method that delegates to PolicyEngine.
   */
  loadPolicy(policy: import('./policy/policy-engine').Policy): void {
    this.policyEngine.loadPolicy(policy);
  }

  /**
   * Discover all registered capabilities.
   */
  discover(): import('./types').CapabilityDescriptor[] {
    return this.capabilityRegistry.list();
  }

  /**
   * Get access to sub-components for advanced use.
   */
  get registries() {
    return {
      capability: this.capabilityRegistry,
      provider: this.providerRegistry,
      model: this.modelRegistry,
    };
  }

  get services() {
    return {
      policy: this.policyEngine,
      router: this.router,
      health: this.healthManager,
      cost: this.costManager,
      fallback: this.fallbackManager,
      eventBus: this.eventBus,
    };
  }

  // ============ Private ============

  /**
   * Record usage for every capability execution.
   * Called in ALL cases (success and failure).
   */
  private recordUsage(
    request: CapabilityRequest,
    result: RouteResult,
    duration: number
  ): void {
    this.costManager.recordUsage({
      id: generateId(),
      timestamp: Date.now(),
      workspace: request.context?.workspaceType || '',
      projectId: request.context?.projectId || '',
      userId: request.context?.userId || '',
      capabilityId: request.capabilityId,
      providerId: result.resolution.providerId,
      modelId: result.resolution.modelId,
      inputTokens: result.result?.usage?.inputTokens ?? 0,
      outputTokens: result.result?.usage?.outputTokens ?? 0,
      totalTokens: result.result?.usage?.totalTokens ?? 0,
      cost: result.result?.usage?.cost ?? 0,
      latencyMs: duration,
      success: result.success,
      traceId: request.context?.traceId || '',
    });
  }
}
