// ============================================================
// Semantic Service — API calls to backend
// ============================================================

import type {
  SemanticEntity, SemanticTopic, SemanticRelation, SemanticAlias,
  SemanticTaxonomy, SemanticKeyword, EntityFilter, TopicFilter,
  TaxonomyFilter, SemanticStats,
} from '../types/index'

function apiBase(): string {
  return '/api/semantic'
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
    console.error('[SemanticService]', err.message)
    return null
  }
}

export const semanticService = {
  // ─── Entities ───

  async listEntities(projectId: string, filter?: EntityFilter) {
    const params = new URLSearchParams()
    if (filter?.type) params.set('type', filter.type)
    if (filter?.name) params.set('name', filter.name)
    if (filter?.search) params.set('search', filter.search)
    if (filter?.confidenceMin) params.set('confidenceMin', String(filter.confidenceMin))
    if (filter?.limit) params.set('limit', String(filter.limit))
    if (filter?.offset) params.set('offset', String(filter.offset))
    const qs = params.toString()
    const result = await apiFetch<{ success: boolean; data: { items: SemanticEntity[]; total: number } }>(
      `/entity/project/${projectId}${qs ? '?' + qs : ''}`
    )
    return result?.data || { items: [], total: 0 }
  },

  async getEntity(id: string): Promise<SemanticEntity | null> {
    const result = await apiFetch<{ success: boolean; data: { entity: SemanticEntity } }>(`/entity/${id}`)
    return result?.data?.entity || null
  },

  async createEntity(data: { projectId: string; type: string; name: string; description?: string; confidence?: number }): Promise<SemanticEntity | null> {
    const result = await apiFetch<{ success: boolean; data: { entity: SemanticEntity } }>('/entity', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return result?.data?.entity || null
  },

  async updateEntity(id: string, data: Partial<SemanticEntity>): Promise<SemanticEntity | null> {
    const result = await apiFetch<{ success: boolean; data: { entity: SemanticEntity } }>(`/entity/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return result?.data?.entity || null
  },

  async deleteEntity(id: string): Promise<boolean> {
    const result = await apiFetch<{ success: boolean }>(`/entity/${id}`, { method: 'DELETE' })
    return result?.success || false
  },

  async resolveEntity(projectId: string, name: string) {
    const result = await apiFetch<{ success: boolean; data: { entity: SemanticEntity; matchedVia: string } | null }>(
      `/entity/resolve/${projectId}?name=${encodeURIComponent(name)}`
    )
    return result?.data || null
  },

  async getEntityStats(projectId: string) {
    const result = await apiFetch<{ success: boolean; data: { stats: Record<string, number> } }>(`/entity/stats/${projectId}`)
    return result?.data?.stats || { total: 0 }
  },

  // ─── Topics ───

  async listTopics(projectId: string, filter?: TopicFilter) {
    const params = new URLSearchParams()
    if (filter?.search) params.set('search', filter.search)
    if (filter?.name) params.set('name', filter.name)
    if (filter?.limit) params.set('limit', String(filter.limit))
    if (filter?.offset) params.set('offset', String(filter.offset))
    const qs = params.toString()
    const result = await apiFetch<{ success: boolean; data: { items: SemanticTopic[]; total: number } }>(
      `/topic/project/${projectId}${qs ? '?' + qs : ''}`
    )
    return result?.data || { items: [], total: 0 }
  },

  async getTopic(id: string): Promise<SemanticTopic | null> {
    const result = await apiFetch<{ success: boolean; data: { topic: SemanticTopic } }>(`/topic/${id}`)
    return result?.data?.topic || null
  },

  // ─── Taxonomy ───

  async getTaxonomyTree(projectId: string) {
    const result = await apiFetch<{ success: boolean; data: { tree: SemanticTaxonomy[] } }>(`/taxonomy/tree/${projectId}`)
    return result?.data?.tree || []
  },

  async getTaxonomyRoots(projectId: string) {
    const result = await apiFetch<{ success: boolean; data: { roots: SemanticTaxonomy[] } }>(`/taxonomy/roots/${projectId}`)
    return result?.data?.roots || []
  },

  async getTaxonomyChildren(id: string) {
    const result = await apiFetch<{ success: boolean; data: { children: SemanticTaxonomy[] } }>(`/taxonomy/${id}/children`)
    return result?.data?.children || []
  },

  // ─── Aliases ───

  async listAliases(projectId: string) {
    const result = await apiFetch<{ success: boolean; data: { aliases: SemanticAlias[] } }>(`/alias/project/${projectId}`)
    return result?.data?.aliases || []
  },

  async resolveAlias(alias: string, projectId?: string) {
    const url = `/alias/resolve/${encodeURIComponent(alias)}${projectId ? `?projectId=${projectId}` : ''}`
    const result = await apiFetch<{ success: boolean; data: { alias: SemanticAlias } | null }>(url)
    return result?.data?.alias || null
  },

  // ─── Keywords ───

  async listKeywords(projectId: string, filter?: { search?: string; limit?: number }) {
    const params = new URLSearchParams()
    if (filter?.search) params.set('search', filter.search)
    if (filter?.limit) params.set('limit', String(filter.limit))
    const qs = params.toString()
    const result = await apiFetch<{ success: boolean; data: { items: SemanticKeyword[]; total: number } }>(
      `/keyword/project/${projectId}${qs ? '?' + qs : ''}`
    )
    return result?.data || { items: [], total: 0 }
  },

  async getTopKeywords(projectId: string, limit = 50) {
    const result = await apiFetch<{ success: boolean; data: { keywords: SemanticKeyword[] } }>(`/keyword/top/${projectId}?limit=${limit}`)
    return result?.data?.keywords || []
  },

  // ─── Stats ───

  async getStats(projectId: string): Promise<SemanticStats> {
    const result = await apiFetch<{ success: boolean; data: { stats: SemanticStats } }>(`/stats/${projectId}`)
    return result?.data?.stats || { entityCount: 0, topicCount: 0, relationCount: 0, aliasCount: 0, taxonomyCount: 0, keywordCount: 0 }
  },

  // ─── Pipeline ───

  async extract(projectId: string, content: string, sourceUrl?: string, assetId?: string) {
    const result = await apiFetch<{ success: boolean; data: any }>('/extract', {
      method: 'POST',
      body: JSON.stringify({ projectId, content, sourceUrl, assetId }),
    })
    return result?.data || null
  },

  async extractAsset(assetId: string, projectId: string) {
    const result = await apiFetch<{ success: boolean; data: any }>(`/extract/${assetId}`, {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    })
    return result?.data || null
  },

  async rebuild(projectId: string) {
    const result = await apiFetch<{ success: boolean; data: any }>(`/rebuild/${projectId}`, { method: 'POST' })
    return result?.data || null
  },
}
