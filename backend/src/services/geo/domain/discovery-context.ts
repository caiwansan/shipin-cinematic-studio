// ============================================================
// DiscoveryContext — Pipeline 中间状态，传输给每个 Stage
// Stage 修改的是 Context，最后由 Builder 转换为 DiscoveryResult
//
// V2 变更：Stage 消费 DiscoverySignal，通过 signalGroups 传递
// Entity / Presence / Knowledge 直接从 signals 聚合得出
// ============================================================

import type { DiscoveryResult, EntityInfo, PresenceInfo, KnowledgeInfo, CompetitorInfo, DiscoveryMetadata } from './discovery-result'
import type { DiscoverySignal } from './discovery-signal'

export interface DiscoveryContext {
  // 初始注入
  projectId: string
  entityId: string
  entityName: string

  // Pipeline 执行状态
  currentStage: string
  stageResults: Record<string, StageResult>
  startedAt: string // ISO-8601
  errors: StageError[]

  /** 全部 Stage 产生的 DiscoverySignal 聚合 */
  signals: DiscoverySignal[]

  // 各阶段积累的数据
  entity?: Partial<EntityInfo>
  presence?: Partial<PresenceInfo>
  knowledge?: Partial<KnowledgeInfo>
  competitors?: Partial<CompetitorInfo>
}

export interface StageResult {
  stage: string
  input: unknown
  output: unknown
  durationMs: number
  confidence: number
  evidenceCount: number
  error?: string
}

export interface StageError {
  stage: string
  message: string
  recoverable: boolean
}

// Context → Result 转换所需的元数据
export interface ContextMetadata {
  projectId: string
  entityId: string
  discoveredAt: string
  providers: string[]
  executionId: string
  pipelineVersion: string
  durationMs: number
}
