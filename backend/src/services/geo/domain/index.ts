// ============================================================
// Discovery Index — Domain 统一导出
// 所有 Engine 只能通过此文件消费 Domain 类型
// ============================================================

export type { DiscoveryResult } from './discovery-result'
export type { DiscoverySignal, SignalEvidence, SignalCitation, SignalType, SignalGroup } from './discovery-signal'
export type {
  DiscoveryMetadata,
  EntityInfo,
  PresenceInfo,
  ProviderPresenceResult,
  Citation,
  KnowledgeInfo,
  KnowledgeClaim,
  KnowledgeEvidence,
  KnowledgeFAQ,
  KnowledgeSchema,
  MissingKnowledge,
  CompetitorInfo,
  CompetitorEntity,
  RecommendationSummary,
  EvidenceSummary,
  DiagnosticsInfo,
  StageError,
} from './discovery-result'

export type { DiscoveryContext, StageResult, ContextMetadata } from './discovery-context'

export type { DiscoveryEnvelope, EnvelopeDiagnostics, StageDiagnostics, ExecutionInfo } from './discovery-envelope'

export type { ReplayRecord } from './replay-record'

export type { ProviderResult } from './provider-result'

export type { GeoEvidence, GeoCitation, GeoConfidence } from './evidence'

export type { ActionPlan, ActionItem, ActionPriority, ActionStatus } from './action-plan'
export type { VerificationRequest, VerificationStatus, VerificationSource } from './verification-request'

export type { ProjectIdentifier, TenantIdentifier, BrandIdentifier, KnowledgeObjectIdentifier } from './identifiers'
export { isValidUUID, asProjectIdentifier } from './identifiers'
