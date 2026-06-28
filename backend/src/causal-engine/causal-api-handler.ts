/**
 * Causal Control API Handler
 * Phase 5 — Causal Consistency Engine
 *
 * 将因果一致性引擎接入 Control Layer API。
 * 为 retry-node 和 patch-node 增加一致性验证步骤。
 *
 * 新增端点：
 *   - POST /api/workbench/causal-check — 因果一致性检查（无需执行修改）
 *   - POST /api/workbench/causal-apply — 因果一致性检查 + 自动修复
 */

import { RenderJob } from '../production-loop/job-types'
import { CausalConsistencyEngine, ConsistencyReport } from './causal-consistency-engine'
import { CausalGraphIndex } from './causal-graph-index'

// 进程内缓存：每个 traceId 对应一个因果引擎实例
const engineCache = new Map<string, CausalConsistencyEngine>()

export interface CausalCheckRequest {
  traceId: string
  nodeId: string
}

export interface CausalCheckResponse {
  success: boolean
  report?: ConsistencyReport
  error?: string
}

/**
 * 确保 traceId 对应的因果引擎已初始化
 */
function ensureEngine(traceId: string, blueprint: any): CausalConsistencyEngine {
  let engine = engineCache.get(traceId)
  if (!engine) {
    engine = new CausalConsistencyEngine()
    engine.initialize(blueprint)
    engineCache.set(traceId, engine)
  }
  return engine
}

/**
 * 因果一致性检查
 * 不执行修复，只返回影响报告
 */
export async function handleCausalCheck(
  req: CausalCheckRequest,
  jobStore: Map<string, RenderJob>,
): Promise<CausalCheckResponse> {
  try {
    const { traceId, nodeId } = req
    const job = jobStore.get(traceId)
    if (!job) {
      return { success: false, error: 'Job not found' }
    }

    const engine = ensureEngine(traceId, job.blueprint)
    const report = engine.triggerChange(nodeId, job)

    return { success: true, report }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * 因果一致性检查 + 自动修复
 * 执行修复后写入 jobStore
 */
export async function handleCausalApply(
  req: CausalCheckRequest,
  jobStore: Map<string, RenderJob>,
): Promise<CausalCheckResponse> {
  try {
    const { traceId, nodeId } = req
    const job = jobStore.get(traceId)
    if (!job) {
      return { success: false, error: 'Job not found' }
    }

    // 取旧 blueprint 快照用于 diff（clone 一份）
    const oldSnapshot = structuredClone(job.blueprint)

    const engine = ensureEngine(traceId, job.blueprint)
    const report = engine.triggerChange(nodeId, job, oldSnapshot)

    // 将修复后的 blueprint 写回 jobStore
    jobStore.set(traceId, { ...job, updatedAt: Date.now() })

    return { success: true, report }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
