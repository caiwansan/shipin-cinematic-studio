// @deprecated — GEO v3 Legacy. Use design-system product blocks instead.
// ============================================================
// BrandGEO — 竞品分析 Service
// 统一使用 GEOApiClient singleton
// ============================================================

import { client } from '../clients/GEOApiClient'
import type { Competitor, Topic } from '~/studio-v2/types/geo'

export const competitorService = {
  /** 获取竞品列表 */
  async list(brandId: string): Promise<Competitor[]> {
    const res = await client.get<{ competitors: Competitor[] }>(`/brands/${brandId}/competitors`)
    return res.data?.competitors || []
  },

  /** 添加竞品 */
  async create(brandId: string, data: Partial<Competitor>): Promise<Competitor | null> {
    const res = await client.post<{ competitor: Competitor }>(`/brands/${brandId}/competitors`, data)
    return res.data?.competitor || null
  },

  /** 删除竞品 */
  async remove(brandId: string, competitorId: string): Promise<boolean> {
    await client.delete(`/brands/${brandId}/competitors/${competitorId}`)
    return true
  },

  /** 获取话题分析 */
  async topics(brandId: string): Promise<Topic[]> {
    const res = await client.get<{ topics: Topic[] }>(`/brands/${brandId}/topics`)
    return res.data?.topics || []
  },
}
