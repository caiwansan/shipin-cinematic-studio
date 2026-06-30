/**
 * brandService — Brand/Project operations via GEOApiClient.
 */
import { client } from '../clients/GEOApiClient'
import type { Brand } from '../components/brand/types'

export const brandService = {
  async list(): Promise<Brand[]> {
    const res = await client.get<Brand[]>('/brands')
    return Array.isArray(res.data) ? res.data : []
  },

  async get(id: string): Promise<Brand | null> {
    const res = await client.get<{ brand: Brand }>(`/brands/${id}`)
    return res.data?.brand || null
  },

  async create(data: Partial<Brand>): Promise<Brand | null> {
    const res = await client.post<{ brand: Brand }>('/brands', data)
    return res.data?.brand || null
  },

  async update(id: string, data: Partial<Brand>): Promise<void> {
    await client.put(`/brands/${id}`, data)
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/brands/${id}`)
  },

  async getSettings(id: string): Promise<Record<string, unknown>> {
    const res = await client.get<Record<string, unknown>>(`/brands/${id}/settings`)
    return res.data || {}
  },

  async updateSettings(id: string, data: Record<string, unknown>): Promise<void> {
    await client.put(`/brands/${id}/settings`, data)
  },

  async getStatus(id: string): Promise<Record<string, unknown>> {
    const res = await client.get<Record<string, unknown>>(`/brands/${id}/status`)
    return res.data || {}
  },

  /**
   * One-click: create brand → start scan → auto-create keywords
   * Returns {brand, scan, keywords} result
   */
  async createAndAnalyze(name: string): Promise<{ brand: Brand | null; scan: any; keywords: any }> {
    // 1. Create brand
    const brand = await this.create({ name } as Partial<Brand>)
    if (!brand || !brand.id) throw new Error('创建品牌失败')

    let scanResult: any = null
    let keywordResult: any = null

    // 2. Auto-start scan
    try {
      scanResult = await client.post('/scans', { projectId: brand.id, scanType: 'website' })
    } catch {
      // non-blocking
    }

    // 3. Auto-create keywords
    try {
      keywordResult = await client.post('/keywords', {
        projectId: brand.id,
        keywords: [
          { keyword: name, type: 'brand', source: 'auto' },
          { keyword: `${name} 品牌`, type: 'brand', source: 'auto' },
        ].filter(k => k.keyword),
      })
    } catch {
      // non-blocking
    }

    return { brand, scan: scanResult, keywords: keywordResult }
  },
}
