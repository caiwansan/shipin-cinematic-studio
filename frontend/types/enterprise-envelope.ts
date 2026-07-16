/**
 * Enterprise Data Envelope v1.1 — IMP-02 Update
 * 
 * MetricValue 支持 number | string（OutcomeΔ 为字符串）
 * 其余不变。
 */

export interface EnterpriseDataEnvelope<T> {
  data: T
  source: string
  freshness: string
  confidence?: number
  timestamp: string
}

/**
 * 基础 Metric 数据
 * IMP-02: value 支持 number | string
 */
export interface MetricValue {
  value: number | string
  trend?: string
  label?: string  // Metric 显示名称（如 "Events Today"）
}

/**
 * Decision 模型
 */
export interface Decision {
  id: string
  title: string
  rationale: string
  priorityLevel?: 'P1' | 'P2' | 'P3' | 'P4'
  priorityScore?: number
  decisionStatus?: 'detected' | 'reviewed' | 'accepted' | 'rejected' | 'expired'
  confidence?: number
  impact?: string
  recommendation?: string
  evidence?: EvidenceNode[]
}

export interface EvidenceNode {
  id: string
  type: 'signal' | 'event' | 'lead' | 'content' | 'interaction'
  description: string
  timestamp: string | Date
  confidence: number
  metadata?: Record<string, any>
}

export interface EvidenceGraph {
  recommendationId: string
  nodes: EvidenceNode[]
  connections: { from: string; to: string; reason: string }[]
}

export type EvidenceGraphEnvelope = EnterpriseDataEnvelope<EvidenceGraph>

export interface ActionProgress {
  id: string
  title: string
  description?: string
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'verified' | 'rejected'
  priority?: string
  ownerType?: 'human' | 'team' | 'ai_agent'
  ownerId?: string
  ownerName?: string
  triggerSource?: string  // Which Decision triggered this Action
  progress?: number
  startedAt?: string
  completedAt?: string
  expectedOutcome?: string
  createdAt?: string
  updatedAt?: string
}

export interface Signal {
  id: string
  description: string
  severity: 'high' | 'medium' | 'low'
  source?: string
  detectedAt?: string
  confidence?: number
}

export interface ChannelAccount {
  id: string
  name: string
  platform: string
  connected: boolean
  lastSyncAt?: string
  interactionCount?: number
}

export interface SyncStatus {
  lastSyncAt: string
  totalSynced: number
  failed: number
  nextSyncAt?: string
}

export interface Outcome {
  id: string
  title: string
  impact?: string
  confidence?: number
  verifiedAt?: string
  status: 'pending_verify' | 'verified' | 'rejected'
}

// ─── Envelope 类型别名 ───

export type MetricEnvelope = EnterpriseDataEnvelope<MetricValue>
export type DecisionEnvelope = EnterpriseDataEnvelope<Decision>
export type ActionEnvelope = EnterpriseDataEnvelope<ActionProgress>
export type SignalEnvelope = EnterpriseDataEnvelope<Signal>
export type ChannelEnvelope = EnterpriseDataEnvelope<ChannelAccount>
export type SyncEnvelope = EnterpriseDataEnvelope<SyncStatus>
export type OutcomeEnvelope = EnterpriseDataEnvelope<Outcome>

// ─── Source Registry ───

export const SourceRegistry = {
  OperationEvent: 'OperationEvent',
  DecisionEngine: 'DecisionEngine',
  ActionLifecycle: 'ActionLifecycle',
  OutcomeIntelligence: 'OutcomeIntelligence',
  EvidenceGraph: 'EvidenceGraph',
  ChannelSync: 'ChannelSync',
  CustomerMapping: 'CustomerMapping',
  EnterpriseContext: 'EnterpriseContext',
  KnowledgeBase: 'KnowledgeBase',
  LeadScoring: 'LeadScoring',
  AuditLog: 'AuditLog',
} as const

export type SourceName = typeof SourceRegistry[keyof typeof SourceRegistry]
