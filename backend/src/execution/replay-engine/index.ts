/**
 * execution/replay-engine/index.ts — 回放引擎
 *
 * 职责：基于已有 trace 重放 workflow 执行
 *   1. 读取 trace → 提取每个节点的 input
 *   2. 传入 WorkflowEngine 重新执行
 *   3. 返回对比结果
 *
 * 约束：
 *   - 不修改原始 trace
 *   - 不写入新 trace（v1 只做分析用途）
 *   - 使用当前用户配置（非当时的配置）
 *
 * 所属层：Control Plane
 */

import type { WorkflowGraph } from '../../workflow/types.js'
import { WorkflowEngine } from '../../workflow/workflow-engine.js'
import type { ReplayResult, ReplayStep, ReplayOptions } from './types.js'

export class ReplayEngine {
  private engine: WorkflowEngine

  constructor(engine: WorkflowEngine) {
    this.engine = engine
  }

  async replay(
    graph: WorkflowGraph,
    trace: ExecutionTrace | null,
    userConfig: any,
    userId: string,
    options: ReplayOptions = {},
  ): Promise<ReplayResult> {
    const startTime = Date.now()
    const steps: ReplayStep[] = []

    for (const node of graph.nodes) {
      if (node.type === 'manual.confirm') continue

      const originalStep = trace?.steps?.find(s => s.data?.nodeId === node.id)
      const input = originalStep?.data?.input || node.input

      // skipSuccessNodes: 对已在 trace 中成功的节点跳过
      if (options.skipSuccessNodes && originalStep) {
        const last = trace?.steps?.filter(s => s.data?.nodeId === node.id)
        if (last?.[last.length - 1]?.name.includes('success')) {
          steps.push({ nodeId: node.id, type: node.type, status: 'success', input, durationMs: 0 })
          continue
        }
      }

      const nodeStart = Date.now()
      try {
        const result = await this.engine.executeNode(node.type, input, userConfig, userId)
        steps.push({
          nodeId: node.id,
          type: node.type,
          status: result.success ? 'success' : 'failed',
          input,
          output: result.output,
          error: result.error,
          durationMs: Date.now() - nodeStart,
        })
      } catch (err: any) {
        steps.push({
          nodeId: node.id,
          type: node.type,
          status: 'failed',
          input,
          error: err.message,
          durationMs: Date.now() - nodeStart,
        })
      }
    }

    const failedSteps = steps.filter(s => s.status === 'failed')
    return {
      traceId: trace?.id || 'replay',
      success: failedSteps.length === 0,
      steps,
      totalDurationMs: Date.now() - startTime,
    }
  }
}
