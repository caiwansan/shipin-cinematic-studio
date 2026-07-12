/**
 * GEO Growth Service — Real API Implementation
 *
 * Calls:
 *   GET /api/geo/growth/options?projectId=xxx   — 可选优化项
 *   GET /api/geo/growth/forecast?projectId=xxx  — 成长预测
 *   POST /api/geo/growth/execute                — 执行优化
 *   POST /api/geo/growth/generate               — 生成内容
 *
 * Maps backend response → frontend GrowthData
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
  direction: { beforeScore: number; afterScore: number; delta: number; period: string }
  sources: Array<{ name: string; delta: number | string; before: string | number; after: string | number; suffix?: string; learnContent?: string }>
  learnings: Array<{ action: string; impact: number }>
  trendPoints: number[]
}

export async function fetchGrowth(projectId: string): Promise<GrowthData> {
  // Fetch options + forecast in parallel
  const [optionsRes, forecastRes] = await Promise.allSettled([
    geoApi<{ success: boolean; data: any[] }>(`growth/options?projectId=${projectId}`),
    geoApi<{ success: boolean; data: any }>(`growth/forecast?projectId=${projectId}`),
  ])

  const options = optionsRes.status === 'fulfilled' ? optionsRes.value.data ?? [] : []
  const forecast = forecastRes.status === 'fulfilled' ? forecastRes.value.data : null

  const currentScore = forecast?.currentScore ?? forecast?.current ?? 65
  const previousScore = forecast?.previousScore ?? forecast?.previous ?? 60
  const change = currentScore - previousScore

  const direction: 'improving' | 'declining' | 'stable' =
    change > 2 ? 'improving' : change < -2 ? 'declining' : 'stable'

  const historyPoints: TrendHistoryPoint[] = forecast?.history ?? forecast?.points ?? []

  const improvements: GrowthImprovement[] = options.map((o: any) => ({
    action: o.label ?? o.type ?? '优化',
    impact: `${o.impact ?? 0} pts`,
    period: o.effort === 'EASY' ? '快速' : o.effort === 'MEDIUM' ? '中期' : '长期',
  }))

  const milestones: GrowthMilestone[] = [
    { date: '当前', label: '当前分数', score: currentScore, achieved: true },
    { date: '目标', label: '下一阶段', score: Math.min(currentScore + 15, 100), achieved: false },
  ]

  const totalPotential = options.reduce((sum: number, o: any) => sum + (o.impact ?? 0), 0)

  return {
    trend: {
      current: currentScore,
      previous: previousScore,
      change,
      direction,
      history: historyPoints,
    },
    growthSummary: {
      direction: direction === 'improving' ? '上升中' : direction === 'declining' ? '下降中' : '稳定',
      totalActions: options.length,
      successfulActions: 0,
      overallChange: change,
    },
    improvements,
    milestones,
    mostEffectiveActions: [],
    opportunity: {
      targetScore: Math.min(currentScore + totalPotential, 100),
      potentialGain: totalPotential,
      actions: options.map((o: any) => o.label ?? o.type ?? ''),
    },
    direction: {
      beforeScore: previousScore,
      afterScore: currentScore,
      delta: change,
      period: '全部周期',
    },
    sources: improvements.map((imp, i) => ({
      name: imp.action,
      delta: `+${imp.impact}`,
      before: currentScore - (options[i]?.impact ?? 0),
      after: currentScore,
      learnContent: `${imp.impact} improvement in ${imp.action}`,
    })),
    learnings: [],
    trendPoints: historyPoints.map((h: any) => h.score ?? h ?? 0),
  }
}

export async function executeGrowthAction(
  projectId: string,
  type: string,
  brandName?: string,
): Promise<{ success: boolean; data?: any }> {
  try {
    const res = await geoApi<{ success: boolean; data: any }>('growth/execute', {
      method: 'POST',
      body: { projectId, type, brandName: brandName || 'Brand' },
    })
    return { success: res.success ?? true, data: res.data }
  } catch {
    return { success: false }
  }
}

export async function generateGrowthContent(
  projectId: string,
  contentType: string,
  brandName: string,
): Promise<{ success: boolean; data?: any }> {
  try {
    const res = await geoApi<{ success: boolean; data: any }>('growth/generate', {
      method: 'POST',
      body: { projectId, contentType, brandName },
    })
    return { success: res.success ?? true, data: res.data }
  } catch {
    return { success: false }
  }
}
