/**
 * observation/execution-tracker.ts — 执行跟踪器
 *
 * 将 execution-trace 的步骤绑定到 Workflow 节点，返回实时状态。
 * 只读投影：不修改任何执行状态。
 *
 * 所属层：Observation Layer
 */

import type { VisualNodeStatus } from './types.js'

export interface TraceStep {
  name: string
  data?: {
    nodeId?: string
    input?: any
    output?: any
    error?: string
    durationMs?: number
    timestamp?: string
  }
}

export interface ExecutionTrace {
  id: string
  steps: TraceStep[]
}

/** 节点状态映射（纯只读投影） */
export class ExecutionTracker {
  getNodeStatus(nodeId: string, trace?: ExecutionTrace | null): VisualNodeStatus {
    if (!trace || !trace.steps || trace.steps.length === 0) return 'pending'

    const nodeSteps = trace.steps.filter(s => s.data?.nodeId === nodeId)
    if (nodeSteps.length === 0) return 'pending'

    const lastStep = nodeSteps[nodeSteps.length - 1]
    if (lastStep.name.includes('fail') || lastStep.name.includes('error')) return 'failed'
    if (lastStep.name.includes('success') || lastStep.name.includes('complete')) return 'success'
    if (lastStep.name.includes('start') || lastStep.name.includes('run')) return 'running'

    return 'pending'
  }

  getAllNodeStatuses(
    nodeIds: string[],
    trace?: ExecutionTrace | null,
  ): Record<string, VisualNodeStatus> {
    const result: Record<string, VisualNodeStatus> = {}
    for (const id of nodeIds) result[id] = this.getNodeStatus(id, trace)
    return result
  }

  getNodeDetails(nodeId: string, trace?: ExecutionTrace | null): {
    durationMs?: number
    error?: string
    startTime?: string
    endTime?: string
  } | null {
    if (!trace) return null
    const nodeSteps = trace.steps.filter(s => s.data?.nodeId === nodeId)
    if (nodeSteps.length === 0) return null
    const lastData = nodeSteps[nodeSteps.length - 1].data
    return {
      durationMs: lastData?.durationMs,
      error: lastData?.error,
      startTime: nodeSteps.find(s => s.name.includes('start'))?.data?.timestamp,
      endTime: lastData?.timestamp,
    }
  }
}
