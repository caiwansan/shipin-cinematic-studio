// ============================================================
// BrandGEO — 引用追踪 Service
// ============================================================

import type { Citation } from '~/studio-v2/types/geo'
import { getAuthHeaders, handleResponse } from './utils'

const BASE = '/api/geo/brands'

export const citationService = {
  /** 获取引用列表 */
  async list(brandId: string): Promise<Citation[]> {
    const res = await fetch(`${BASE}/${brandId}/citations`, { headers: getAuthHeaders() })
    const json = await handleResponse(res)
    return json.data?.citations || []
  },

  /** 添加引用 */
  async create(brandId: string, data: Partial<Citation>): Promise<Citation | null> {
    const res = await fetch(`${BASE}/${brandId}/citations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    const json = await handleResponse(res)
    return json.data?.citation || null
  },

  /** 删除引用 */
  async remove(brandId: string, citationId: string): Promise<boolean> {
    const res = await fetch(`${BASE}/${brandId}/citations/${citationId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    await handleResponse(res)
    return true
  },
}
