/**
 * Re-execution Engine
 * Phase 4 — Execution Control Layer
 *
 * 局部重跑引擎：将修改后的 blueprint 冻结为新版本，调度执行。
 * 目前使用 LocalMockRenderer 执行，未来接生产 RenderAdapter。
 */

import { freezeBlueprint, FrozenBlueprint } from '../production-loop/blueprint-freeze'
import { RenderExecutor } from '../production-loop/render-executor'
import { LocalMockRenderer } from '../production-loop/render-adapter'
import { DAGPatchEngine } from './dag-patch-engine'
import { SubtreeExtractor } from './subtree-extractor'
import { ExecutionTimeline } from '../production-loop/timeline-types'

export interface ReExecutionResult {
  jobId: string
  traceId: string
  nodeId: string
  affectedNodes: string[]
  blueprintId: string
  state: string
}

const executor = new RenderExecutor(new LocalMockRenderer())
const patchEngine = new DAGPatchEngine()
const subtreeExtractor = new SubtreeExtractor()

export class ReExecutionEngine {
  /**
   * 重跑指定节点的子树
   * 1. 提取受影响节点
   * 2. 收集节点在新 blueprint 中的状态
   * 3. freeze 为不可变 blueprint
   * 4. 调度执行（通过 executor.tick）
   */
  async reRunSubtree(
    traceId: string,
    timeline: ExecutionTimeline,
    blueprint: any, // 可能是 FrozenBlueprint 或 raw blueprint
    nodeId: string,
  ): Promise<ReExecutionResult> {
    // 1. 解包 frozen blueprint（如果传入的是 FrozenBlueprint）
    const rawBlueprint = blueprint?.data ?? blueprint

    // 2. 提取影响范围
    const affectedNodes = subtreeExtractor.extract(timeline, nodeId)
    const node = patchEngine.findNode(rawBlueprint, nodeId)
    if (!node) {
      throw new Error(`ReExecutionEngine: node ${nodeId} not found in blueprint`)
    }

    // 3. 标记节点状态为 DISPATCHED
    node.state = 'DISPATCHED'

    // 4. freeze blueprint（创建新版本）
    const frozen = freezeBlueprint(rawBlueprint)

    // 5. 创建新 Job
    const job = {
      id: crypto.randomUUID(),
      traceId,
      state: 'DISPATCHED' as const,
      blueprint: frozen,
      updatedAt: Date.now(),
    }

    // 6. 执行
    const result = await executor.tick(job)

    return {
      jobId: job.id,
      traceId,
      nodeId,
      affectedNodes,
      blueprintId: frozen.blueprintId,
      state: result.state,
    }
  }
}
