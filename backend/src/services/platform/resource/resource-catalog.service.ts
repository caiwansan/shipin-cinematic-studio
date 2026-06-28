// ============================================================
// Resource Catalog Service — resource discovery
// KMKI-PLAT-008
// ============================================================

import { resourceRegistry } from './registry/resource-registry'
import { resourceHealth } from './health/resource-health'
import { contractRepository } from './repositories/contract.repository'
import type { ResourceContract, ResourceHealth } from './types'

export interface CatalogItem {
  resource: ResourceContract
  health?: ResourceHealth | null
  capabilityCount: number
}

export interface CatalogGroup {
  type: string
  label: string
  count: number
  items: CatalogItem[]
}

const TYPE_LABELS: Record<string, string> = {
  LLM: 'Large Language Model',
  Embedding: 'Embedding Model',
  Image: 'Image Generation',
  Video: 'Video Generation',
  Speech: 'Speech Synthesis',
  Tool: 'Function Tool',
  MCP: 'MCP Server',
  Browser: 'Browser Agent',
  Human: 'Human Review',
  Webhook: 'Webhook Endpoint',
}

export const resourceCatalogService = {
  /**
   * Get catalog grouped by type.
   */
  async getCatalog(params?: { status?: string; search?: string }): Promise<CatalogGroup[]> {
    const result = await resourceRegistry.listContracts({
      status: params?.status || 'active',
      search: params?.search,
      limit: 200,
    })

    // Group by type
    const groups = new Map<string, ResourceContract[]>()
    for (const item of result.items) {
      const type = item.type
      if (!groups.has(type)) groups.set(type, [])
      groups.get(type)!.push(item)
    }

    // Build catalog items with health
    const catalogGroups: CatalogGroup[] = []
    for (const [type, items] of groups) {
      const catalogItems: CatalogItem[] = []
      for (const item of items) {
        const health = await resourceHealth.getLatest(item.id)
        const caps = 0 // TODO: get capability count
        catalogItems.push({ resource: item, health, capabilityCount: caps })
      }
      catalogGroups.push({
        type,
        label: TYPE_LABELS[type] || type,
        count: items.length,
        items: catalogItems,
      })
    }

    return catalogGroups
  },

  /**
   * Get a single catalog item with full details.
   */
  async getCatalogItem(resourceId: string): Promise<CatalogItem | null> {
    const resource = await resourceRegistry.getContract(resourceId)
    if (!resource) return null
    const health = await resourceHealth.getLatest(resourceId)
    const caps = 0 // TODO: get capability count
    return { resource, health, capabilityCount: caps }
  },

  /**
   * Get available resource types.
   */
  async getResourceTypes(): Promise<Array<{ type: string; label: string; count: number }>> {
    const stats = await resourceRegistry.getStats()
    return Object.entries(stats.byType)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => ({
        type,
        label: TYPE_LABELS[type] || type,
        count,
      }))
      .sort((a, b) => b.count - a.count)
  },

  /**
   * Search resources.
   */
  async search(query: string): Promise<ResourceContract[]> {
    const result = await resourceRegistry.listContracts({
      search: query,
      limit: 50,
    })
    return result.items
  },
}
