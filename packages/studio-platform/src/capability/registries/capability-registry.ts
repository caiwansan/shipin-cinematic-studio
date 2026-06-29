/**
 * CapabilityRegistry — All capabilities discoverable by ID.
 *
 * Every capability must be registered here before it can be executed.
 * Execution never hardcodes capability IDs — it discovers them via this registry.
 *
 * @package @studio/platform/capability
 */

import type { CapabilityId, CapabilityDescriptor } from '../types';

/**
 * CapabilityRegistry — capability descriptor store.
 *
 * Provides:
 * - register: add a capability descriptor
 * - unregister: remove a capability descriptor
 * - get: lookup by capabilityId
 * - list: enumerate all registered capabilities
 * - findByProvider: find all capabilities for a given provider
 */
export class CapabilityRegistry {
  private capabilities: Map<CapabilityId, CapabilityDescriptor> = new Map();

  /**
   * Register a capability descriptor.
   * Overwrites if already registered (with warning).
   */
  register(descriptor: CapabilityDescriptor): void {
    if (this.capabilities.has(descriptor.id)) {
      console.warn(`[CapabilityRegistry] Capability '${descriptor.id}' already registered, overwriting`);
    }
    this.capabilities.set(descriptor.id, { ...descriptor });
  }

  /**
   * Unregister a capability descriptor by ID.
   */
  unregister(capabilityId: CapabilityId): void {
    this.capabilities.delete(capabilityId);
  }

  /**
   * Get a capability descriptor by ID.
   * @returns The descriptor, or undefined if not found
   */
  get(capabilityId: CapabilityId): CapabilityDescriptor | undefined {
    return this.capabilities.get(capabilityId);
  }

  /**
   * List all registered capability descriptors.
   */
  list(): CapabilityDescriptor[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * Find all capabilities associated with a given provider.
   * @param providerId — The provider ID to search for
   */
  findByProvider(providerId: string): CapabilityDescriptor[] {
    return Array.from(this.capabilities.values())
      .filter(c => c.provider === providerId);
  }

  /**
   * Get the total number of registered capabilities.
   */
  get count(): number {
    return this.capabilities.size;
  }
}
