// ============================================================
// ExecutionArtifact 工厂函数
// ============================================================

import { v4 as uuidv4 } from 'uuid'
import type { ExecutionArtifact } from './types'

export function createExecutionArtifact(params: {
  type: string
  payload: unknown
  nodeId: string
  graphId: string
  provider: string
  duration: number
  cost: number
  retryCount: number
}): ExecutionArtifact {
  return {
    id: uuidv4(),
    type: params.type,
    payload: params.payload,
    metadata: {
      nodeId: params.nodeId,
      graphId: params.graphId,
      provider: params.provider,
      duration: params.duration,
      cost: params.cost,
      retryCount: params.retryCount,
    },
    createdAt: new Date().toISOString(),
  }
}
