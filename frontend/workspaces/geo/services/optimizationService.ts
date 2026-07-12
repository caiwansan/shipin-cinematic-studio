/**
 * Optimization Service — Real API Integration
 *
 * GET /api/geo/optimization/queue?projectId=
 * POST /api/geo/optimization/batch/:action
 * GET /api/geo/optimization/tags
 *
 * Provides the data layer for the Optimization Center.
 * All data comes from real backend endpoints — no mock/hardcoded values.
 */
import { geoApi } from './api'

// ── Optimization Task Types ──

export type OptimizationStatus = 'todo' | 'in_progress' | 'done'
export type DifficultyLevel = 'easy' | 'medium' | 'hard'
export type EstimatedTime = 'today' | '3_days' | '7_days' | '14_days'
export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface ExpectedImpact {
  discoverability: number
  citation: number
  coverage: number
  visibility: number
}

export interface BusinessValue {
  label: string
  score: number // 0-100
}

export interface EvidenceItem {
  source: string
  summary: string
  detail?: string
  data?: Record<string, unknown>
}

export interface OptimizationTask {
  id: string
  title: string
  description: string
  rootCause: string
  expectedImpact: ExpectedImpact
  difficulty: DifficultyLevel
  estimatedTime: EstimatedTime
  businessValue: BusinessValue
  aiVisibilityGain: number
  citationGain: number
  confidence: ConfidenceLevel
  evidence: EvidenceItem[]
  status: OptimizationStatus
  tags: string[]
  priority: number
  category: string
  createdAt: string
  updatedAt: string
}

export interface OptimizationQueue {
  projectId: string
  totalTasks: number
  todoCount: number
  inProgressCount: number
  doneCount: number
  tasks: OptimizationTask[]
  summary: {
    totalExpectedDiscoverabilityGain: number
    totalExpectedCitationGain: number
    totalExpectedCoverageGain: number
    totalExpectedVisibilityGain: number
  }
}

export interface TagFilter {
  key: string
  label: string
  count: number
}

// ── API Methods ──

export async function fetchOptimizationQueue(projectId: string): Promise<OptimizationQueue> {
  const raw = await geoApi<{ success: boolean; data: OptimizationQueue; error?: string }>(
    `optimization/queue?projectId=${encodeURIComponent(projectId)}`
  )
  if (!raw.success || !raw.data) {
    throw new Error(raw.error || '获取优化队列失败')
  }
  return raw.data
}

export async function fetchTags(projectId: string): Promise<TagFilter[]> {
  const raw = await geoApi<{ success: boolean; data: TagFilter[]; error?: string }>(
    `optimization/tags?projectId=${encodeURIComponent(projectId)}`
  )
  if (!raw.success || !raw.data) {
    throw new Error(raw.error || '获取标签失败')
  }
  return raw.data
}

export async function batchAction(
  projectId: string,
  action: 'start' | 'publish' | 'verify' | 'ignore',
  taskIds: string[]
): Promise<{ success: boolean; updatedCount: number }> {
  const raw = await geoApi<{ success: boolean; data: { updatedCount: number }; error?: string }>(
    `optimization/batch/${action}`,
    {
      method: 'POST',
      body: { projectId, taskIds },
    }
  )
  if (!raw.success || !raw.data) {
    throw new Error(raw.error || `批量操作 ${action} 失败`)
  }
  return { success: true, updatedCount: raw.data.updatedCount }
}

export async function updateTaskStatus(
  projectId: string,
  taskId: string,
  status: OptimizationStatus
): Promise<void> {
  const raw = await geoApi<{ success: boolean; error?: string }>(
    `optimization/task/${encodeURIComponent(taskId)}/status`,
    {
      method: 'PATCH',
      body: { projectId, status },
    }
  )
  if (!raw.success) {
    throw new Error(raw.error || '更新任务状态失败')
  }
}
