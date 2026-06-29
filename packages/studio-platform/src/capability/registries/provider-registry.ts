/**
 * ProviderRegistry — All providers registered and discoverable.
 *
 * Every provider (OpenAI, DeepSeek, Qwen, etc.) registers here.
 * Adding a new provider only requires implementing CapabilityProvider + register().
 * No other code needs to change.
 *
 * @package @studio/platform/capability
 */

import type { CapabilityProvider, CapabilityId } from '../types';

/**
 * ProviderRegistry — provider store.
 *
 * Provides:
 * - register: add a provider
 * - unregister: remove a provider by ID
 * - get: lookup by providerId
 * - list: enumerate all registered providers
 * - findByCapability: find providers supporting a given capability
 */
export class ProviderRegistry {
  private providers: Map<string, CapabilityProvider> = new Map();

  /**
   * Register a provider.
   * Overwrites if already registered (with warning).
   */
  register(provider: CapabilityProvider): void {
    if (this.providers.has(provider.id)) {
      console.warn(`[ProviderRegistry] Provider '${provider.id}' already registered, overwriting`);
    }
    this.providers.set(provider.id, provider);
  }

  /**
   * Unregister a provider by ID.
   */
  unregister(providerId: string): void {
    this.providers.delete(providerId);
  }

  /**
   * Get a provider by ID.
   * @returns The provider, or undefined if not found
   */
  get(providerId: string): CapabilityProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * List all registered providers.
   */
  list(): CapabilityProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Find all providers that support a given capability.
   * Checks via provider.supports(capabilityId).
   */
  findByCapability(capabilityId: CapabilityId): CapabilityProvider[] {
    return Array.from(this.providers.values())
      .filter(p => p.supports(capabilityId));
  }

  /**
   * Get the total number of registered providers.
   */
  get count(): number {
    return this.providers.size;
  }
}
