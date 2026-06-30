// ============================================================
// GEO Core Types — Sprint 1A + Sprint 1B Knowledge Quality
// ============================================================

// ─── Enums ───

export enum ReviewState {
  Draft = 'draft',
  Reviewed = 'reviewed',
  Approved = 'approved',
  Rejected = 'rejected',
  RequestRevision = 'request_revision',
  Escalated = 'escalated',
  Stale = 'stale',
  Archived = 'archived',
}

export enum EntityType {
  Person = 'Person',
  Organization = 'Organization',
  Concept = 'Concept',
  Product = 'Product',
  Location = 'Location',
  Event = 'Event',
  Technology = 'Technology',
  Field = 'Field',
  Brand = 'Brand',
}

export enum FreshnessState {
  Fresh = 'fresh',
  Aging = 'aging',
  Stale = 'stale',
  Expired = 'expired',
}

export enum EvidenceSourceType {
  Web = 'web',
  Academic = 'academic',
  Internal = 'internal',
  LLMGenerated = 'llm_generated',
  UserProvided = 'user_provided',
}

export enum CitationFormat {
  APA = 'apa',
  MLA = 'mla',
  Custom = 'custom',
}

export enum SchemaValidationStatus {
  Pending = 'pending',
  Valid = 'valid',
  Invalid = 'invalid',
}

// ─── Provenance & Lineage ───

export interface ProvenanceRecord {
  source: string
  sourceMetadata?: Record<string, unknown>
  action: 'created' | 'updated' | 'deleted' | 'merged' | 'forked' | 'approved' | 'rejected'
  actor: string
  timestamp: string // ISO 8601
  reason?: string
  previousVersionId?: string
}

export function createProvenanceRecord(overrides?: Partial<ProvenanceRecord>): ProvenanceRecord {
  return {
    source: 'geo.entity',
    action: 'created',
    actor: 'agent:geo.entity',
    timestamp: new Date().toISOString(),
    reason: '',
    ...overrides,
  }
}

export interface LineageRecord {
  outputType: string
  outputSegment: string
  tracePath: string[] // e.g. ["entity1", "→", "entity2"]
}

export function createLineageRecord(sourceName: string, targetName: string, relationType?: string): LineageRecord {
  return {
    outputType: 'entity_relation',
    outputSegment: relationType || 'related_to',
    tracePath: [sourceName, '→', targetName],
  }
}

// ─── Sprint 1B: Agent Output Contract (Uniform) ───

export type AgentStatus = 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' | 'SKIPPED' | 'TIMEOUT' | 'RETRY'

export interface RuntimeTrace {
  executionId: string
  workflowNodeId: string
  parentNodeId?: string
  agent: string
  startedAt: string    // ISO 8601
  finishedAt: string   // ISO 8601
  duration: number     // ms
}

export interface AgentDiagnostics {
  warnings: string[]
  validationErrors: string[]
  fallbackUsed: boolean
  reason?: string
}

export interface AgentOutput<T> {
  objectType: 'claim' | 'evidence' | 'citation' | 'faq' | 'schema' | 'entity' | 'graph'
  data: T[]
  status: AgentStatus
  confidence: number       // 0-1, agent confidence in output quality
  error?: string
  provenance: ProvenanceRecord
  lineage: LineageRecord[]
  diagnostics: AgentDiagnostics
  trace: RuntimeTrace
  runtimeMetadata: {
    agentVersion: string
    model: string
    provider: string
    executionId: string
    workflowNodeId: string
  }
  executionMetrics: {
    latency: number           // ms
    tokens: number            // total tokens consumed
    cost: number              // USD (estimated)
    retryCount: number
  }
}

export function createAgentOutput<T>(overrides: Partial<AgentOutput<T>> & {
  objectType: AgentOutput<T>['objectType']
  data: T[]
  trace: RuntimeTrace
}): AgentOutput<T> {
  return {
    objectType: overrides.objectType,
    data: overrides.data,
    status: overrides.status || 'SUCCESS',
    confidence: overrides.confidence ?? 1.0,
    provenance: overrides.provenance || createProvenanceRecord({ source: `agent:${overrides.trace.agent}`, action: 'created', actor: `execution:${overrides.trace.executionId}` }),
    lineage: overrides.lineage || [],
    diagnostics: overrides.diagnostics || { warnings: [], validationErrors: [], fallbackUsed: false },
    trace: overrides.trace,
    runtimeMetadata: overrides.runtimeMetadata || {
      agentVersion: '1.0.0',
      model: 'default',
      provider: 'default',
      executionId: overrides.trace.executionId,
      workflowNodeId: overrides.trace.workflowNodeId,
    },
    executionMetrics: overrides.executionMetrics || {
      latency: overrides.trace.duration,
      tokens: 0,
      cost: 0,
      retryCount: 0,
    },
  }
}

