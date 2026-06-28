/**
 * Control Layer API Handler
 * Phase 4 — Execution Control Layer
 *
 * 注册两个新端点：
 * - POST /api/workbench/retry-node — 局部重跑
 * - POST /api/workbench/patch-node — DAG 运行时补丁
 *
 * 使用依赖注入模式：handler 接受的 jobStore 由调用方传入，
 * 避免与 workbench-director 的循环依赖。
 */

import { RenderJob } from '../production-loop/job-types'
import { ReExecutionEngine } from './re-execution-engine'
import { DAGPatchEngine } from './dag-patch-engine'

const reEngine = new ReExecutionEngine()
const patchEngine = new DAGPatchEngine()

export interface RetryNodeRequest {
  traceId: string
  nodeId: string
}

export interface PatchNodeRequest {
  traceId: string
  nodeId: string
  patch: Record<string, unknown>
}

export interface RetryNodeResponse {
  success: boolean
  traceId: string
  nodeId: string
  jobId?: string
  affectedNodes?: string[]
  error?: string
}

export interface PatchNodeResponse {
  success: boolean
  traceId: string
  nodeId: string
  patchApplied: boolean
  error?: string
}

/**
 * retry-node handler
 * 从 jobStore 中查找 job，获取 timeline + blueprint，执行子树重跑
 */
export async function handleRetryNode(
  req: RetryNodeRequest,
  jobStore: Map<string, RenderJob>,
): Promise<RetryNodeResponse> {
  try {
    const { traceId, nodeId } = req

    const job = jobStore.get(traceId)
    if (!job) {
      return { success: false, traceId, nodeId, error: 'Job not found' }
    }

    // 从 job 重建 timeline（scenes → shots 映射到 DAG）
    const timeline = buildTimelineFromBlueprint(job.blueprint)

    // 执行子树重跑
    const result = await reEngine.reRunSubtree(traceId, timeline, structuredClone(job.blueprint), nodeId)

    return {
      success: true,
      traceId,
      nodeId,
      jobId: result.jobId,
      affectedNodes: result.affectedNodes,
    }
  } catch (err: any) {
    return { success: false, traceId: req.traceId, nodeId: req.nodeId, error: err.message }
  }
}

/**
 * patch-node handler
 * 对 blueprint 应用实时补丁，冻结为新版本，存入 jobStore
 */
export async function handlePatchNode(
  req: PatchNodeRequest,
  jobStore: Map<string, RenderJob>,
): Promise<PatchNodeResponse> {
  try {
    const { traceId, nodeId, patch } = req

    const job = jobStore.get(traceId)
    if (!job) {
      return { success: false, traceId, nodeId, patchApplied: false, error: 'Job not found' }
    }

    // 应用 patch
    const patchedBlueprint = patchEngine.updateNode(
      structuredClone(job.blueprint),
      nodeId,
      patch,
    )

    // 更新 job store
    jobStore.set(traceId, { ...job, blueprint: patchedBlueprint, updatedAt: Date.now() })

    return { success: true, traceId, nodeId, patchApplied: true }
  } catch (err: any) {
    return { success: false, traceId: req.traceId, nodeId: req.nodeId, patchApplied: false, error: err.message }
  }
}

/**
 * 从 blueprint 重建 ExecutionTimeline（用于 subtree extractor）
 */
function buildTimelineFromBlueprint(blueprint: any) {
  const nodes: Record<string, any> = {}
  const edges: { from: string; to: string; type: string }[] = []

  // 解包 FrozenBlueprint
  const raw = blueprint?.data ?? blueprint

  for (const scene of raw.scenes || []) {
    nodes[scene.id] = {
      id: scene.id,
      type: 'SCENE',
      parentId: raw.director?.id || 'root',
      status: 'DONE',
      label: scene.name || scene.id,
    }

    for (const shot of scene.shots || []) {
      nodes[shot.id] = {
        id: shot.id,
        type: 'SHOT',
        parentId: scene.id,
        status: 'DONE',
        label: shot.name || shot.id,
      }
    }
  }

  return { nodes, edges }
}
