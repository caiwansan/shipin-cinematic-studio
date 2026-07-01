// ============================================================
// Explain Service — RC1-T004 Explain Everywhere
// SSOT: All explain data from ExplainEngine via GET /api/geo/explain/:type/:id
// ============================================================

import type { ExplainResult } from '../types/explain'

const API_BASE = '/api/geo/explain'

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = window.localStorage?.getItem('auth_token') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const explainService = {
  async getExplain(type: string, projectId: string): Promise<ExplainResult> {
    const res = await fetch(`${API_BASE}/${type}/${projectId}`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    })
    const json = await res.json()
    if (!json.success || !json.data) {
      throw new Error(json.error || '获取 Explain 数据失败')
    }
    return json.data as ExplainResult
  },
}
