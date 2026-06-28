/**
 * kernel-v1/types.ts — Kernel v1 类型定义
 *
 * MVEL: Command → Validate → Route → Apply → EventLog → Read
 * 范围限定：EntityGraph + EventLog + 基础 validate
 * 不进 v1: Snapshot / Sequel / DNA / TimelineStore / PostHooks
 */

export type KernelSource =
  | 'UI'
  | 'Agent'
  | 'TimelineStage'
  | 'Execution'

export type KernelTarget =
  | 'EntityGraph'
  | 'Timeline'
  | 'EventLog'

export type KernelType =
  | 'ENTITY_CREATE'
  | 'ENTITY_UPDATE'
  | 'ENTITY_DELETE'
  | 'ENTITY_REGENERATE'
  | 'ENTITY_BATCH_CREATE'
  | 'TIMELINE_UPDATE'

export interface KernelPayload {
  projectId: string
  entityType?: string       // character / scene / prop / voice / effect / shot
  entityId?: string
  data?: any                // 创建/更新数据
  diff?: any                // PATCH diff（ENTITY_UPDATE 时用）
  reason?: string           // 变更原因，写入 EventLog
  batch?: { entityType: string; data: any }[]  // ENTITY_BATCH_CREATE
  parentEventId?: string    // v1.1: 因果链父事件 ID
}

export interface KernelCommand {
  source: KernelSource
  target: KernelTarget
  type: KernelType
  payload: KernelPayload
}

export interface EventRecord {
  id: string
  projectId: string
  timestamp: number
  source: KernelSource
  type: KernelType
  target: KernelTarget
  payload: KernelPayload
  sequence: number          // 按 projectId 递增的序列号
}

export interface EntityNode {
  id: string
  projectId: string
  type: string
  version: number
  data: any
  createdAt: number
  updatedAt: number
  parentId?: string
  tags: string[]
}

export interface EntityGraph {
  entities: Map<string, EntityNode>   // key = `${type}:${id}`
  projectId: string
  version: number
}

export interface KernelCommandResult {
  ok: boolean
  event: EventRecord
  result?: any
  error?: string
}

export interface KernelReadResult {
  projectId: string
  entityGraph: {
    entities: Record<string, EntityNode>
    version: number
  }
  timeline?: any             // v1 暂不实现
}
