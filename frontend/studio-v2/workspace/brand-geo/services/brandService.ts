// ============================================================
// BrandGEO — 品牌管理 Service
// ============================================================

import type { Brand } from '~/studio-v2/types/geo'
import { getAuthHeaders, handleResponse } from './utils'

const BASE = '/api/geo/brands'

export const brandService = {
  /** 获取品牌列表 */
  async list(): Promise<Brand[]> {
    const res = await fetch(BASE, { headers: getAuthHeaders() })
    const json = await handleResponse(res)
    return json.data?.brands || []
  },

  /** 获取单个品牌 */
  async get(id: string): Promise<Brand | null> {
    const res = await fetch(`${BASE}/${id}`, { headers: getAuthHeaders() })
    const json = await handleResponse(res)
    return json.data?.brand || null
  },

  /** 创建品牌 */
  async create(data: Partial<Brand>): Promise<Brand | null> {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    const json = await handleResponse(res)
    return json.data?.brand || null
  },

  /** 更新品牌 */
  async update(id: string, data: Partial<Brand>): Promise<boolean> {
    const res = await fetch(`${BASE}/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    await handleResponse(res)
    return true
  },

  /** 删除品牌 */
  async remove(id: string): Promise<boolean> {
    const res = await fetch(`${BASE}/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    await handleResponse(res)
    return true
  },
}
