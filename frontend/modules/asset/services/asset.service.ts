// ============================================================
// Asset Service — API calls to backend
// ============================================================

import type { UnifiedAsset, AssetFilter, AssetListResult, AssetStats } from '../types/index'

function apiBase(): string {
  return '/api/asset'
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const el = document.cookie.match(/token=([^;]+)/)
    if (el) headers['Authorization'] = `Bearer ${el[1]}`
    const lsToken = window.localStorage.getItem('auth_token')
    if (lsToken) headers['Authorization'] = `Bearer ${lsToken}`
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
    console.error('[AssetService]', err.message)
    return null
  }
}

export const assetService = {
  async list(projectId: string, filter?: AssetFilter): Promise<AssetListResult> {
    const params = new URLSearchParams()
    if (filter?.type) params.set('type', filter.type)
    if (filter?.status) params.set('status', filter.status)
    if (filter?.source) params.set('source', filter.source)
    if (filter?.tag) params.set('tag', filter.tag)
    if (filter?.search) params.set('search', filter.search)
    if (filter?.language) params.set('language', filter.language)
    if (filter?.limit) params.set('limit', String(filter.limit))
    if (filter?.offset) params.set('offset', String(filter.offset))

    const qs = params.toString()
    const result = await apiFetch<{ success: boolean; data: AssetListResult }>(`/project/${projectId}${qs ? '?' + qs : ''}`)
    return result?.data || { items: [], total: 0 }
  },

  async getById(id: string): Promise<UnifiedAsset | null> {
    const result = await apiFetch<{ success: boolean; data: { asset: UnifiedAsset } }>(`/${id}`)
    return result?.data?.asset || null
  },

  async create(data: Partial<UnifiedAsset> & { projectId: string; type: string; title: string }): Promise<UnifiedAsset | null> {
    const result = await apiFetch<{ success: boolean; data: { asset: UnifiedAsset } }>('', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return result?.data?.asset || null
  },

  async update(id: string, data: Partial<UnifiedAsset>): Promise<UnifiedAsset | null> {
    const result = await apiFetch<{ success: boolean; data: { asset: UnifiedAsset } }>(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return result?.data?.asset || null
  },

  async delete(id: string): Promise<boolean> {
    const result = await apiFetch<{ success: boolean }>(`/${id}`, { method: 'DELETE' })
    return result?.success || false
  },

  async getStats(projectId: string): Promise<AssetStats> {
    const result = await apiFetch<{ success: boolean; data: { stats: AssetStats } }>(`/stats/${projectId}`)
    return result?.data?.stats || { total: 0 }
  },

  async search(query: string, filter?: AssetFilter): Promise<AssetListResult> {
    const params = new URLSearchParams()
    params.set('q', query)
    if (filter?.type) params.set('type', filter.type)
    if (filter?.status) params.set('status', filter.status)
    if (filter?.projectId) params.set('projectId', filter.projectId)

    const result = await apiFetch<{ success: boolean; data: AssetListResult }>(`/search?${params.toString()}`)
    return result?.data || { items: [], total: 0 }
  },

  async addTag(assetId: string, tag: string): Promise<boolean> {
    const result = await apiFetch<{ success: boolean }>(`/${assetId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag }),
    })
    return result?.success || false
  },

  async removeTag(assetId: string, tag: string): Promise<boolean> {
    const result = await apiFetch<{ success: boolean }>(`/${assetId}/tags/${tag}`, { method: 'DELETE' })
    return result?.success || false
  },
}

// Provider interface implementation
export const assetProvider = {
  async importAsset(source: string, type: string): Promise<UnifiedAsset | null> {
    return assetService.create({ projectId: '', type, title: source, source: 'import', sourceUrl: source })
  },

  async exportAsset(id: string): Promise<UnifiedAsset | null> {
    return assetService.getById(id)
  },

  async getAsset(id: string): Promise<UnifiedAsset | null> {
    return assetService.getById(id)
  },

  async listAssets(projectId: string, filter?: AssetFilter): Promise<AssetListResult> {
    return assetService.list(projectId, filter)
  },

  async updateAsset(id: string, data: Partial<UnifiedAsset>): Promise<UnifiedAsset | null> {
    return assetService.update(id, data)
  },

  async deleteAsset(id: string): Promise<boolean> {
    return assetService.delete(id)
  },
}
