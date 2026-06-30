/**
 * GEO Health Service — Real API Implementation
 *
 * GET /api/v1/geo/health/{projectId}
 */
import { ofetch } from 'ofetch'

export interface BrandHealthData {
  brandHealth: {
    score: number
    trend: number
    label: string
    definition: string
  } | null
  dimensions: Array<{
    name: string
    score: number
    previousScore: number
    isWarning: boolean
    explanation: string
  }>
  dailyChange: number
  recommendations: Array<{
    id: string
    title: string
    expectedImpact: number
    effort: 'low' | 'medium' | 'high'
    reason: string
  }>
}

const API_BASE = '/api/v1/geo'

export async function fetchHealth(projectId: string): Promise<BrandHealthData> {
  return ofetch(`${API_BASE}/health/${projectId}`)
}
