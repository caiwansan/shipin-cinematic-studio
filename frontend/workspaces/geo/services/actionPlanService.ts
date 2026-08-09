/**
 * GEO Action Plan Service — 执行计划管理
 *
 * GET    /api/geo/brands/:id/action-plans
 * POST   /api/geo/brands/:id/action-plans/refresh
 * POST   /api/geo/brands/:id/action-plans/:planId/start
 * POST   /api/geo/brands/:id/action-plans/:planId/pause
 * POST   /api/geo/brands/:id/action-plans/:planId/complete
 *
 * Provides the data layer for the Action Plan section in BrandOverview.vue.
 * All data comes from the ActionPlanEngine via real backend endpoints.
 */
import { geoApi } from './api'

export interface ActionPlan {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'paused'
  steps: Array<{
    id: string
    title: string
    status: 'pending' | 'in_progress' | 'completed'
    description: string
  }>
  createdAt: string
  updatedAt: string
}

export interface ActionPlansData {
  plans: ActionPlan[]
  total: number
}

export async function fetchActionPlans(projectId: string): Promise<ActionPlansData> {
  const raw = await geoApi<{ success: boolean; data: ActionPlansData; error?: string }>(
    `brands/${projectId}/action-plans`
  )
  if (!raw.success || !raw.data) {
    throw new Error(raw.error || '获取执行计划失败')
  }
  return raw.data
}

export async function refreshActionPlans(projectId: string): Promise<ActionPlansData> {
  const raw = await geoApi<{ success: boolean; data: ActionPlansData; error?: string }>(
    `brands/${projectId}/action-plans/refresh`,
    { method: 'POST', body: {} }
  )
  if (!raw.success || !raw.data) {
    throw new Error(raw.error || '刷新执行计划失败')
  }
  return raw.data
}

export async function startActionPlan(projectId: string, planId: string): Promise<ActionPlan> {
  const raw = await geoApi<{ success: boolean; data: ActionPlan; error?: string }>(
    `brands/${projectId}/action-plans/${planId}/start`,
    { method: 'POST', body: {} }
  )
  if (!raw.success || !raw.data) {
    throw new Error(raw.error || '开始执行计划失败')
  }
  return raw.data
}

export async function pauseActionPlan(projectId: string, planId: string): Promise<ActionPlan> {
  const raw = await geoApi<{ success: boolean; data: ActionPlan; error?: string }>(
    `brands/${projectId}/action-plans/${planId}/pause`,
    { method: 'POST', body: {} }
  )
  if (!raw.success || !raw.data) {
    throw new Error(raw.error || '暂停执行计划失败')
  }
  return raw.data
}

export async function completeActionPlan(projectId: string, planId: string): Promise<ActionPlan> {
  const raw = await geoApi<{ success: boolean; data: ActionPlan; error?: string }>(
    `brands/${projectId}/action-plans/${planId}/complete`,
    { method: 'POST', body: {} }
  )
  if (!raw.success || !raw.data) {
    throw new Error(raw.error || '完成执行计划失败')
  }
  return raw.data
}
