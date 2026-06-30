// @deprecated — GEO v3 Legacy. Use design-system product blocks instead.
// ============================================================
// Claim Adapter — GEO → Backend /api/geo/claims
// Uses GEOApiClient singleton (no bare fetch)
// ============================================================

import { client } from '../clients/GEOApiClient'
import type { Claim } from '~/studio-v2/types/geo/evidence'

export const geoClaimAdapter = {
  /**
   * 列出项目的所有 Claims
   * GET /api/geo/claims?projectId=xxx
   */
  async list(params: { projectId?: string; entityId?: string; status?: string; limit?: number; offset?: number }): Promise<{ items: Claim[]; total: number }> {
    const searchParams = new URLSearchParams()
    if (params.projectId) searchParams.set('projectId', params.projectId)
    if (params.entityId) searchParams.set('entityId', params.entityId)
    if (params.status) searchParams.set('status', params.status)
    if (params.limit) searchParams.set('limit', String(params.limit))
    if (params.offset) searchParams.set('offset', String(params.offset))
    const res = await client.get<{ items: Claim[]; total: number }>(`/claims?${searchParams}`)
    if (res.success) {
      return { items: res.data?.items || [], total: res.data?.total || 0 }
    }
    console.error('[ClaimAdapter] list error:', res.error)
    return { items: [], total: 0 }
  },

  /**
   * 获取单条 Claim 详情（包含 evidences + citations）
   * GET /api/geo/claims/:id
   */
  async get(id: string): Promise<Claim | null> {
    const res = await client.get<Claim>(`/claims/${id}`)
    if (res.success) return res.data || null
    console.error('[ClaimAdapter] get error:', res.error)
    return null
  },

  /**
   * 更新 Claim 状态
   * PATCH /api/geo/claims/:id
   */
  async updateStatus(id: string, status: string): Promise<boolean> {
    const res = await client.patch<boolean>(`/claims/${id}`, { status })
    return res.success === true
  },
}

export type GeoClaimAdapter = typeof geoClaimAdapter
