/**
 * CapabilityRuntime — Platform capability orchestration engine.
 *
 * Routes capability requests to the appropriate provider, entirely
 * through the CapabilityProvider interface. CapabilityRuntime knows
 * nothing about provider internals — only that they implement
 * CapabilityProvider.execute().
 *
 * Key principles:
 * 1. Provider-agnostic: CapabilityRuntime doesn't know which provider is which.
 *    It only knows the CapabilityProvider interface.
 * 2. No Execution imports: CapabilityRuntime receives CapabilityRequest
 *    and returns CapabilityResult. It doesn't import anything from Execution.
 * 3. Descriptor-based: Capabilities are registered via CapabilityDescriptor.
 *    The runtime discovers providers by checking supports().
 *
 * @package @studio/platform/capability
 * @see CAPABILITY-SPEC.md §3
 */

import type {
  CapabilityProvider,
  CapabilityId,
  CapabilityDescriptor,
  CapabilityRequest,
  CapabilityResult,
} from './types';

// ============ CapabilityRuntime ============

/**
 * CapabilityRuntime — orchestrates capability execution.
 *
 * Manages provider registration, capability discovery, and request routing.
 *
 * Usage:
 * ```typescript
 * const runtime = new CapabilityRuntime();
 *
 * // Register provider
 * runtime.registerProvider(new OpenAIProvider());
 *
 * // Register capability descriptors
 * runtime.registerCapability({
 *   id: 'llm.reasoning',
 *   name: 'LLM Reasoning',
 *   description: 'General reasoning and analysis',
 *   version: '1.0.0',
 *   provider: 'openai',
 *   model: 'gpt-4',
 *   inputSchema: {},
 *   outputSchema: {},
 * });
 *
 * // Discover available capabilities
 * const capabilities = runtime.discover();
 *
 * // Execute
 * const result = await runtime.execute('llm.reasoning', request);
 * ```
 */
export class CapabilityRuntime {
  /** Registered providers (by provider id) */
  private providers: Map<string, CapabilityProvider> = new Map();

  /** Registered capability descriptors (by capability id) */
  private capabilities: Map<CapabilityId, CapabilityDescriptor> = new Map();

  /**
   * Register a provider.
   *
   * @param provider - The provider to register (must implement CapabilityProvider)
   */
  registerProvider(provider: CapabilityProvider): void {
    if (this.providers.has(provider.id)) {
      console.warn(`[CapabilityRuntime] Provider '${provider.id}' already registered, overwriting`);
    }
    this.providers.set(provider.id, provider);
  }

  /**
   * Register a capability descriptor.
   * Links a capability ID to a specific provider + model combination.
   *
   * @param descriptor - The capability descriptor
   */
  registerCapability(descriptor: CapabilityDescriptor): void {
    if (this.capabilities.has(descriptor.id)) {
      console.warn(`[CapabilityRuntime] Capability '${descriptor.id}' already registered, overwriting`);
    }
    this.capabilities.set(descriptor.id, descriptor);
  }

  /**
   * Execute a capability through the appropriate provider.
   *
   * Routing logic:
   * 1. If a descriptor is registered for this capabilityId, use the
   *    provider specified in the descriptor.
   * 2. Otherwise, find the first registered provider that supports()
   *    this capabilityId.
   * 3. If no provider found, return an error result.
   *
   * @param capabilityId - The capability to execute
   * @param request - The capability request (context + input + options)
   * @returns Capability result
   */
  async execute(
    capabilityId: CapabilityId,
    request: CapabilityRequest
  ): Promise<CapabilityResult> {
    // Find the provider
    const provider = this.resolveProvider(capabilityId);

    if (!provider) {
      return {
        success: false,
        error: {
          code: 'NO_PROVIDER',
          message: `No provider available for capability: ${capabilityId}`,
          retryable: false,
          details: { capabilityId, availableProviders: Array.from(this.providers.keys()) },
        },
        usage: { durationMs: 0 },
      };
    }

    // Execute through the provider
    return provider.execute(request);
  }

  /**
   * Discover all registered capabilities.
   *
   * @returns Array of capability descriptors
   */
  discover(): CapabilityDescriptor[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * Discover capabilities filtered by provider.
   *
   * @param providerId - The provider ID to filter by
   * @returns Array of capability descriptors for the given provider
   */
  discoverByProvider(providerId: string): CapabilityDescriptor[] {
    return Array.from(this.capabilities.values())
      .filter(c => c.provider === providerId);
  }

  /**
   * Discover capabilities that a specific capabilityId can handle.
   *
   * @param capabilityId - The capability ID to check
   * @returns Array of provider IDs that support this capability
   */
  discoverProviders(capabilityId: CapabilityId): string[] {
    const providers: string[] = [];

    // Check via descriptor first
    const descriptor = this.capabilities.get(capabilityId);
    if (descriptor && this.providers.has(descriptor.provider)) {
      providers.push(descriptor.provider);
    }

    // Check via supports() on all providers
    for (const [id, provider] of this.providers) {
      if (id !== descriptor?.provider && provider.supports(capabilityId)) {
        providers.push(id);
      }
    }

    return providers;
  }

  /**
   * Check if a capability is available (has a provider that supports it).
   */
  isCapabilityAvailable(capabilityId: CapabilityId): boolean {
    return this.resolveProvider(capabilityId) !== null;
  }

  /**
   * Get the number of registered providers.
   */
  get providerCount(): number {
    return this.providers.size;
  }

  /**
   * Get the number of registered capabilities.
   */
  get capabilityCount(): number {
    return this.capabilities.size;
  }

  /**
   * Get a registered provider by ID.
   */
  getProvider(providerId: string): CapabilityProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get a capability descriptor by ID.
   */
  getCapability(capabilityId: CapabilityId): CapabilityDescriptor | undefined {
    return this.capabilities.get(capabilityId);
  }

  // ============ Private Methods ============

  /**
   * Resolve a provider for a given capability.
   *
   * Strategy:
   * 1. Check if a descriptor exists → use its provider
   * 2. Check all providers via supports()
   * 3. Return null if none found
   */
  private resolveProvider(capabilityId: CapabilityId): CapabilityProvider | null {
    // Strategy 1: Descriptor-based routing (most specific)
    const descriptor = this.capabilities.get(capabilityId);
    if (descriptor) {
      const provider = this.providers.get(descriptor.provider);
      if (provider) {
        return provider;
      }
    }

    // Strategy 2: Provider supports() check
    for (const provider of this.providers.values()) {
      if (provider.supports(capabilityId)) {
        return provider;
      }
    }

    return null;
  }
}
