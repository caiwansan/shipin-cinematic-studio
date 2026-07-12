// ============================================================
// DiscoveryResult — GEO 系统唯一 SSOT 领域对象
// 不属于任何 Engine，而是整个 GEO 的认知输出标准。
// 所有下游引擎（Knowledge / Recommendation / Mission / Verification / Learning）
// 只能消费 DiscoveryResult，禁止直接读取 Provider 输出。
// ============================================================

export interface DiscoveryResult {
  /** 语义版本号，Schema 变更时递增 */
  version: string

  metadata: DiscoveryMetadata
  entity: EntityInfo
  presence: PresenceInfo
  knowledge: KnowledgeInfo
  competitors: CompetitorInfo
  recommendations: RecommendationSummary
  evidence: EvidenceSummary
  diagnostics: DiagnosticsInfo

  /** Provider 原始输出 — UI 禁止直接消费，仅用于审计/debug */
  raw?: Record<string, unknown>
}

// ── Metadata ──
export interface DiscoveryMetadata {
  projectId: string
  entityId: string
  discoveredAt: string // ISO-8601
  providers: string[]
  overralConfidence: number // 0-100
  executionId: string
  pipelineVersion: string
  durationMs: number
  /** V2: Pipeline 产生的全部 DiscoverySignal */
  signals: import('./discovery-signal.js').DiscoverySignal[]
}

// ── Entity ──
export interface EntityInfo {
  name: string
  aliases: string[]
  website?: string
  categories: string[]
  locations: string[]
  logoUrl?: string
  description?: string
}

// ── Presence — AI 平台的可见性和影响力 ──
export interface PresenceInfo {
  providerResults: ProviderPresenceResult[]
  visibility: number
  sentiment: number
  authority: number
  citations: Citation[]
}

export interface ProviderPresenceResult {
  provider: string
  presence: 'full' | 'partial' | 'none'
  confidence: number
  snippet?: string
}

export interface Citation {
  source: string
  url: string
  snippet: string
  relevanceScore: number
}

// ── Knowledge ──
export interface KnowledgeInfo {
  coverage: number
  claims: KnowledgeClaim[]
  evidence: KnowledgeEvidence[]
  faq: KnowledgeFAQ[]
  schema: KnowledgeSchema[]
  missingKnowledge: MissingKnowledge[]
}

export interface KnowledgeClaim {
  claim: string
  status: 'verified' | 'unverified' | 'disputed'
  source?: string
  confidence: number
}

export interface KnowledgeEvidence {
  summary: string
  supportLevel: 'strong' | 'partial' | 'conflicting' | 'none'
  sources: string[]
}

export interface KnowledgeFAQ {
  question: string
  answer: string
  confidence: number
}

export interface KnowledgeSchema {
  type: string
  data: Record<string, unknown>
}

export interface MissingKnowledge {
  topic: string
  priority: 'high' | 'medium' | 'low'
  reason: string
}

// ── Competitors ──
export interface CompetitorInfo {
  entities: CompetitorEntity[]
  gaps: string[]
  opportunities: string[]
}

export interface CompetitorEntity {
  name: string
  strength: 'strong' | 'moderate' | 'weak'
  keyAdvantage?: string
}

// ── Recommendations ──
export interface RecommendationSummary {
  items: string[]
  priority: 'high' | 'medium' | 'low'
}

// ── Evidence ──
export interface EvidenceSummary {
  totalCount: number
  highConfidence: number
  totalCitations: number
}

// ── Diagnostics ──
export interface DiagnosticsInfo {
  stageDurations: Record<string, number>
  errors: StageError[]
  warnings: string[]
}

export interface StageError {
  stage: string
  message: string
  recoverable: boolean
}
