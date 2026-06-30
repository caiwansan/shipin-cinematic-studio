// ============================================================
// History Adapter — GEO → Backend /api/geo/history
// Uses GEOApiClient singleton (no bare fetch)
// ============================================================

import { client } from '../clients/GEOApiClient'
import type { HistoryEvent } from '~/studio-v2/types/geo/evidence'

export const geoHistoryAdapter = {
  /**
   * 获取项目事件时间线
   * GET /api/geo/history?projectId=xxx&type=scan|claim|evidence|all
   */
  async list(params: { projectId: string; type?: string; limit?: number; offset?: number }): Promise<{ items: HistoryEvent[]; total: number }> {
    const searchParams = new URLSearchParams({ projectId: params.projectId })
    if (params.type) searchParams.set('type', params.type)
    if (params.limit) searchParams.set('limit', String(params.limit))
    if (params.offset) searchParams.set('offset', String(params.offset))
    const res = await client.get<{ items: HistoryEvent[]; total: number }>(`/history?${searchParams}`)
    if (res.success) {
      return { items: res.data?.items || [], total: res.data?.total || 0 }
    }
    console.error('[HistoryAdapter] list error:', res.error)
    return { items: [], total: 0 }
  },

  /**
   * 获取项目事件统计
   * GET /api/geo/history/stats?projectId=xxx
   */
  async getStats(projectId: string): Promise<{ scans: number; claims: number; knowledge: number; evidence: number } | null> {
    const res = await client.get<{ scans: number; claims: number; knowledge: number; evidence: number }>(`/history/stats?projectId=${projectId}`)
    if (res.success) return res.data || null
    return null
  },
}

export type GeoHistoryAdapter = typeof geoHistoryAdapter
