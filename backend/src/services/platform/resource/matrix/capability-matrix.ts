// ============================================================
// Capability Matrix — capability → resource mapping management
// KMKI-PLAT-008
// ============================================================

import type { ResourceCapabilityMatrix } from '../types'
import { matrixRepository } from '../repositories/matrix.repository'
import { contractRepository } from '../repositories/contract.repository'
import { PlatformError } from '@platform/errors/platform-errors'

export const capabilityMatrix = {
  /**
   * Map a capability to a resource (create or update).
   */
  async map(data: {
    resourceId: string
    capabilityId: string
    supported: boolean
    qualityScore?: number
    costMultiplier?: number
    metadata?: string
  }): Promise<ResourceCapabilityMatrix> {
    // Verify resource exists
    const resource = await contractRepository.findById(data.resourceId)
    if (!resource) {
      throw new PlatformError('MATRIX_RESOURCE_NOT_FOUND', `Resource "${data.resourceId}" not found`)
    }

    return matrixRepository.upsert(data)
  },

  /**
   * Batch map multiple capabilities to a resource.
   */
  async batchMap(resourceId: string, mappings: Array<{
    capabilityId: string
    supported: boolean
    qualityScore?: number
    costMultiplier?: number
  }>): Promise<ResourceCapabilityMatrix[]> {
    const results: ResourceCapabilityMatrix[] = []
    for (const m of mappings) {
      const result = await this.map({ resourceId, ...m })
      results.push(result)
    }
    return results
  },

  /**
   * Get all capabilities supported by a resource.
   */
  async getResourceCapabilities(resourceId: string): Promise<ResourceCapabilityMatrix[]> {
    return matrixRepository.findByResourceId(resourceId)
  },

  /**
   * Get all resources supporting a capability.
   */
  async getCapabilityResources(capabilityId: string): Promise<ResourceCapabilityMatrix[]> {
    return matrixRepository.findByCapabilityId(capabilityId)
  },

  /**
   * Get the full capability → resources map.
   */
  async getCapabilityResourceMap(): Promise<Record<string, string[]>> {
    return matrixRepository.getCapabilityResourceMap()
  },

  /**
   * Unmap a capability from a resource.
   */
  async unmap(resourceId: string, capabilityId: string): Promise<void> {
    await matrixRepository.delete(resourceId, capabilityId)
  },

  /**
   * List all matrix entries.
   */
  async listAll(): Promise<ResourceCapabilityMatrix[]> {
    return matrixRepository.listAll()
  },
}