// ─── Sprint 1A: Core Domain Types ───

export interface GEOProject {
  id: string
  userId: string
  name: string
  topic?: string
  industry?: string
  language: string
  country?: string
  status: string
  config?: Record<string, unknown>
  workspaceId?: string
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
  entityCount?: number
  relationCount?: number
  versionCount?: number
}

export interface Topic {
  primaryTopic: string
  secondaryTopics: string[]
  intent?: string
  audience?: string
  questions?: string[]
  competitors?: string[]
  keywords?: string[]
}

export interface Entity {
  id: string
  projectId: string
  name: string
  type: EntityType
  description?: string
  metadata?: Record<string, unknown>
  provenance: ProvenanceRecord
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface EntityRelation {
  id: string
  projectId: string
  sourceId: string
  targetId: string
  type: string
  lineage: LineageRecord
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface KnowledgeGraph {
  entities: Entity[]
  edges: EntityRelation[]
  metadata: {
    projectId: string
    buildVersion: number
    nodeCount: number
    edgeCount: number
    builtAt: string
  }
}

export interface GraphVisualizationData {
  nodes: Array<{
    id: string
    label: string
    type: EntityType
    group: number
  }>
  edges: Array<{
    source: string
    target: string
    label: string
  }>
}

// ─── Sprint 1B: Knowledge Quality Types ───

export interface Claim {
  id: string
  entityId: string
  text: string
  claimType: string
  confidence: number
  sourceType: string
  status: string
  provenance: ProvenanceRecord
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface Evidence {
  id: string
  claimId: string
  source: string
  content: string
  credibilityScore: number
  verificationMethod: string
  collectedAt: string
  provenance: ProvenanceRecord
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface Citation {
  id: string
  evidenceId: string
  format: string
  citationText: string
  sourceUrl?: string
  publisher?: string
  author?: string
  datePublished?: string
  authorityLevel: string
  provenance: ProvenanceRecord
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface FAQ {
  id: string
  entityId: string
  question: string
  answer: string
  schemaType: string
  confidence: number
  status: string
  provenance: ProvenanceRecord
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface SchemaMarkup {
  id: string
  entityId: string
  schemaType: string
  markup: Record<string, unknown>
  validationStatus: string
  validationErrors: string[]
  provenance: ProvenanceRecord
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ReviewQueueItem {
  id: string
  projectId: string
  reviewableType: string
  reviewableId: string
  state: string
  reviewerId?: string
  reviewNotes?: string
  previousState?: string
  provenance: ProvenanceRecord
  createdAt: string
  updatedAt: string
}

export interface QualityScore {
  id: string
  projectId: string
  dimension: string
  score: number
  breakdown?: Record<string, unknown>
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface FreshnessRecord {
  id: string
  projectId: string
  objectType: string
  objectId: string
  freshnessState: string
  verificationState: string
  lastChecked: string
  lastVerifiedAt?: string
  nextReviewAt?: string
  ttlSeconds: number
  checkCount: number
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// ─── B3 Agent Context (Stateless injection) ───

export interface AgentContext {
  projectId: string
  userId: string
  executionId: string
  workflowNodeId: string
  parentNodeId?: string
  config: {
    model?: string
    provider?: string
    maxRetries?: number
    timeoutMs?: number
    [key: string]: unknown
  }
  capabilities: {
    llm: {
      generate: (prompt: string, opts?: any) => Promise<{ content: string; tokens: number; latency: number; cost: number }>
      embedding?: (text: string) => Promise<number[]>
    }
  }
  registry: {
    getPrompt: (template: string, variables: Record<string, unknown>) => string
    getConfig: (key: string) => string | undefined
  }
}

// ─── Sprint 1B: Agent Input/Output Types ───

export interface ClaimGenerationInput {
  entities: Entity[]
  relations: EntityRelation[]
  config?: {
    maxClaimsPerEntity?: number
    minConfidence?: number
    sourceTypes?: string[]
  }
}

export interface EvidenceGatheringInput {
  claims: Claim[]
  config?: {
    maxSourcesPerClaim?: number
    minCredibilityScore?: number
    sourceTypes?: string[]
  }
}

export interface FAQGenerationInput {
  entities: Entity[]
  claims: Claim[]
  config?: {
    maxFAQPerEntity?: number
    schemaType?: string
  }
}

export interface SchemaGenerationInput {
  entities: Entity[]
  faqs: FAQ[]
  config?: {
    schemaTypes?: string[]
    includeClaims?: boolean
  }
}

// ─── Agent Input/Output Types (Sprint 1A) ───

export interface ResearchInput {
  topic: string
  config?: {
    language?: string
    industry?: string
    depth?: 'basic' | 'medium' | 'deep'
  }
}

export interface ResearchOutput {
  primaryTopic: string
  secondaryTopics: string[]
  intent?: string
  audience?: string
  questions: string[]
  competitors: string[]
  keywords: string[]
}

export interface EntityDiscoveryInput {
  research: ResearchOutput
  config?: {
    maxEntities?: number
    types?: EntityType[]
  }
}

export interface EntityDiscoveryOutput {
  entities: Array<Omit<Entity, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'provenance'> & { provenance?: ProvenanceRecord }>
  relations: Array<Omit<EntityRelation, 'id' | 'projectId' | 'createdAt' | 'lineage'> & { lineage?: LineageRecord }>
}

export interface GraphBuildInput {
  entities: Entity[]
  relations: EntityRelation[]
}

export interface GraphBuildOutput {
  graph: KnowledgeGraph
}

// ════════════════════════════════════════════════════════════
// P3: Publishing Plane — Contracts (Frozen 2026-07-19)
// ════════════════════════════════════════════════════════════
// Freeze Rules:
//   FR-1: Core object is PublishableClaim, not Action
//   FR-2: PublishingRecord records Version + Source Claims, not files
//   FR-3: ChannelAdapter has uniform interface (render/validate/preview/export)

// ─── PublishableClaim ───

export enum ClaimContentType {
  AboutPage = 'about_page',
  FAQEntry = 'faq_entry',
  SchemaEntity = 'schema_entity',
  PressRelease = 'press_release',
  KnowledgeArticle = 'knowledge_article',
}

export enum ClaimStatus {
  Draft = 'draft',
  Ready = 'ready',
  Published = 'published',
}

export interface PublishableClaim {
  id: string
  projectId: string
  verificationId: string
  sourceActionId: string

  title: string
  contentType: ClaimContentType
  content: string           // Markdown body
  status: ClaimStatus
  version: string           // semantic version

  createdAt: string
  updatedAt: string
}

// ─── PublishPlan ───

export enum PlanStatus {
  Draft = 'draft',
  InReview = 'in_review',
  Approved = 'approved',
  Published = 'published',
  RolledBack = 'rolled_back',
}

export interface PublishPlan {
  id: string
  projectId: string
  title: string
  claimIds: string[]
  targetChannels: string[]
  executionOrder?: string   // JSON: dependency graph of claimIds
  status: PlanStatus

  createdAt: string
  updatedAt: string
  publishedAt?: string
}

// ─── PublishingRecord ───

export interface PublishingRecord {
  id: string
  planId: string
  claimId: string
  channel: string
  version: string            // semantic version
  artifactHash: string       // content fingerprint
  artifactUrl?: string       // optional: URL to published result
  status: 'pending' | 'published' | 'failed' | 'rolled_back'
  publishedAt?: string

  createdAt: string
}

// ─── Channel & Adapter ───

export interface Artifact {
  format: string              // 'markdown' | 'html' | 'jsonld' | etc.
  content: string             // rendered content
  metadata: Record<string, unknown>
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface ChannelAdapter {
  readonly name: string
  readonly formats: string[]

  render(claim: PublishableClaim): Artifact
  validate(artifact: Artifact): ValidationResult
  preview(artifact: Artifact): string
  export(artifact: Artifact): Buffer | string
}

// ─── API DTOs ───

export interface CreateClaimDTO {
  projectId: string
  verificationId: string
  sourceActionId: string
  title: string
  contentType: ClaimContentType
  content: string
}

export interface CreatePlanDTO {
  projectId: string
  title: string
  claimIds: string[]
  targetChannels: string[]
  executionOrder?: string
}

export interface UpdatePlanStatusDTO {
  status: PlanStatus
}

export interface PublishingSummary {
  totalPlans: number
  draftCount: number
  inReviewCount: number
  approvedCount: number
  publishedCount: number
  channelBreakdown: Array<{ channel: string; count: number }>
}
