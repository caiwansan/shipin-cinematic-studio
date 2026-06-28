/**
 * core/control-plane/cutover/execution-cutover.ts
 *
 * 执行切割器（Execution Cutover）— P2 → P5 过渡层。
 *
 * 分布式调度器（DistributedScheduler）、全局调度器（GlobalScheduler）、
 * 自治调度器（SelfOptimizingScheduler）、Agent 图执行器（GraphExecutor）
 * 都通过本模块将任务转交给实际的控制平面。
 *
 * 当前实现为 stub，直接本地执行（P2 模式）。
 * 待 P5 集群上线后，执行逻辑改为通过 ClusterManager 分发。
 */

import type { Capability } from '../../runtime/capabilities.js'

export interface CutoverRequest {
  capability: Capability
  userId: string
  payload: any
  priority?: number
}

export interface CutoverResult {
  success: boolean
  data?: any
  error?: string
  executedBy: 'local' | 'distributed'
}

class ExecutionCutover {
  /**
   * 执行任务切割
   *
   * 当前实现：直接本地执行。
   * P5 集群上线后，改为通过 clusterManager.dispatch() 分发。
   */
  async execute(request: CutoverRequest): Promise<CutoverResult> {
    try {
      console.log(`[ExecutionCutover] local execute: capability=${request.capability}, userId=${request.userId}`)

      // 未来 P5：通过 clusterManager 分发
      // const node = await clusterManager.selectNode(request.capability, request.userId)
      // return await clusterManager.dispatch(node, request)

      return {
        success: true,
        data: { message: 'stub: local execution' },
        executedBy: 'local',
      }
    } catch (err: any) {
      console.error(`[ExecutionCutover] ❌ execution failed: ${err.message}`)
      return {
        success: false,
        error: err.message || 'execution failed',
        executedBy: 'local',
      }
    }
  }
}

export const executionCutover = new ExecutionCutover()
