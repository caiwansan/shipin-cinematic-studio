/**
 * GEO Recommendations Service — Real API Implementation
 *
 * Calls:
 *   GET /api/geo/recommendation/tasks?projectId=xxx   — 优化任务列表
 *   GET /api/geo/recommendation/score?projectId=xxx    — 当前评分
 *   GET /api/geo/recommendation/report?projectId=xxx   — 优化报告
 *
 * Maps backend TaskWithROI → frontend RecommendationItem
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
  currentScore: number
  expectedScore: number
}

// ── Priority label mapping ──
function mapPriority(p: string): 'high' | 'medium' | 'low' {
  const m: Record<string, 'high' | 'medium' | 'low'> = {
    HIGH: 'high', MEDIUM: 'medium', LOW: 'low',
    high: 'high', medium: 'medium', low: 'low',
  }
  return m[p] || 'medium'
}

// ── Difficulty label mapping ──
function mapDifficulty(e: string): 'easy' | 'medium' | 'complex' {
  const m: Record<string, 'easy' | 'medium' | 'complex'> = {
    EASY: 'easy', MEDIUM: 'medium', HARD: 'complex',
    easy: 'easy', medium: 'medium', complex: 'complex',
  }
  return m[e] || 'medium'
}

// ── Category mapping ──
function mapCategory(c: string): 'knowledge' | 'visibility' | 'website' | 'comprehensive' {
  const m: Record<string, any> = {
    knowledge: 'knowledge', visibility: 'visibility', website: 'website',
    SEO: 'visibility', content: 'knowledge', brand: 'comprehensive',
  }
  return m[c] || 'knowledge'
}

export async function fetchRecommendations(projectId: string): Promise<RecommendationsData> {
  // Fetch tasks + score in parallel
  const [tasksRes, scoreRes] = await Promise.allSettled([
    geoApi<{ success: boolean; data: any[] }>(`recommendation/tasks?projectId=${projectId}`),
    geoApi<{ success: boolean; data: any }>(`recommendation/score?projectId=${projectId}`),
  ])

  const tasks = tasksRes.status === 'fulfilled' ? tasksRes.value.data ?? [] : []
  const scoreData = scoreRes.status === 'fulfilled' ? scoreRes.value.data : null

  const overallScore = scoreData?.overall ?? 65

  let high = 0; let med = 0; let low = 0
  let totalGain = 0

  const recommendations: RecommendationItem[] = tasks.map((t: any, i: number) => {
    if (t.priority === 'HIGH') high++
    else if (t.priority === 'MEDIUM') med++
    else low++
    totalGain += t.impact ?? 0

    return {
      id: `rec-${i}`,
      title: t.title ?? '',
      description: t.description ?? t.reason ?? '',
      priority: mapPriority(t.priority),
      impact: { label: t.impactPercentile ?? `+${t.impact}`, value: t.impact ?? 0 },
      difficulty: mapDifficulty(t.effort),
      expectedScoreChange: { from: overallScore, to: overallScore + (t.impact ?? 0) },
      category: mapCategory(t.category),
      status: 'ready',
    }
  })

  return {
    summary: {
      total: recommendations.length,
      highPriority: high,
      mediumPriority: med,
      lowPriority: low,
      totalExpectedGain: totalGain,
    },
    recommendations,
    history: [],
    currentScore: overallScore,
    expectedScore: overallScore + totalGain,
  }
}

export async function executeRecommendation(
  projectId: string,
  recommendationIds: string[],
): Promise<{ success: boolean; impact: number }> {
  // Use POST /api/geo/recommendation/simulate to estimate impact
  try {
    const res = await geoApi<{ success: boolean; data: any }>('recommendation/simulate', {
      method: 'POST',
      body: { projectId, recommendationIds },
    })
    return { success: res.success ?? true, impact: res.data?.impact ?? 0 }
  } catch {
    return { success: false, impact: 0 }
  }
}
