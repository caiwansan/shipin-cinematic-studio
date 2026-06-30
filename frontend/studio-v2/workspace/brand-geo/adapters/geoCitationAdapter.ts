// ============================================================
// Citation Adapter — GEO → Backend /api/geo/brands/:brandId/citations
// Uses GEOApiClient singleton (no bare fetch)
// ============================================================

import { client } from '../clients/GEOApiClient'
import type { Citation } from '~/studio-v2/types/geo'

export const geoCitationAdapter = {
  async list(params: { brandId: string }): Promise<Citation[]> {
    const res = await client.get<{ citations: Citation[] }>(`/brands/${params.brandId}/citations`)
    if (res.success) return res.data?.citations || res.data || (Array.isArray(res.data) ? res.data : [])
    return []
  },

  async get(id: string): Promise<Citation | null> {
    const res = await client.get<Citation>(`/citations/${id}`)
    if (res.success) return res.data || null
    return null
  },
}

export type GeoCitationAdapter = typeof geoCitationAdapter
