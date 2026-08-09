// ============================================================
// Explain Service — RC1-T004 Explain Everywhere
// SSOT: All explain data from ExplainEngine via GET /api/geo/explain/:type/:id
// ============================================================

import { geoApi } from './api'
import type { ExplainResult } from '../types/explain'

export const explainService = {
  async getExplain(type: string, projectId: string): Promise<ExplainResult> {
    const res = await geoApi.get<{ success: boolean; data: ExplainResult }>(`/explain/${type}/${projectId}`)
    return res.data
  },
}
