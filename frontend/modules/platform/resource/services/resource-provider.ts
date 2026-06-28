// ============================================================
// Resource Provider — Cross-Workspace interface
// KMKI-PLAT-008
// ============================================================

import { resourceService } from './resource.service'
import type {
  ResourceContract,
  ResourceCredential,
  ResourceHealth,
  ResourceUsage,
  ResolveRequest,
  ResolveResponse,
  CatalogGroup,
} from '../types/index'

/**
 * ResourceProvider — used by any workspace that needs to
 * list resources, resolve capabilities, check health, track usage/cost.
 */
export const resourceProvider = {
  // ─── List Resources ───

  async listResources(params?: {
    type?: string
    vendor?: string
    search?: string
    limit?: number
    offset?: number
  }): Promise<{ items: ResourceContract[]; total: number }> {
    return resourceService.listContracts(params)
  },

  // ─── Get Resource ───

  async getResource(id: string): Promise<ResourceContract | null> {
    try {
      return resourceService.getContract(id)
    } catch {
      return null
    }
  },

  async getResourceByName(name: string): Promise<ResourceContract | null> {
    try {
      const result = await resourceService.listContracts({ search: name, limit: 1 })
      return result.items.find(c => c.name === name) || null
    } catch {
      return null
    }
  },

  // ─── Resolve ───

  async resolve(request: ResolveRequest): Promise<ResolveResponse | null> {
    try {
      return resourceService.resolve(request)
    } catch {
      return null
    }
  },

  // ─── Health ───

  async getHealth(resourceId: string): Promise<ResourceHealth | null> {
    try {
      return resourceService.getResourceHealth(resourceId)
    } catch {
      return null
    }
  },

  async getHealthOverview(): Promise<Record<string, number>> {
    return resourceService.getHealthOverview()
  },

  // ─── Usage ───

  async getUsage(tenantId: string, params?: {
    resourceType?: string
    limit?: number
    startDate?: string
    endDate?: string
  }): Promise<{ items: ResourceUsage[]; total: number }> {
    return resourceService.getUsageHistory(tenantId, params)
  },

  // ─── Cost ───

  async getCost(tenantId: string, params?: {
    billingPeriod?: string
  }): Promise<{ items: any[]; total: number }> {
    return resourceService.getCosts(tenantId, params)
  },

  // ─── Catalog ───

  async getCatalog(params?: { search?: string }): Promise<CatalogGroup[]> {
    return resourceService.getCatalog(params)
  },
}
