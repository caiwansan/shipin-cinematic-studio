/**
 * GEO Growth Service — Real API Implementation
 *
 * GET /api/v1/geo/growth/{projectId}
 */
import { ofetch } from 'ofetch'

export interface GrowthData {
  direction: {
    beforeScore: number
    afterScore: number
    delta: number
    period: string
  }
  sources: Array<{
    name: string
    delta: number | string
    before: string | number
    after: string | number
    suffix?: string
    learnContent?: string
  }>
  learnings: Array<{
    action: string
    impact: number
  }>
  opportunity: {
    title: string
    expectedImpact: number
  } | null
  milestones: string[]
  trendPoints: number[]
}

const API_BASE = '/api/v1/geo'

export async function fetchGrowth(projectId: string): Promise<GrowthData> {
  return ofetch(`${API_BASE}/growth/${projectId}`)
}
