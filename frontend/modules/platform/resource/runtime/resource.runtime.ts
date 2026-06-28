// ============================================================
// Resource Runtime — frontend runtime wrapper
// KMKI-PLAT-008
// ============================================================

import { resourceService } from '../services/resource.service'
import { resourceProvider } from '../services/resource-provider'
import { useResourceStore } from '../store/useResourceStore'
import type {
  ResolveRequest,
  ResolveResponse,
  ResourceContract,
  ResourceHealth,
} from '../types/index'

/**
 * Frontend Resource Runtime — wraps API calls with store integration.
 * Follows the same ARCH-002 lifecycle pattern.
 */
export const resourceRuntime = {
  name: 'ResourceRuntime',

  async init() {
    console.log('[ResourceRuntime] Frontend runtime initialized')
  },

  // ─── Resolve ───

  async resolve(request: ResolveRequest): Promise<ResolveResponse | null> {
    return resourceProvider.resolve(request)
  },

  // ─── Health ───

  async checkResource(resourceId: string): Promise<ResourceHealth | null> {
    try {
      return resourceService.checkHealth(resourceId)
    } catch {
      return null
    }
  },

  // ─── Credential Management ───

  async storeCredential(data: {
    resourceId: string
    tenantId: string
    name: string
    apiKey: string
    endpoint?: string
  }) {
    const store = useResourceStore()
    return store.storeCredential(data)
  },

  async deleteCredential(id: string, tenantId: string) {
    const store = useResourceStore()
    return store.deleteCredential(id, tenantId)
  },

  // ─── Contract Management ───

  async listContracts(params?: {
    type?: string
    vendor?: string
    status?: string
    search?: string
    limit?: number
    offset?: number
  }) {
    const store = useResourceStore()
    await store.loadContracts(params)
    return { items: store.contracts, total: store.totalContracts }
  },

  // ─── Catalog ───

  async loadCatalog(params?: { search?: string }) {
    const store = useResourceStore()
    await store.loadCatalog(params)
    return store.catalog
  },

  // ─── Usage & Cost ───

  async getUsage(tenantId: string, params?: {
    resourceType?: string
    limit?: number
    startDate?: string
    endDate?: string
  }) {
    return resourceProvider.getUsage(tenantId, params)
  },

  async getCost(tenantId: string, params?: { billingPeriod?: string }) {
    return resourceProvider.getCost(tenantId, params)
  },
}
