/**
 * governance/dag/execution-dag.ts — Execution DAG Trace
 *
 * Phase 5, Rule 6: 执行必须可追踪
 * 每条执行生成一个 DAG 节点，记录上下游依赖
 */

import crypto from 'crypto'

export interface ExecutionDagNode {
  id: string
  userId: string
  taskType: string
  provider: string
  model: string
  timestamp: number
  parentId?: string
  traceId?: string
  cost?: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  error?: string
}

const dagNodes: Map<string, ExecutionDagNode> = new Map()

export function createExecutionNode(data: {
  userId: string
  taskType: string
  provider: string
  model: string
  parentId?: string
  traceId?: string
}): ExecutionDagNode {
  const node: ExecutionDagNode = {
    id: crypto.randomUUID(),
    userId: data.userId,
    taskType: data.taskType,
    provider: data.provider,
    model: data.model,
    timestamp: Date.now(),
    parentId: data.parentId,
    traceId: data.traceId,
    status: 'pending',
  }

  dagNodes.set(node.id, node)
  return node
}

export function updateExecutionNode(
  id: string,
  updates: Partial<Pick<ExecutionDagNode, 'status' | 'error' | 'cost'>>
): void {
  const node = dagNodes.get(id)
  if (node) {
    Object.assign(node, updates)
  }
}

export function getExecutionDag(traceId?: string): ExecutionDagNode[] {
  if (traceId) {
    return Array.from(dagNodes.values()).filter(n => n.traceId === traceId)
  }
  return Array.from(dagNodes.values()).slice(-100)
}
