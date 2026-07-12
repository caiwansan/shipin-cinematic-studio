// ============================================================
// Discovery Engine 2.0 — GEO Architecture Baseline v2.0
//
// Sprint B1 — Architecture Freeze (COMPLETED)
// Sprint B2 — Production Migration
//   B2-001: DiscoveryProvider 接口 + Legacy/Engine2 Provider + Feature Flag
//   B2-002: Presence Adapter 接入真实 Provider（DeepSeek）
//   B2-003: DiscoveryValidator
//   B2-004: 生产切换 + 删除 mockScanner
// ============================================================

export { DiscoveryOrchestrator } from './orchestrator/index.js'
export { DiscoveryPipeline } from './pipeline/index.js'
export type { PipelineStage, PipelineStageOutput } from './pipeline/types.js'

// Services
export { DiscoveryService, discoveryService } from './services/index.js'
export { LegacyMockProvider, Engine2Provider } from './services/index.js'
export { getDiscoveryProvider, refreshDiscoveryProvider, getDiscoveryVersion } from './services/index.js'
export { DiscoveryValidator, discoveryValidator } from './services/index.js'
export type { DiscoveryProvider } from './services/index.js'
export type { ValidationReport, ValidationError } from './services/index.js'
export { DiscoveryMetricsCollector, discoveryMetrics } from './services/index.js'
export type { DiscoveryMetricsRecord, StageMetrics, ProviderMetrics } from './services/index.js'

export { ProviderRegistry, providerRegistry } from './registry/index.js'
export type { ProviderRegistration } from './registry/index.js'
export { PresenceAdapter } from './adapters/index.js'
export type { DiscoveryAdapter } from './adapters/types.js'
export { DiscoveryEvents } from './events/index.js'
export type { DiscoveryCompletedPayload, DiscoveryFailedPayload } from './events/index.js'

// Domain 类型
export type {
  DiscoveryResult,
  DiscoveryContext,
  DiscoveryEnvelope,
  ReplayRecord,
  DiscoveryMetadata,
  EntityInfo,
  PresenceInfo,
  ProviderPresenceResult,
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
  EnvelopeDiagnostics,
  StageDiagnostics,
  ExecutionInfo,
  GeoEvidence,
  GeoCitation,
  GeoConfidence,
} from '../domain/index.js'
