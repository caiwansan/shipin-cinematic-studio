// ============================================================
// Resource Store — Pinia state management
// KMKI-PLAT-008
// ============================================================

import { defineStore } from 'pinia'
import { resourceService } from '../services/resource.service'
import type {
  ResourceContract,
  ResourceCredential,
  ResourceHealth,
  ResourceCapabilityMatrix,
  CatalogGroup,
  ResolverStrategy,
} from '../types/index'

interface ResourceState {
  contracts: ResourceContract[]
  totalContracts: number
  credentials: ResourceCredential[]
  healthOverview: Record<string, number>
  catalog: CatalogGroup[]
  strategies: ResolverStrategy[]
  loading: boolean
  error: string | null
}

export const useResourceStore = defineStore('resource', {
  state: (): ResourceState => ({
    contracts: [],
    totalContracts: 0,
    credentials: [],
    healthOverview: {},
    catalog: [],
    strategies: [],
    loading: false,
    error: null,
  }),

  getters: {
    activeContracts: (state) => state.contracts.filter(c => c.status === 'active'),
    healthyCount: (state) => state.healthOverview['healthy'] || 0,
    downCount: (state) => state.healthOverview['down'] || 0,
    degradedCount: (state) => state.healthOverview['degraded'] || 0,
  },

  actions: {
    async loadContracts(params?: {
      type?: string
      vendor?: string
      status?: string
      search?: string
      limit?: number
      offset?: number
    }) {
      this.loading = true
      this.error = null
      try {
        const result = await resourceService.listContracts(params)
        this.contracts = result.items
        this.totalContracts = result.total
      } catch (err: any) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    async loadCredentials(tenantId: string, resourceId?: string) {
      this.loading = true
      this.error = null
      try {
        this.credentials = await resourceService.listCredentials(tenantId, resourceId)
      } catch (err: any) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    async loadHealthOverview() {
      try {
        this.healthOverview = await resourceService.getHealthOverview()
      } catch (err: any) {
        this.error = err.message
      }
    },

    async loadCatalog(params?: { status?: string; search?: string }) {
      this.loading = true
      this.error = null
      try {
        this.catalog = await resourceService.getCatalog(params)
      } catch (err: any) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    async loadStrategies() {
      try {
        this.strategies = await resourceService.listStrategies()
      } catch (err: any) {
        this.error = err.message
      }
    },

    async createContract(data: Partial<ResourceContract>): Promise<ResourceContract | null> {
      try {
        const contract = await resourceService.createContract(data)
        await this.loadContracts()
        return contract
      } catch (err: any) {
        this.error = err.message
        return null
      }
    },

    async storeCredential(data: {
      resourceId: string
      tenantId: string
      name: string
      apiKey: string
      endpoint?: string
    }): Promise<ResourceCredential | null> {
      try {
        const credential = await resourceService.storeCredential(data)
        await this.loadCredentials(data.tenantId, data.resourceId)
        return credential
      } catch (err: any) {
        this.error = err.message
        return null
      }
    },

    async deleteCredential(id: string, tenantId: string) {
      try {
        await resourceService.deleteCredential(id)
        this.credentials = this.credentials.filter(c => c.id !== id)
      } catch (err: any) {
        this.error = err.message
      }
    },
  },
})
