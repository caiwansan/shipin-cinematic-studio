/**
 * Execution Memory API Handler
 * Phase 6 — Execution Memory Layer
 *
 * 将执行记忆服务接入路由层。
 */

import { RenderJob } from '../production-loop/job-types'
import { globalExecutionMemory, ExecutionMemoryLayer } from './memory-orchestrator'
import { CausalGraphIndex } from '../causal-engine/causal-graph-index'
import crypto from 'crypto'

export interface MemoryRecordRequest {
  traceId: string
  reason: string
  parentVersionId?: string
  changedNodes?: string[]
  invalidatedNodes?: string[]
}

export interface MemoryHistoryRequest {
  traceId: string
}

/**
 * 记录一次版本变更
 * 从 jobStore 读取 blueprint 计算 hash 后存储
 */
export async function handleMemoryRecord(
  req: MemoryRecordRequest,
  jobStore: Map<string, RenderJob>,
): Promise<{ success: boolean; versionId?: string; error?: string }> {
  try {
    const { traceId, reason, parentVersionId, changedNodes, invalidatedNodes } = req

    const job = jobStore.get(traceId)
    if (!job) {
      return { success: false, error: 'Job not found' }
    }

    const version = globalExecutionMemory.recordVersion({
      traceId,
      reason,
      parentVersionId,
      changedNodes,
      invalidatedNodes,
      blueprint: job.blueprint,
    })

    return { success: true, versionId: version.versionId }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * 获取版本历史
 */
export async function handleMemoryHistory(
  req: MemoryHistoryRequest,
): Promise<{ success: boolean; frames?: any[]; summary?: any; error?: string }> {
  try {
    const { traceId } = req
    const frames = globalExecutionMemory.getHistory(traceId)
    const summary = globalExecutionMemory.getHistorySummary(traceId)

    return { success: true, frames, summary }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * 获取执行记忆统计
 */
export async function handleMemoryStats(): Promise<{
  success: boolean
  stats?: { totalVersions: number; totalTraces: number }
  lineage?: { allVersionIds: string[]; children: Record<string, string[]>; parents: Record<string, string[]> }
  error?: string
}> {
  try {
    const stats = globalExecutionMemory.getStats()
    const lineage = globalExecutionMemory.getLineage()
    return { success: true, stats, lineage }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
