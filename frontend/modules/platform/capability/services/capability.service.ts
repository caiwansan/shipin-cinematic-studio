// ============================================================
// Capability Service — API calls to backend
// ============================================================

import type {
  CapabilityContract,
  ProviderMapping,
  CatalogSearchRequest,
  CatalogSearchResponse,
  ResolverRequest,
  ResolverResponse,
  ValidationResult,
  CapabilityStats,
  CapabilityHealth,
} from '../types/index'

function apiBase(): string {
  return '/api/capability'
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const token = window.localStorage.getItem('auth_token') || ''
    if (token) headers['Authorization'] = `Bearer ${token}`
  } catch { /* ignore */ }
  return headers
}

async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      headers: getAuthHeaders(),
      ...options,
    })
    if (!res.ok) throw new Error(`API error ${res.status}`)
    const json = await res.json()
    return json as T
  } catch (err: any) {
    console.error('[CapabilityService]', err.message)
    return null
  }
}

export const capabilityService = {
  // ─── Contracts ───

  async listContracts(params?: {
    category?: string
    status?: string
    search?: string
    tags?: string
    limit?: number
    offset?: number
  }): Promise<{ items: CapabilityContract[]; total: number }> {
    const searchParams = new URLSearchParams()
    if (params?.category) searchParams.set('category', params.category)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.search) searchParams.set('search', params.search)
    if (params?.tags) searchParams.set('tags', params.tags)
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.offset) searchParams.set('offset', String(params.offset))

    const result = await apiFetch<{ success: boolean; data: { items: CapabilityContract[]; total: number } }>(
      `/contract?${searchParams.toString()}`
    )
    return result?.data || { items: [], total: 0 }
  },

  async getContract(id: string): Promise<CapabilityContract | null> {
    const result = await apiFetch<{ success: boolean; data: CapabilityContract }>(`/contract/${id}`)
    return result?.data || null
  },

  async createContract(data: {
    name: string
    displayName: string
    description?: string
    category: string
    version?: string
    inputSchema?: object
    outputSchema?: object
  }): Promise<CapabilityContract | null> {
    const result = await apiFetch<{ success: boolean; data: CapabilityContract }>('/contract', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return result?.data || null
  },

  async updateContract(id: string, data: Partial<CapabilityContract>): Promise<CapabilityContract | null> {
    const result = await apiFetch<{ success: boolean; data: CapabilityContract }>(`/contract/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return result?.data || null
  },

  async deleteContract(id: string): Promise<boolean> {
    const result = await apiFetch<{ success: boolean }>(`/contract/${id}`, { method: 'DELETE' })
    return result?.success || false
  },

  // ─── Registry ───

  async registerCapability(data: {
    name: string
    displayName: string
    description?: string
    category: string
  }): Promise<CapabilityContract | null> {
    const result = await apiFetch<{ success: boolean; data: CapabilityContract }>('/registry/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return result?.data || null
  },

  async deprecateCapability(id: string): Promise<CapabilityContract | null> {
    const result = await apiFetch<{ success: boolean; data: CapabilityContract }>(`/registry/${id}/deprecate`, {
      method: 'POST',
    })
    return result?.data || null
  },

  // ─── Resolver ───

  async resolve(request: ResolverRequest): Promise<ResolverResponse | null> {
    const result = await apiFetch<{ success: boolean; data: ResolverResponse }>('/resolver/resolve', {
      method: 'POST',
      body: JSON.stringify(request),
    })
    return result?.data || null
  },

  async listStrategies(): Promise<string[]> {
    const result = await apiFetch<{ success: boolean; data: string[] }>('/resolver/strategies')
    return result?.data || []
  },

  // ─── Validator ───

  async validateInput(contractName: string, input: Record<string, unknown>): Promise<ValidationResult | null> {
    const result = await apiFetch<{ success: boolean; data: ValidationResult }>('/validator/input', {
      method: 'POST',
      body: JSON.stringify({ contractName, input }),
    })
    return result?.data || null
  },

  async validateOutput(contractName: string, output: Record<string, unknown>): Promise<ValidationResult | null> {
    const result = await apiFetch<{ success: boolean; data: ValidationResult }>('/validator/output', {
      method: 'POST',
      body: JSON.stringify({ contractName, output }),
    })
    return result?.data || null
  },

  async validate(contractName: string, data: {
    input?: Record<string, unknown>
    output?: Record<string, unknown>
    constraints?: Record<string, unknown>
    permissions?: Record<string, unknown>
  }): Promise<any> {
    const result = await apiFetch<{ success: boolean; data: any }>('/validator/validate', {
      method: 'POST',
      body: JSON.stringify({ contractName, ...data }),
    })
    return result?.data || null
  },

  // ─── Catalog ───

  async search(request: CatalogSearchRequest): Promise<CatalogSearchResponse | null> {
    const searchParams = new URLSearchParams()
    if (request.query) searchParams.set('query', request.query)
    if (request.category) searchParams.set('category', request.category as string)
    if (request.tags) searchParams.set('tags', request.tags.join(','))
    if (request.status) searchParams.set('status', request.status)
    if (request.limit) searchParams.set('limit', String(request.limit))
    if (request.offset) searchParams.set('offset', String(request.offset))

    const result = await apiFetch<{ success: boolean; data: CatalogSearchResponse }>(
      `/catalog/search?${searchParams.toString()}`
    )
    return result?.data || null
  },

  async getCategories(): Promise<string[]> {
    const result = await apiFetch<{ success: boolean; data: string[] }>('/catalog/categories')
    return result?.data || []
  },

  async browseByCategory(category: string): Promise<CapabilityContract[]> {
    const result = await apiFetch<{ success: boolean; data: { items: CapabilityContract[]; total: number } }>(
      `/catalog/category/${category}`
    )
    return result?.data?.items || []
  },

  async quickSearch(query: string): Promise<CapabilityContract[]> {
    const result = await apiFetch<{ success: boolean; data: { items: CapabilityContract[]; total: number } }>(
      `/catalog/quick?query=${encodeURIComponent(query)}`
    )
    return result?.data?.items || []
  },

  // ─── Stats ───

  async getStats(): Promise<CapabilityStats | null> {
    const result = await apiFetch<{ success: boolean; data: CapabilityStats }>('/stats')
    return result?.data || null
  },

  // ─── Health ───

  async getHealth(): Promise<CapabilityHealth | null> {
    const result = await apiFetch<{ success: boolean; data: CapabilityHealth }>('/health')
    return result?.data || null
  },

  // ─── Provider Mappings ───

  async getProviderMappings(capabilityId: string): Promise<ProviderMapping[]> {
    const result = await apiFetch<{ success: boolean; data: ProviderMapping[] }>(`/mapping/${capabilityId}`)
    return result?.data || []
  },

  async addProviderMapping(data: {
    capabilityId: string
    provider: string
    priority?: number
    config?: Record<string, unknown>
  }): Promise<ProviderMapping | null> {
    const result = await apiFetch<{ success: boolean; data: ProviderMapping }>('/mapping', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return result?.data || null
  },

  async deleteProviderMapping(id: string): Promise<boolean> {
    const result = await apiFetch<{ success: boolean }>(`/mapping/${id}`, { method: 'DELETE' })
    return result?.success || false
  },
}
