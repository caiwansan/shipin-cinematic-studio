/**
 * GEO Discovery Service — Frontend API
 *
 * P0-T005 — AI Discovery Lab MVP
 * P0-T006 — Opportunity Engine (First Edition) — 扩展 Opportunity 类型
 * P0-T007 — Action Plan Engine — 新增 Action Plan API
 *
 * GET /api/geo/discovery/report       → DiscoveryReport JSON
 * GET /api/geo/discovery/action-plan  → ActionPlan[] JSON
 */

import { geoApi } from './api'

export interface DiscoveryScenario {
  scenarioId: string
  scenarioName: string
  industryId: string
  entityCoverage: boolean
  coverageScore: number
  confidence: number
  trend: 'up' | 'stable' | 'down'
}

/** 优化机会 — 扩展类型（与后端 Opportunity 一致） */
export interface DiscoveryOpportunity {
  id: string
  scenarioId: string
  scenarioName: string
  industryId: string
  coverageScore: number
  gap: number
  priority: 'high' | 'medium' | 'low'
  expectedAdiGain: number
  reason: string
  suggestion: string
  effort: 'easy' | 'medium' | 'hard'
  tags: string[]
}

export interface DiscoveryReport {
  id: string
  entityId: string
  entityName: string
  adi: number
  dimensions: {
    coverage: number
    share: number
    position: number
  }
  scenarios: DiscoveryScenario[]
  opportunities: DiscoveryOpportunity[]
  generatedAt: string
}

/** Action Step — 行动步骤 */
export interface ActionStep {
  id: string
  title: string
  description: string
  order: number
}

/** Action Plan — 行动方案 */
export interface ActionPlanItem {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  estimatedImpact: number
  estimatedEffort: 'easy' | 'medium' | 'hard'
  estimatedTime: string
  steps: ActionStep[]
  relatedOpportunityId: string
  relatedScenarioId: string
  status: 'pending' | 'completed' | 'skipped' | 'later'
  tags: string[]
}

/** Action Plan API 响应包装 */
export interface ActionPlanResponse {
  entityName: string
  totalActionPlans: number
  totalEstimatedImpact: number
  summary: string
  actionPlans: ActionPlanItem[]
  generatedAt: string
}

export async function fetchDiscoveryReport(entity: string): Promise<DiscoveryReport> {
  const raw = await geoApi<{ success: boolean; data: DiscoveryReport }>(`discovery/report?entity=${encodeURIComponent(entity)}`)
  return raw.data
}

export async function fetchActionPlans(entity: string): Promise<ActionPlanItem[]> {
  const raw = await geoApi<{ success: boolean; data: ActionPlanResponse }>(`discovery/action-plan?entity=${encodeURIComponent(entity)}`)
  return raw.data.actionPlans
}
