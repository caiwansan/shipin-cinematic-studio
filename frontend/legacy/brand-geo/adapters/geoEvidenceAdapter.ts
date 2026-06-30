// @deprecated — GEO v3 Legacy. Use design-system product blocks instead.
// ============================================================
// Evidence Adapter — GEO → Backend /api/geo/evidence
// Uses GEOApiClient singleton (no bare fetch)
// ============================================================

import { client } from '../clients/GEOApiClient'
import type { Evidence } from '~/studio-v2/types/geo/evidence'

export const geoEvidenceAdapter = {
  /**
   * 列出项目的所有 Evidence
   * GET /api/geo/evidence?projectId=xxx
   */
  async list(params: { projectId?: string; claimId?: string; limit?: number; offset?: number }): Promise<{ items: Evidence[]; total: number }> {
    const searchParams = new URLSearchParams()
    if (params.projectId) searchParams.set('projectId', params.projectId)
    if (params.claimId) searchParams.set('claimId', params.claimId)
    if (params.limit) searchParams.set('limit', String(params.limit))
    if (params.offset) searchParams.set('offset', String(params.offset))
    const res = await client.get<{ items: Evidence[]; total: number }>(`/evidence?${searchParams}`)
    if (res.success) {
      return { items: res.data?.items || [], total: res.data?.total || 0 }
    }
    console.error('[EvidenceAdapter] list error:', res.error)
    return { items: [], total: 0 }
  },

  /**
   * 获取单条 Evidence 详情（包含 citations）
   * GET /api/geo/evidence/:id
   */
  async get(id: string): Promise<Evidence | null> {
    const res = await client.get<Evidence>(`/evidence/${id}`)
    if (res.success) return res.data || null
    console.error('[EvidenceAdapter] get error:', res.error)
    return null
  },

  /**
   * 获取项目级可信度指标
   */
  async getProjectMetrics(projectId: string): Promise<{ averageScore: number; totalCount: number } | null> {
    const res = await client.get<{ items: Evidence[]; total: number }>(`/evidence?projectId=${projectId}`)
    if (res.success && res.data) {
      const items = res.data.items || []
      const total = items.length
      const avg = total > 0
        ? items.reduce((sum, e) => sum + (e.credibilityScore || 0), 0) / total
        : 0
      return { averageScore: avg, totalCount: total }
    }
    return null
  },
}

export type GeoEvidenceAdapter = typeof geoEvidenceAdapter
