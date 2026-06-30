// @deprecated — GEO v3 Legacy. Use design-system product blocks instead.
// ============================================================
// BrandGEO — 可见性 Service
// 统一使用 GEOApiClient singleton
// ============================================================

import { client } from '../clients/GEOApiClient'
import type { VisibilityMetric, SearchVisibility } from '~/studio-v2/types/geo'

export const visibilityService = {
  /** 获取可见性指标 */
  async getMetrics(brandId: string): Promise<VisibilityMetric[]> {
    const res = await client.get<{ metrics: VisibilityMetric[] }>(`/brands/${brandId}/visibility/metrics`)
    return res.data?.metrics || []
  },

  /** 获取搜索引擎可见性 */
  async getSearchVisibility(brandId: string): Promise<SearchVisibility[]> {
    const res = await client.get<{ results: SearchVisibility[] }>(`/brands/${brandId}/visibility/search`)
    return res.data?.results || []
  },

  /** 运行可见性审计 */
  async runAudit(brandId: string): Promise<boolean> {
    await client.post(`/brands/${brandId}/visibility/audit`)
    return true
  },
}
