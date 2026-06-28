// ============================================================
// Resource Service — API calls for Resource Runtime
// KMKI-PLAT-008
// ============================================================

import type {
  ResourceContract,
  ResourceCredential,
  ResourceHealth,
  ResourceCapabilityMatrix,
  ResourceUsage,
  ResourceCost,
  ResolveRequest,
  ResolveResponse,
  CatalogGroup,
  ResolverStrategy,
} from '../types/index'

const BASE_URL = '/api/resource'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = await res.json()
  if (!json.success) {
    throw new Error(json.error || 'Request failed')
  }
  return json.data as T
}

export const resourceService = {
  // ─── Contracts ───

  async listContracts(params?: {
    type?: string
    vendor?: string
    status?: string
    search?: string
    limit?: number
    offset?: number
  }): Promise<{ items: ResourceContract[]; total: number }> {
    const searchParams = new URLSearchParams()
    if (params?.type) searchParams.set('type', params.type)
    if (params?.vendor) searchParams.set('vendor', params.vendor)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.search) searchParams.set('search', params.search)
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.offset) searchParams.set('offset', String(params.offset))
    const qs = searchParams.toString()
    return request(`${BASE_URL}/contract${qs ? `?${qs}` : ''}`)
  },

  async getContract(id: string): Promise<ResourceContract> {
    return request(`${BASE_URL}/contract/${id}`)
  },

  async createContract(data: Partial<ResourceContract>): Promise<ResourceContract> {
    return request(`${BASE_URL}/contract`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updateContract(id: string, data: Partial<ResourceContract>): Promise<ResourceContract> {
    return request(`${BASE_URL}/contract/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async deleteContract(id: string): Promise<void> {
    await fetch(`${BASE_URL}/contract/${id}`, { method: 'DELETE' })
  },

  async getContractStats(): Promise<{
    total: number
    byType: Record<string, number>
    byVendor: Record<string, number>
    active: number
    deprecated: number
  }> {
    return request(`${BASE_URL}/contract/stats`)
  },

  // ─── Credentials ───

  async listCredentials(tenantId: string, resourceId?: string): Promise<ResourceCredential[]> {
    const searchParams = new URLSearchParams({ tenantId })
    if (resourceId) searchParams.set('resourceId', resourceId)
    return request(`${BASE_URL}/credential?${searchParams}`)
  },

  async storeCredential(data: {
    resourceId: string
    tenantId: string
    workspaceId?: string
    name: string
    apiKey: string
    endpoint?: string
    models?: string[]
    expiresAt?: string
  }): Promise<ResourceCredential> {
    return request(`${BASE_URL}/credential`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async deleteCredential(id: string): Promise<void> {
    await fetch(`${BASE_URL}/credential/${id}`, { method: 'DELETE' })
  },

  async rotateCredential(id: string, newApiKey: string): Promise<ResourceCredential> {
    return request(`${BASE_URL}/credential/${id}/rotate`, {
      method: 'POST',
      body: JSON.stringify({ newApiKey }),
    })
  },

  // ─── Resolver ───

  async resolve(request: ResolveRequest): Promise<ResolveResponse> {
    return request(`${BASE_URL}/resolver/resolve`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  async checkResolvable(capabilityName: string, tenantId: string): Promise<boolean> {
    const data = await request<{ resolvable: boolean }>(`${BASE_URL}/resolver/check?capabilityName=${encodeURIComponent(capabilityName)}&tenantId=${encodeURIComponent(tenantId)}`)
    return data.resolvable
  },

  async listStrategies(): Promise<ResolverStrategy[]> {
    return request(`${BASE_URL}/resolver/strategies`)
  },

  // ─── Health ───

  async getHealthOverview(): Promise<Record<string, number>> {
    return request(`${BASE_URL}/health/overview`)
  },

  async checkHealth(resourceId: string): Promise<ResourceHealth> {
    return request(`${BASE_URL}/health/check/${resourceId}`, { method: 'POST' })
  },

  async getResourceHealth(resourceId: string): Promise<ResourceHealth> {
    return request(`${BASE_URL}/health/${resourceId}`)
  },

  // ─── Usage ───

  async recordUsage(data: Partial<ResourceUsage>): Promise<ResourceUsage> {
    return request(`${BASE_URL}/usage`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async getUsageHistory(tenantId: string, params?: {
    resourceType?: string
    status?: string
    limit?: number
    offset?: number
    startDate?: string
    endDate?: string
  }): Promise<{ items: ResourceUsage[]; total: number }> {
    const searchParams = new URLSearchParams({ tenantId })
    if (params?.resourceType) searchParams.set('resourceType', params.resourceType)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.offset) searchParams.set('offset', String(params.offset))
    if (params?.startDate) searchParams.set('startDate', params.startDate)
    if (params?.endDate) searchParams.set('endDate', params.endDate)
    return request(`${BASE_URL}/usage?${searchParams}`)
  },

  async aggregateUsage(tenantId: string, startDate?: string, endDate?: string): Promise<{
    totalCost: number
    totalTokens: number
    totalRequests: number
    byType: Record<string, { count: number; cost: number; tokens: number }>
  }> {
    const searchParams = new URLSearchParams({ tenantId })
    if (startDate) searchParams.set('startDate', startDate)
    if (endDate) searchParams.set('endDate', endDate)
    return request(`${BASE_URL}/usage/aggregate?${searchParams}`)
  },

  // ─── Cost ───

  async getCosts(tenantId: string, params?: {
    workspaceId?: string
    billingPeriod?: string
    limit?: number
    offset?: number
  }): Promise<{ items: ResourceCost[]; total: number }> {
    const searchParams = new URLSearchParams({ tenantId })
    if (params?.workspaceId) searchParams.set('workspaceId', params.workspaceId)
    if (params?.billingPeriod) searchParams.set('billingPeriod', params.billingPeriod)
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.offset) searchParams.set('offset', String(params.offset))
    return request(`${BASE_URL}/cost?${searchParams}`)
  },

  async getTotalCost(tenantId: string, startDate?: string, endDate?: string): Promise<number> {
    const searchParams = new URLSearchParams({ tenantId })
    if (startDate) searchParams.set('startDate', startDate)
    if (endDate) searchParams.set('endDate', endDate)
    const data = await request<{ total: number }>(`${BASE_URL}/cost/total?${searchParams}`)
    return data.total
  },

  async estimateCost(resourceId: string, promptLength?: number, expectedOutputLength?: number): Promise<any> {
    return request(`${BASE_URL}/cost/estimate`, {
      method: 'POST',
      body: JSON.stringify({ resourceId, promptLength, expectedOutputLength }),
    })
  },

  // ─── Matrix ───

  async mapCapability(data: {
    resourceId: string
    capabilityId: string
    supported: boolean
    qualityScore?: number
    costMultiplier?: number
  }): Promise<ResourceCapabilityMatrix> {
    return request(`${BASE_URL}/matrix`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async getResourceCapabilities(resourceId: string): Promise<ResourceCapabilityMatrix[]> {
    return request(`${BASE_URL}/matrix/resource/${resourceId}`)
  },

  async getCapabilityResources(capabilityId: string): Promise<ResourceCapabilityMatrix[]> {
    return request(`${BASE_URL}/matrix/capability/${capabilityId}`)
  },

  async getCapabilityResourceMap(): Promise<Record<string, string[]>> {
    return request(`${BASE_URL}/matrix/map`)
  },

  async unmapCapability(resourceId: string, capabilityId: string): Promise<void> {
    await fetch(`${BASE_URL}/matrix/${resourceId}/${capabilityId}`, { method: 'DELETE' })
  },

  async validateMatrix(): Promise<{ valid: boolean; issues: Array<{ severity: string; message: string }> }> {
    return request(`${BASE_URL}/matrix/validate`)
  },

  // ─── Catalog ───

  async getCatalog(params?: { status?: string; search?: string }): Promise<CatalogGroup[]> {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.search) searchParams.set('search', params.search)
    const qs = searchParams.toString()
    return request(`${BASE_URL}/catalog${qs ? `?${qs}` : ''}`)
  },

  async getResourceTypes(): Promise<Array<{ type: string; label: string; count: number }>> {
    return request(`${BASE_URL}/types`)
  },

  async searchResources(q: string): Promise<ResourceContract[]> {
    return request(`${BASE_URL}/search?q=${encodeURIComponent(q)}`)
  },
}
