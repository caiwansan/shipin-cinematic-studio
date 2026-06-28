// ============================================================
// BrandGEO — 竞品分析 Service
// ============================================================

import type { Competitor, Topic } from '~/studio-v2/types/geo'
import { getAuthHeaders, handleResponse } from './utils'

const BASE = '/api/geo/brands'

export const competitorService = {
  /** 获取竞品列表 */
  async list(brandId: string): Promise<Competitor[]> {
    const res = await fetch(`${BASE}/${brandId}/competitors`, { headers: getAuthHeaders() })
    const json = await handleResponse(res)
    return json.data?.competitors || []
  },

  /** 添加竞品 */
  async create(brandId: string, data: Partial<Competitor>): Promise<Competitor | null> {
    const res = await fetch(`${BASE}/${brandId}/competitors`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    const json = await handleResponse(res)
    return json.data?.competitor || null
  },

  /** 删除竞品 */
  async remove(brandId: string, competitorId: string): Promise<boolean> {
    const res = await fetch(`${BASE}/${brandId}/competitors/${competitorId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    await handleResponse(res)
    return true
  },

  /** 获取热门话题 */
  async getTopics(brandId: string): Promise<Topic[]> {
    const res = await fetch(`${BASE}/${brandId}/topics`, { headers: getAuthHeaders() })
    const json = await handleResponse(res)
    return json.data?.topics || []
  },
}
