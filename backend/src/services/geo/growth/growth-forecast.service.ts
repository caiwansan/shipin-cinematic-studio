// ============================================================
// GEO Growth Engine — Growth Forecast Service (v3)
// Computes forecast based on current score + missing optimization tasks
// ============================================================

import { calculateScore, ScoreExplainability } from '../recommendation/recommendation-score.service.js'

interface ForecastPeriod {
  period: '7d' | '30d' | '90d'
  estimatedScore: number
  estimatedVisibility: string
  keyActions: string[]
}

export interface GrowthForecast {
  current: ScoreExplainability
  forecast: ForecastPeriod[]
}

// Optimization tasks with effort and score impact estimates
const TASK_IMPACTS = [
  { type: 'generate-faq', label: '生成 FAQ', effort: 'EASY', hours: 1, impact: 8 },
  { type: 'generate-about', label: '生成品牌介绍', effort: 'EASY', hours: 1, impact: 6 },
  { type: 'generate-brand-story', label: '生成品牌故事', effort: 'MEDIUM', hours: 4, impact: 10 },
  { type: 'generate-knowledge', label: '生成知识文章', effort: 'MEDIUM', hours: 4, impact: 7 },
  { type: 'generate-product', label: '生成产品说明', effort: 'MEDIUM', hours: 4, impact: 5 },
  { type: 'generate-schema-org', label: '生成 Organization Schema', effort: 'EASY', hours: 1, impact: 8 },
  { type: 'generate-schema-faq', label: '生成 FAQ Schema', effort: 'EASY', hours: 1, impact: 6 },
  { type: 'generate-schema-breadcrumb', label: '生成 Breadcrumb Schema', effort: 'EASY', hours: 1, impact: 4 },
]

export async function getForecast(projectId: string): Promise<GrowthForecast> {
  const current = await calculateScore(projectId)

  // Calculate total achievable score if all tasks completed
  const currentScore = current.overall
  const maxAdditionalFromTasks = TASK_IMPACTS.reduce((sum, t) => sum + t.impact, 0)

  // Diminishing returns: max score is 100, and each additional point gets harder
  const maxPossibleScore = Math.min(100, currentScore + Math.round(maxAdditionalFromTasks * 0.6))

  // Total hours for all tasks
  const totalHours = TASK_IMPACTS.reduce((sum, t) => sum + t.hours, 0)

  // 7d forecast: can complete all EASY tasks (1h each)
  const easyTasks = TASK_IMPACTS.filter(t => t.effort === 'EASY')
  const easyHours = easyTasks.reduce((sum, t) => sum + t.hours, 0)
  const easyTasksScore = currentScore + Math.round(easyTasks.reduce((sum, t) => sum + t.impact, 0) * 0.6)

  // 30d forecast: can complete all EASY + MEDIUM tasks
  const mediumTasks = TASK_IMPACTS.filter(t => t.effort === 'MEDIUM')
  const mediumHours = mediumTasks.reduce((sum, t) => sum + t.hours, 0)
  const medTasksScore = currentScore + Math.round(
    [...easyTasks, ...mediumTasks].reduce((sum, t) => sum + t.impact, 0) * 0.6
  )

  // 90d forecast: can complete all tasks + repeated optimization cycles
  const allTasksScore = maxPossibleScore
  const cycles = Math.min(3, Math.floor(90 / (totalHours / 8)))
  const compoundedScore = Math.min(100, currentScore + Math.round((maxPossibleScore - currentScore) * (1 - Math.pow(0.5, cycles))))

  const forecast: ForecastPeriod[] = [
    {
      period: '7d',
      estimatedScore: Math.min(100, easyTasksScore),
      estimatedVisibility: estimateVisIncrease(currentScore, Math.min(100, easyTasksScore)),
      keyActions: easyTasks.map(t => t.label),
    },
    {
      period: '30d',
      estimatedScore: Math.min(100, medTasksScore),
      estimatedVisibility: estimateVisIncrease(currentScore, Math.min(100, medTasksScore)),
      keyActions: [...easyTasks, ...mediumTasks].map(t => t.label),
    },
    {
      period: '90d',
      estimatedScore: Math.min(100, compoundedScore),
      estimatedVisibility: estimateVisIncrease(currentScore, Math.min(100, compoundedScore)),
      keyActions: [
        '完成所有优化任务',
        '持续监控与调整',
        '重复优化周期',
      ],
    },
  ]

  return { current, forecast }
}

function estimateVisIncrease(currentScore: number, targetScore: number): string {
  const diff = targetScore - currentScore
  if (diff <= 0) return '+0%'
  const pct = Math.round(diff * 0.8)
  return `+${Math.min(pct, 60)}%`
}
