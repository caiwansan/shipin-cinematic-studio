// ============================================================
// DLQService — Dead Letter Queue 服务 (RC2-3c)
// ============================================================
// 职责：将失败节点加入 DLQ、查询、重放标记、归档
// 注意：DLQ 不执行任务，只存储失败状态。
// Replay 只标记状态，由调用方重新提交 Execution Request。

import { v4 as uuidv4 } from 'uuid'
import type { ExecutionNode, ExecutionEvent } from '../types'
import type { DLQRecord, DLQQuery, DLQReason } from './dlq.types'
import type { IDLQRepository } from '../repository/dlq.repository'
import type { FallbackGraph } from '../fallback/fallback.types'

/**
 * 创建 ExecutionEvent（DLQ 内部使用）
 * 不使用 event.ts 的 createExecutionEvent，因为 ExecutionEventType 是 RC1 冻结联合类型，
 * 新增的 DLQ 事件类型（node_dead_lettered, dlq_replayed, dlq_archived）不在其中。
 * 这里直接构造 ExecutionEvent 对象以保持兼容性。
 */
function createDLQEvent(params: {
  executionId: string
  graphId: string
  type: string
  nodeId?: string
  data?: Record<string, unknown>
}): ExecutionEvent {
  return {
    id: uuidv4(),
    executionId: params.executionId,
    graphId: params.graphId,
    type: params.type as any,
    nodeId: params.nodeId,
    timestamp: new Date().toISOString(),
    data: params.data,
  }
}

export class DLQService {
  constructor(private repository: IDLQRepository) {}

  /**
   * 将失败节点加入 DLQ
   * 在以下情况调用：
   * - retry 耗尽 + fallback 耗尽
   * - circuit_breaker_open（无可用 fallback）
   * - deadlock
   */
  async enqueue(params: {
    executionId: string
    graphId: string
    node: ExecutionNode
    reason: DLQReason
    errorMessage: string
    fallbackGraph?: FallbackGraph
  }): Promise<{ record: DLQRecord; events: ExecutionEvent[] }> {
    const record: DLQRecord = {
      id: uuidv4(),
      executionId: params.executionId,
      graphId: params.graphId,
      nodeId: params.node.id,
      provider: params.node.artifact?.metadata?.provider || 'unknown',
      capability: params.node.capability,
      reason: params.reason,
      errorMessage: params.errorMessage,
      payload: {
        nodeConfig: params.node.config,
        artifact: params.node.artifact,
        fallbackGraph: params.fallbackGraph
          ? {
              id: params.fallbackGraph.id,
              selectedNodeId: params.fallbackGraph.selectedNodeId,
              totalFallbacks: params.fallbackGraph.fallbackNodes.length,
            }
          : undefined,
      },
      status: 'pending' as const,
      retryCount: params.node.retryConfig?.maxRetries || 0,
      fallbackAttempts: params.fallbackGraph?.fallbackNodes.length || 0,
      createdAt: new Date().toISOString(),
    }

    await this.repository.save(record)

    const events: ExecutionEvent[] = [
      createDLQEvent({
        executionId: params.executionId,
        graphId: params.graphId,
        type: 'node_dead_lettered',
        nodeId: params.node.id,
        data: {
          dlqId: record.id,
          reason: params.reason,
          provider: record.provider,
          errorMessage: params.errorMessage,
        },
      }),
    ]

    return { record, events }
  }

  async findPending(): Promise<DLQRecord[]> {
    return this.repository.findPending()
  }

  async findByExecution(executionId: string): Promise<DLQRecord[]> {
    return this.repository.findByExecution(executionId)
  }

  async findById(id: string): Promise<DLQRecord | null> {
    return this.repository.findById(id)
  }

  async query(query: DLQQuery): Promise<{ records: DLQRecord[]; total: number }> {
    return this.repository.query(query)
  }

  /**
   * 重放 DLQ 记录（只标记，不执行）
   * 返回需要重放的信息，由调用方决定如何重放
   */
  async replay(id: string, replayedExecutionId: string): Promise<{ events: ExecutionEvent[] }> {
    const record = await this.repository.findById(id)
    if (!record) {
      throw new Error(`DLQ record not found: ${id}`)
    }
    if (record.status !== 'pending') {
      throw new Error(`Cannot replay DLQ record ${id}: status is ${record.status}`)
    }

    await this.repository.markReplayed(id, replayedExecutionId)

    const events: ExecutionEvent[] = [
      createDLQEvent({
        executionId: record.executionId,
        graphId: record.graphId,
        type: 'dlq_replayed',
        nodeId: record.nodeId,
        data: {
          dlqId: id,
          replayedExecutionId,
          provider: record.provider,
        },
      }),
    ]

    return { events }
  }

  /**
   * 归档 DLQ 记录
   */
  async archive(id: string): Promise<{ events: ExecutionEvent[] }> {
    const record = await this.repository.findById(id)
    if (!record) {
      throw new Error(`DLQ record not found: ${id}`)
    }

    await this.repository.archive(id)

    return {
      events: [
        createDLQEvent({
          executionId: record.executionId,
          graphId: record.graphId,
          type: 'dlq_archived',
          nodeId: record.nodeId,
          data: { dlqId: id },
        }),
      ],
    }
  }

  async count(): Promise<number> {
    const result = await this.repository.query({})
    return result.total
  }
}
