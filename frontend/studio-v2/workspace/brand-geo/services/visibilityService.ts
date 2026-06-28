// ============================================================
// BrandGEO — 可见性 Service
// ============================================================

import type { VisibilityMetric, SearchVisibility } from '~/studio-v2/types/geo'
import { getAuthHeaders, handleResponse } from './utils'

const BASE = '/api/geo/brands'

export const visibilityService = {
  /** 获取可见性指标 */
  async getMetrics(brandId: string): Promise<VisibilityMetric[]> {
    const res = await fetch(`${BASE}/${brandId}/visibility/metrics`, { headers: getAuthHeaders() })
    const json = await handleResponse(res)
    return json.data?.metrics || []
  },

  /** 获取搜索引擎可见性 */
  async getSearchVisibility(brandId: string): Promise<SearchVisibility[]> {
    const res = await fetch(`${BASE}/${brandId}/visibility/search`, { headers: getAuthHeaders() })
    const json = await handleResponse(res)
    return json.data?.results || []
  },

  /** 运行可见性审计 */
  async runAudit(brandId: string): Promise<boolean> {
    const res = await fetch(`${BASE}/${brandId}/visibility/audit`, {
      method: 'POST',
      headers: getAuthHeaders(),
    })
    await handleResponse(res)
    return true
  },
}
