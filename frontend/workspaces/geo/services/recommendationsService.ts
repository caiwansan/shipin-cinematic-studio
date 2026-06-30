/**
 * GEO Recommendations Service — Real API Implementation
 *
 * GET /api/v1/geo/recommendations/{projectId}
 * POST /api/v1/geo/recommendations/{projectId}/execute
 */
import { ofetch } from 'ofetch'

export interface RecommendationItem {
  id: string
  title: string
  expectedImpact: number
  effort: 'low' | 'medium' | 'high'
  reason: string
  priority: 'high' | 'medium' | 'low'
  status?: 'pending' | 'running' | 'success' | 'error'
}

export interface RecommendationsData {
  currentScore: number
  expectedScore: number
  recommendations: RecommendationItem[]
  history: Array<{
    id: string
    title: string
    impact: number
    executedAt: string
    status: string
  }>
}

const API_BASE = '/api/v1/geo'

export async function fetchRecommendations(projectId: string): Promise<RecommendationsData> {
  return ofetch(`${API_BASE}/recommendations/${projectId}`)
}

export async function executeRecommendation(
  projectId: string,
  recommendationIds: string[],
): Promise<{ success: boolean; impact: number }> {
  return ofetch(`${API_BASE}/recommendations/${projectId}/execute`, {
    method: 'POST',
    body: { recommendationIds },
  })
}
