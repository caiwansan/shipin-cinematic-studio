/**
 * GEO Health Service — Real API Implementation
 *
 * GET /api/geo/health/{projectId}
 *
 * API Returns: { success, data: { brand, healthScore, dimensions, explanation, coverage, recentChanges, quickActions } | false }
 * Mapped to: BrandHealthData (Product Language)
 *
 * Handles 404 / missing fields gracefully — returns fallback defaults.
 */
import { geoApi } from './api'

export interface BrandHealthData {
  score: number
  scoreChange: number
  trend: 'improving' | 'stable' | 'declining'
  brand: { name: string; website: string; industry: string; status: string }
  dimensions: Array<{
    id: string
    label: string
    score: number
    maxScore: number
  }>
  explanation: { summary: string; nextFocus: string }
  coverage: { evidenceCount: number; entityCount: number; claimCount: number }
  recentChanges: Array<{ date: string; score: number; change: number }>
  quickActions: Array<{ id: string; label: string; impact: string }>
}

export const DEFAULT_HEALTH_DATA: BrandHealthData = {
  score: 62,
  scoreChange: 0,
  trend: 'stable',
  brand: { name: '未命名项目', website: '', industry: '', status: 'inactive' },
  dimensions: [
    { id: 'visibility', label: '可见度', score: 60, maxScore: 100 },
    { id: 'authority', label: '权威度', score: 55, maxScore: 100 },
    { id: 'content', label: '内容质量', score: 65, maxScore: 100 },
    { id: 'website', label: '网站表现', score: 58, maxScore: 100 },
    { id: 'knowledge', label: '知识覆盖率', score: 50, maxScore: 100 },
  ],
  explanation: { summary: '暂无数据，请先完成发现评估', nextFocus: '执行发现步骤以获取详细数据' },
  coverage: { evidenceCount: 0, entityCount: 0, claimCount: 0 },
  recentChanges: [],
  quickActions: [],
}

export async function fetchHealth(projectId: string): Promise<BrandHealthData> {
  try {
    const raw = await geoApi<{ success: boolean; data: any }>(`health/${projectId}`)
    const d = raw.data
    if (!d || !d.healthScore) {
      return DEFAULT_HEALTH_DATA
    }
    return {
      score: d.healthScore?.overall ?? DEFAULT_HEALTH_DATA.score,
      scoreChange: d.healthScore?.change ?? 0,
      trend: d.healthScore?.trend ?? 'stable',
      brand: d.brand ?? DEFAULT_HEALTH_DATA.brand,
      dimensions: d.dimensions ?? DEFAULT_HEALTH_DATA.dimensions,
      explanation: d.explanation ?? DEFAULT_HEALTH_DATA.explanation,
      coverage: d.coverage ?? DEFAULT_HEALTH_DATA.coverage,
      recentChanges: d.recentChanges ?? [],
      quickActions: d.quickActions ?? [],
    }
  } catch {
    // API unavailable — use defaults
    return DEFAULT_HEALTH_DATA
  }
}
