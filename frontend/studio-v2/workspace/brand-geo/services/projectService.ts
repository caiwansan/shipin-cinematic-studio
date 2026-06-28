// ============================================================
// BrandGEO — 项目管理 Service
// ============================================================

import type { GeoProject, GeoTask } from '~/studio-v2/types/geo'
import { getAuthHeaders, handleResponse } from './utils'

const BASE = '/api/geo'

export const projectService = {
  /** 获取项目列表 */
  async list(brandId?: string): Promise<GeoProject[]> {
    const query = brandId ? `?brandId=${brandId}` : ''
    const res = await fetch(`${BASE}/projects${query}`, { headers: getAuthHeaders() })
    const json = await handleResponse(res)
    return json.data?.projects || []
  },

  /** 获取单个项目 */
  async get(id: string): Promise<GeoProject | null> {
    const res = await fetch(`${BASE}/projects/${id}`, { headers: getAuthHeaders() })
    const json = await handleResponse(res)
    return json.data?.project || null
  },

  /** 创建项目 */
  async create(data: Partial<GeoProject>): Promise<GeoProject | null> {
    const res = await fetch(`${BASE}/projects`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    const json = await handleResponse(res)
    return json.data?.project || null
  },

  /** 更新项目 */
  async update(id: string, data: Partial<GeoProject>): Promise<boolean> {
    const res = await fetch(`${BASE}/projects/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    await handleResponse(res)
    return true
  },

  /** 删除项目 */
  async remove(id: string): Promise<boolean> {
    const res = await fetch(`${BASE}/projects/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    await handleResponse(res)
    return true
  },

  /** 获取项目任务 */
  async getTasks(projectId: string): Promise<GeoTask[]> {
    const res = await fetch(`${BASE}/projects/${projectId}/tasks`, { headers: getAuthHeaders() })
    const json = await handleResponse(res)
    return json.data?.tasks || []
  },

  /** 创建任务 */
  async createTask(projectId: string, data: Partial<GeoTask>): Promise<GeoTask | null> {
    const res = await fetch(`${BASE}/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    const json = await handleResponse(res)
    return json.data?.task || null
  },
}
