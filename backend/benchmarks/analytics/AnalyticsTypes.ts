/**
 * Capability Analytics 类型定义
 *
 * 汇聚 Coverage（静态）+ Benchmark（动态）的统一事实来源。
 * P1.3.4 只取 Coverage 走通，execution/negotiator/planner/runner 字段预留。
 */

export type Health = 'healthy' | 'weak' | 'critical'

export interface CapabilityAnalytics {
  capability: string
  name: string
  group: string
  stage: string
  difficulty: string

  // -- 静态 Coverage --
  primaryCoverage: number
  secondaryCoverage: number
  coverageScore: number
  coverageStatus: 'covered' | 'partial' | 'uncovered'

  // -- Benchmark Executions （P1.4+） —
  executions: number | null
  successRate: number | null
  averageScore: number | null

  // -- Negotiator （P1.4+） —
  resolutionRate: number | null
  confidence: number | null
  confidenceVariance: number | null

  // -- Planner （P1.4+） —
  plannerHitRate: number | null

  // -- Runner （P1.4+） —
  averageLatency: number | null
  averageTokens: number | null

  // -- 自动计算 --
  health: Health
}

export interface AnalyticsSummary {
  total: number
  healthy: number
  weak: number
  critical: number
  healthScore: number
  averageCoverage: number
}

export interface AnalyticsSnapshot {
  generated: string
  registryId: string
  registryVersion: string
  analytics: CapabilityAnalytics[]
  summary: AnalyticsSummary
  trends: Record<string, any>[]
}

/**
 * 根据条件自动判断健康状态
 */
export function computeHealth(
  coverageScore: number,
  resolutionRate: number | null,
): Health {
  if (coverageScore === 0) return 'critical'
  if (resolutionRate !== null && resolutionRate < 80) return 'weak'
  if (resolutionRate !== null && resolutionRate >= 80) return 'healthy'
  // No resolution data yet — coverage > 0 is enough to not be critical
  return 'healthy'
}

export function computeCoverageStatus(
  primary: number,
  secondary: number,
): 'covered' | 'partial' | 'uncovered' {
  if (primary > 0) return 'covered'
  if (secondary > 0) return 'partial'
  return 'uncovered'
}
