// ============================================================
// Report Adapter — GEO → Backend /api/geo/reports
// Uses GEOApiClient singleton (no bare fetch)
// ============================================================

import { client } from '../clients/GEOApiClient'
import type { Report } from '~/studio-v2/types/geo/evidence'

export const geoReportAdapter = {
  /**
   * 获取项目可用报告类型
   * GET /api/geo/reports?projectId=xxx
   */
  async listTypes(projectId: string): Promise<{ type: string; label: string }[]> {
    const res = await client.get<{ type: string; label: string }[]>(`/reports?projectId=${projectId}`)
    if (res.success) return Array.isArray(res.data) ? res.data : []
    return []
  },

  /**
   * 生成指定类型报告
   * GET /api/geo/reports/generate?projectId=xxx&type=brand
   */
  async generate(projectId: string, type: string): Promise<Report | null> {
    const res = await client.get<Report>(`/reports/generate?projectId=${projectId}&type=${type}`)
    if (res.success) return res.data || null
    console.error('[ReportAdapter] generate error:', res.error)
    return null
  },
}

export type GeoReportAdapter = typeof geoReportAdapter
