// @deprecated — GEO v3 Legacy. Use design-system product blocks instead.
// ============================================================
// BrandGEO — 引用追踪 Service
// 统一使用 GEOApiClient singleton
// ============================================================

import { client } from '../clients/GEOApiClient'
import type { Citation } from '~/studio-v2/types/geo'

export const citationService = {
  /** 获取引用列表 */
  async list(brandId: string): Promise<Citation[]> {
    const res = await client.get<{ citations: Citation[] }>(`/brands/${brandId}/citations`)
    return res.data?.citations || []
  },

  /** 添加引用 */
  async create(brandId: string, data: Partial<Citation>): Promise<Citation | null> {
    const res = await client.post<{ citation: Citation }>(`/brands/${brandId}/citations`, data)
    return res.data?.citation || null
  },

  /** 删除引用 */
  async remove(brandId: string, citationId: string): Promise<boolean> {
    await client.delete(`/brands/${brandId}/citations/${citationId}`)
    return true
  },
}
