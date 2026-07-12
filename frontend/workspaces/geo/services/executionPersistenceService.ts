/**
 * Execution Persistence Service — 执行状态持久化
 *
 * Sprint 4-2: 将前端 in-memory 执行状态持久化到后端
 * 复用已有 backend Execution Routes
 * - POST /api/geo/executions — 创建执行记录
 * - PATCH /api/geo/executions/:executionId/status — 更新状态
 * - GET /api/geo/executions?projectId=xxx — 获取执行历史
 */

import { geoApi } from './api'

export interface ExecutionRecord {
  id: string
  projectId: string
  optimizationType: string
  executionStatus: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  triggerSource: string
  completedAt: string | null
  startedAt: string
  industry?: string | null
  brandType?: string | null
}

export interface ExecutionSummary {
  total: number
  pending: number
  running: number
  completed: number
  failed: number
  cancelled: number
}

/**
 * 创建新的 Execution 记录
 */
export async function createExecution(params: {
  projectId: string
  optimizationType: string
  triggerSource?: string
  industry?: string
  brandType?: string
}): Promise<ExecutionRecord> {
  const res = await geoApi<{ success: boolean; data: ExecutionRecord }>('executions', {
    method: 'POST',
    body: params,
  })
  return res.data
}

/**
 * 更新 Execution 状态
 */
export async function updateExecutionStatus(
  executionId: string,
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled',
  completedAt?: string
): Promise<ExecutionRecord> {
  const res = await geoApi<{ success: boolean; data: ExecutionRecord }>(
    `executions/${encodeURIComponent(executionId)}/status`,
    {
      method: 'PATCH',
      body: { executionStatus: status, completedAt },
    }
  )
  return res.data
}

/**
 * 获取项目的 Execution 列表
 */
export async function listExecutions(
  projectId: string,
  options?: { status?: string; limit?: number; offset?: number }
): Promise<{ executions: ExecutionRecord[]; total: number }> {
  const params = new URLSearchParams({ projectId })
  if (options?.status) params.set('status', options.status)
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.offset) params.set('offset', String(options.offset))

  const res = await geoApi<{ success: boolean; data: { executions: ExecutionRecord[]; total: number } }>(
    `executions?${params.toString()}`
  )
  return res.data
}

/**
 * 获取 Execution 摘要统计
 */
export async function getExecutionSummary(projectId: string): Promise<ExecutionSummary> {
  const res = await geoApi<{ success: boolean; data: ExecutionSummary }>(
    `executions/project/${encodeURIComponent(projectId)}/summary`
  )
  return res.data
}
