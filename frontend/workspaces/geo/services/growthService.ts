/**
 * GEO Growth Service — Real API Implementation
 *
 * GET /api/v1/geo/growth/{projectId}
 *
 * API Returns: { success, data: { trend, growthSummary, improvements, milestones, mostEffectiveActions, opportunity } }
 * Mapped to: GrowthData (Product Language)
 */
import { geoApi } from './api'

export interface TrendHistoryPoint {
  date: string
  score: number
}

export interface GrowthTrend {
  current: number
  previous: number
  change: number
  direction: 'improving' | 'declining' | 'stable'
  history: TrendHistoryPoint[]
}

export interface GrowthSummary {
  direction: string
  totalActions: number
  successfulActions: number
  overallChange: number
}

export interface GrowthImprovement {
  action: string
  impact: string
  period: string
}

export interface GrowthMilestone {
  date: string
  label: string
  score: number
  achieved: boolean
}

export interface EffectiveAction {
  date: string
  action: string
  impact: number
  score: number
}

export interface GrowthOpportunity {
  targetScore: number
  potentialGain: number
  actions: string[]
}

export interface GrowthData {
  trend: GrowthTrend
  growthSummary: GrowthSummary
  improvements: GrowthImprovement[]
  milestones: GrowthMilestone[]
  mostEffectiveActions: EffectiveAction[]
  opportunity: GrowthOpportunity | null
  // Derived for backward compatibility
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
  trendPoints: number[]
}

export async function fetchGrowth(projectId: string): Promise<GrowthData> {
  const raw = await geoApi<{ success: boolean; data: any }>(`growth/${projectId}`)
  const d = raw.data

  const trend = d.trend ?? { current: 0, previous: 0, change: 0, direction: 'stable', history: [] }
  const improvements = d.improvements ?? []
  const milestones = d.milestones ?? []
  const effectiveActions = d.mostEffectiveActions ?? []
  const opportunity = d.opportunity ?? null

  return {
    trend,
    growthSummary: d.growthSummary ?? { direction: 'stable', totalActions: 0, successfulActions: 0, overallChange: 0 },
    improvements,
    milestones,
    mostEffectiveActions: effectiveActions,
    opportunity,
    // Derived for backward compatibility
    direction: {
      beforeScore: trend.previous,
      afterScore: trend.current,
      delta: trend.change,
      period: 'All time',
    },
    sources: improvements.map((imp: any) => ({
      name: imp.action ?? 'Unknown',
      delta: imp.impact ?? '0 pts',
      before: 0,
      after: trend.current,
      learnContent: `${imp.impact} improvement in ${imp.action}`,
    })),
    learnings: effectiveActions.map((ea: any) => ({
      action: ea.action ?? 'Optimization',
      impact: ea.impact ?? 0,
    })),
    trendPoints: (trend.history ?? []).map((h: any) => h.score ?? 0),
  }
}
