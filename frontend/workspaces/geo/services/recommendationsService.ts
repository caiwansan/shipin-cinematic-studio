/**
 * GEO Recommendations Service — Real API Implementation
 *
 * GET /api/v1/geo/recommendations/{projectId}
 * POST /api/v1/geo/recommendations/{projectId}/execute
 *
 * API Returns: { success, data: { summary, recommendations, history } }
 * Mapped to: RecommendationsData (Product Language)
 */
import { geoApi } from './api'

export interface RecommendationImpact {
  label: string
  value: number
}

export interface ExpectedScoreChange {
  from: number
  to: number
}

export interface RecommendationItem {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  impact: RecommendationImpact
  difficulty: 'easy' | 'medium' | 'complex'
  expectedScoreChange: ExpectedScoreChange
  category: 'knowledge' | 'visibility' | 'website' | 'comprehensive'
  status: 'ready' | 'running' | 'success' | 'error'
}

export interface RecommendationsSummary {
  total: number
  highPriority: number
  mediumPriority: number
  lowPriority: number
  totalExpectedGain: number
}

export interface RecommendationHistoryItem {
  id?: string
  title: string
  impact: number
  executedAt: string
  status: string
}

export interface RecommendationsData {
  summary: RecommendationsSummary
  recommendations: RecommendationItem[]
  history: RecommendationHistoryItem[]
  // Derived convenience properties
  currentScore: number
  expectedScore: number
}

export async function fetchRecommendations(projectId: string): Promise<RecommendationsData> {
  const raw = await geoApi<{ success: boolean; data: any }>(`recommendations/${projectId}`)
  const d = raw.data

  // Calculate scores from the recommendations
  const overall = 0 // will be estimated from expected score changes
  const totalGain = d.summary?.totalExpectedGain ?? 0
  const baseScore = 60 // baseline estimate

  return {
    summary: {
      total: d.summary?.total ?? 0,
      highPriority: d.summary?.highPriority ?? 0,
      mediumPriority: d.summary?.mediumPriority ?? 0,
      lowPriority: d.summary?.lowPriority ?? 0,
      totalExpectedGain: totalGain,
    },
    recommendations: (d.recommendations ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? '',
      priority: r.priority,
      impact: r.impact ?? { label: '', value: 0 },
      difficulty: r.difficulty ?? 'medium',
      expectedScoreChange: r.expectedScoreChange ?? { from: baseScore, to: baseScore + (r.impact?.value ?? 0) },
      category: r.category ?? 'knowledge',
      status: r.status ?? 'ready',
    })),
    history: (d.history ?? []).map((h: any) => ({
      id: h.id,
      title: h.title ?? '',
      impact: h.impact ?? 0,
      executedAt: h.executedAt ?? h.date ?? '',
      status: h.status ?? '',
    })),
    // Derived for backward compatibility
    currentScore: baseScore,
    expectedScore: baseScore + totalGain,
  }
}

export async function executeRecommendation(
  projectId: string,
  recommendationIds: string[],
): Promise<{ success: boolean; impact: number }> {
  const raw = await geoApi<{ success: boolean; data: any }>(`recommendations/${projectId}/execute`, {
    method: 'POST',
    body: { recommendationIds },
  })
  return {
    success: raw.success ?? false,
    impact: raw.data?.status === 'started' ? 0 : 0,
  }
}
