/**
 * GEO Health Service — Real API Implementation
 *
 * GET /api/v1/geo/health/{projectId}
 *
 * API Returns: { success, data: { brand, healthScore, dimensions, explanation, coverage, recentChanges, quickActions } }
 * Mapped to: BrandHealthData (Product Language)
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

export async function fetchHealth(projectId: string): Promise<BrandHealthData> {
  const raw = await geoApi<{ success: boolean; data: any }>(`health/${projectId}`)
  const d = raw.data

  // Map API response to Product Language
  return {
    score: d.healthScore.overall,
    scoreChange: d.healthScore.change,
    trend: d.healthScore.trend,
    brand: d.brand,
    dimensions: d.dimensions,
    explanation: d.explanation,
    coverage: d.coverage,
    recentChanges: d.recentChanges,
    quickActions: d.quickActions,
  }
}
