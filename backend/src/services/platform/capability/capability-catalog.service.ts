// ============================================================
// Capability Catalog Service — capability discovery and search
// ============================================================

import type {
  CapabilityContract,
  CatalogSearchRequest,
  CatalogSearchResponse,
} from './types.js'
import { capabilityRegistry } from './registry/capability-registry.js'
import { contractRepository } from './repositories/contract.repository.js'

export class CapabilityCatalogService {
  /**
   * Search capabilities across both registry and database
   */
  async search(request: CatalogSearchRequest): Promise<CatalogSearchResponse> {
    const limit = request.limit || 50
    const offset = request.offset || 0

    const result = await contractRepository.findAll({
      category: request.category as string | undefined,
      status: request.status,
      search: request.query,
      tags: request.tags,
      limit,
      offset,
    })

    return {
      items: result.items,
      total: result.total,
      limit,
      offset,
    }
  }

  /**
   * Browse by category
   */
  async browseByCategory(category: string): Promise<CapabilityContract[]> {
    // Try registry first (fastest)
    const fromRegistry = capabilityRegistry.listByCategory(category)
    if (fromRegistry.length > 0) return fromRegistry

    // Fallback to database
    const result = await contractRepository.findAll({ category })
    return result.items
  }

  /**
   * Get all distinct categories
   */
  async getCategories(): Promise<string[]> {
    return contractRepository.getCategories()
  }

  /**
   * Get version history for a capability
   */
  async getVersionHistory(name: string): Promise<CapabilityContract[]> {
    const result = await contractRepository.findAll({ search: name, limit: 100 })
    return result.items.filter(c => c.name === name)
  }

  /**
   * Discover capabilities by tags
   */
  async discoverByTags(tags: string[]): Promise<CapabilityContract[]> {
    const result = await contractRepository.findAll({ tags, limit: 100 })
    return result.items
  }

  /**
   * Quick search (lightweight)
   */
  async quickSearch(query: string): Promise<CapabilityContract[]> {
    const result = await contractRepository.findAll({ search: query, limit: 20 })
    return result.items
  }
}

export const capabilityCatalogService = new CapabilityCatalogService()
