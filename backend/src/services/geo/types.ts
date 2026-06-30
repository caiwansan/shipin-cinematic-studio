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

// ============================================================
// KDP (Knowledge Distribution Plane) — Sprint K1 Contracts
// ============================================================
// Frozen 2026-06-30 — Core object is KnowledgeAsset, not DistributionTask
// Distribution is transport, KnowledgeAsset is the substance.
// ============================================================

// ─── Contract K1-01: KnowledgeAsset ───
// The core domain object of KDP. Every piece of knowledge produced
// from PublishingRecord is a KnowledgeAsset.
// Must be consumable by both humans and AI systems.

export enum AssetType {
  Article = 'article',           // Human-readable content (HTML, MD)
  SchemaEntity = 'schema_entity', // Structured data (JSON-LD)
  EntityGraph = 'entity_graph',  // Entity relationship graph
  FactSheet = 'fact_sheet',      // Verified claims → fact statement
  ClaimGraph = 'claim_graph',    // Claim dependency graph
  BrandProfile = 'brand_profile', // Aggregated brand knowledge
  QAPack = 'qa_pack',            // FAQ → structured Q&A
  AIKnowledgeFeed = 'ai_knowledge_feed',  // AI-consumable summary
  AIManifest = 'ai_manifest',    // AI Crawl Manifest
}

export enum AssetStatus {
  Draft = 'draft',
  Ready = 'ready',
  Distributing = 'distributing',
  Distributed = 'distributed',
  Expired = 'expired',
}

export interface KnowledgeAsset {
  id: string
  projectId: string
  claimId: string           // ↔ PublishableClaim
  recordId: string          // ↔ PublishingRecord
  assetType: AssetType
  status: AssetStatus

  // Human Layer: rendered content for website / human readers
  humanContent: string      // HTML or Markdown
  // Search Layer: structured data for search engines
  searchContent: string     // JSON-LD or schema.org
  // AI Layer: knowledge representation for AI models
  aiContent: string         // JSON (EntityGraph, FactSheet, etc.)

  version: string           // Semantic version
  artifactHash: string      // Content fingerprint

  createdAt: string
  updatedAt: string
}

// ─── Contract K1-02: DistributionPlan ───
// A plan to distribute KnowledgeAssets to targets.
// Auto-created when KnowledgeAssets are ready, user approves.

export enum DistributionTarget {
  Website = 'website',
  RSS = 'rss',
  Sitemap = 'sitemap',
  RobotsTxt = 'robots_txt',
  KnowledgeFeed = 'knowledge_feed',
  AIManifest = 'ai_manifest',
}

export enum DistributionPlanStatus {
  Draft = 'draft',
  PendingReview = 'pending_review',
  Approved = 'approved',
  Distributing = 'distributing',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export interface DistributionPlan {
  id: string
  projectId: string
  title: string
  assetIds: string[]          // KnowledgeAsset IDs
  targets: DistributionTarget[]
  status: DistributionPlanStatus
  strategy: {
    incrementalOnly: boolean   // Only distribute changed/new assets
    forceFull: boolean         // Redistribute everything
    scheduleAt?: string        // ISO datetime for scheduled distribution
  }

  createdAt: string
  updatedAt: string
  approvedAt?: string
  completedAt?: string
}

// ─── Contract K1-03: DistributionAttempt ───
// Every distribution is a series of attempts, not a single event.
// This enables retry, rate-limit tracking, and full observability.

export enum AttemptStatus {
  Pending = 'pending',
  Preparing = 'preparing',
  Validating = 'validating',
  Packaging = 'packaging',
  Delivering = 'delivering',
  Success = 'success',
  Failed = 'failed',
}

export interface DistributionAttempt {
  id: string
  planId: string
  taskKey: string             // `${planId}:${adapterType}:${attemptNo}`
  adapterId: string
  attemptNo: number

  assetIds: string[]
  target: DistributionTarget

  status: AttemptStatus
  outputUrl?: string          // Where the artifact was placed
  artifactHash?: string       // Content fingerprint at delivery time
  durationMs?: number
  errorLog?: string

  startedAt: string
  finishedAt?: string
}

// ─── Contract K1-04: DistributionAdapter ───
// Adapter interface — each adapter implements:
//   prepare() → validate() → package() → deliver()

export enum AdapterType {
  Local = 'local',           // Generates artifact locally (sitemap, rss, etc.)
  External = 'external',     // Submits to external platform
}

export interface DistributionAdapter {
  id: string
  type: AdapterType
  name: string               // 'Sitemap Adapter', 'RSS Feed Adapter', etc.
  enabled: boolean
  config?: Record<string, unknown>  // e.g. { baseUrl, outputDir }
}

// Adapter Runtime Interface (implemented by each adapter)
export interface AdapterRuntime {
  prepare(assets: KnowledgeAsset[]): Promise<{ artifact: string; hash: string }>
  validate(artifact: string): Promise<{ valid: boolean; errors: string[] }>
  package(artifact: string, target: DistributionTarget): Promise<Blob>
  deliver(packaged: Blob, target: DistributionTarget): Promise<{ url: string; deliveredAt: string }>
}

// ─── Freeze Rules (permanent) ───

// FR-K6: KnowledgeAsset is the core domain object.
// DistributionTask is an implementation detail.
// Every API, every interface, every database model must be KnowledgeAsset-first.

// FR-K7: Every KnowledgeAsset must be consumable by both humans and AI systems.
// humanContent handles the human layer, aiContent handles the AI layer.
// searchContent handles the search engine layer.
// No asset is "complete" until all three are populated.

// FR-K8: KDP input is always PublishingRecord, never Claim.
// KDP processes already-published, already-versioned content only.

// FR-K9: KnowledgeAsset is immutable. Modification always produces a new version.
// No UPDATE on KnowledgeAsset. New asset = new version.
// This guarantees stable references for AI systems and knowledge graphs.

// ============================================================
// KDP — Sprint K2 (Knowledge Packaging) Contracts
// ============================================================
// Frozen 2026-06-30 — K2 Packaging Plane
// Core domain: KnowledgePackage (not Adapter)
// Packaging is a business capability, not a tool.
// ============================================================

// ─── Contract K2-01: KnowledgePackage ───
// The unit of distribution. Every KnowledgeAsset can be packaged
// into one or more KnowledgePackages for different targets.
// Package is immutable once created (FR-K9 applies by extension).

export enum PackageType {
  Website = 'website',           // Full HTML/MD for website deployment
  Sitemap = 'sitemap',           // sitemap.xml entry
  RSS = 'rss',                   // RSS/Atom feed entry
  AIFeed = 'ai_feed',            // AI-consumable knowledge feed
  KnowledgeBundle = 'knowledge_bundle', // Multi-asset aggregation
}

export enum PackageStatus {
  Draft = 'draft',
  Packaged = 'packaged',
  Validated = 'validated',
  Delivered = 'delivered',
  Failed = 'failed',
}

export interface KnowledgePackage {
  id: string
  assetId: string
  projectId: string
  packageType: PackageType
  status: PackageStatus

  /** Package manifest — describes what's inside */
  manifest: PackageManifest
  /** The actual payload (content body) */
  payload: string
  /** Content fingerprint for integrity verification */
  artifactHash: string
  /** Semantic version — aligned with source KnowledgeAsset */
  version: string

  createdAt: string
  updatedAt: string
}

// ─── Contract K2-02: PackageManifest ───
// Every Package has a manifest that describes its contents.
// This is what Delivery (K3+) consumes to decide where to send.

export interface PackageManifest {
  schemaVersion: string         // '2.0'

  // Source provenance
  source: {
    packageType: PackageType
    assetId: string
    claimId: string
    recordId: string
    projectId?: string
  }

  // Content metadata
  content: {
    title: string
    summary: string
    /** Estimated byte size */
    estimatedSize: number
    /** MIME type of the payload */
    mimeType: string
    /** Locale / language */
    language: string
  }

  // Delivery hints
  delivery: {
    /** Preferred delivery target(s) */
    preferredTargets: DistributionTarget[]
    /** Cache TTL in seconds */
    cacheTTL: number
    /** Whether this should trigger re-index notification */
    requiresIndexing: boolean
    /** Priority: high | normal | low */
    priority: 'high' | 'normal' | 'low'
  }

  // Validation
  validation: {
    contentHash: string
    signed: boolean
    timestamp: string
  }
}

// ─── Contract K2-03: PackagingAdapter ───
// Each PackageType has a PackagingAdapter that builds it.
// This replaces the old DistributionAdapter interface.
// Adapter = implementation detail, Package = business model.

export interface PackagingAdapter {
  /** Adapter identity */
  id: string
  type: string        // 'local' | 'external'
  name: string
  packageType: PackageType

  /** Build a KnowledgePackage from assets */
  build(assets: KnowledgeAsset[], bundleName?: string): Promise<KnowledgePackage[]>
  /** Validate the built package */
  validate(pkg: KnowledgePackage): Promise<{ valid: boolean; errors: string[] }>
  /** Generate a manifest for the package */
  manifest(pkg: KnowledgePackage): PackageManifest
  /** Preview the package (human-readable) */
  preview(pkg: KnowledgePackage): string
}

// ─── Freeze Rules (K2) ───

// FR-K10: KnowledgePackage is the unit of distribution.
// Delivery (K3+) consumes KnowledgePackage. Never feed raw Assets to Delivery.
// This ensures every delivery has a signed, validated, versioned manifest.

// ════════════════════════════════════════════════════════════
// KDP — Sprint K3 (Knowledge Delivery Runtime) Contracts
// ════════════════════════════════════════════════════════════
// Frozen 2026-07-01 — K3 Delivery Runtime
// Core principle: Delivery is a Runtime, not a Script.
// Runtime handles: Queue → Dispatch → Retry → Rollback → Verify
// K3 only: Local Delivery to sandbox/output/
// ════════════════════════════════════════════════════════════

// ─── Contract K3-01: DeliveryJob ───
// A job packages one or more KnowledgePackages for delivery.
// Jobs are created by the Runtime and tracked for retry/recovery.

export enum DeliveryJobStatus {
  Queued = 'queued',
  Dispatching = 'dispatching',
  Delivering = 'delivering',
  Verifying = 'verifying',
  Completed = 'completed',
  Failed = 'failed',
  RolledBack = 'rolled_back',
}

export enum DeliveryJobPriority {
  High = 'high',
  Normal = 'normal',
  Low = 'low',
}

export interface DeliveryJob {
  id: string
  projectId: string
  packageIds: string[]
  targetId: string                  // ↔ DeliveryTarget
  status: DeliveryJobStatus
  priority: DeliveryJobPriority
  retryCount: number
  maxRetries: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  errorLog?: string
}

// ─── Contract K3-02: DeliveryTarget ───
// A target is where packages are delivered.
// First version: 'local' (sandbox/output/)
// Future: 'website' | 'cms' | 'knowledge_base' | 'search_endpoint' | 'ai_endpoint'

export interface DeliveryTargetType {
  id: string
  type: string                      // 'local' | 'website' | 'cms' | 'knowledge_base' | 'search_endpoint' | 'ai_endpoint'
  name: string
  config: Record<string, any>       // Per-target configuration (outputPath, baseUrl, etc.)
  enabled: boolean
  createdAt: string
}

// ─── Contract K3-03: DeliveryRecord ───
// Every delivery produces a record. Append-only, never mutated.
// This is the audit trail for what was delivered, when, and its state.

export interface DeliveryRecord {
  id: string
  jobId: string
  packageId: string
  targetId: string
  status: DeliveryJobStatus

  /** File system path where the package was landed */
  outputPath: string
  /** Total bytes delivered */
  bytes: number
  /** Number of artifacts delivered */
  artifactCount: number
  /** Checksum of delivered content (for verification) */
  checksum: string
  /** Previous delivery state (for rollback) */
  previousState?: string

  startedAt: string
  finishedAt?: string
  durationMs?: number
  errorLog?: string
}

// ─── Contract K3-04: DeliveryAdapter ───
// Adapter for each target type.
// This is where deliver() finally appears — K1 through K2 were all prepare.

export interface DeliveryAdapter {
  id: string
  targetType: string
  name: string

  /** Prepare the target directory/connection */
  prepare(config: Record<string, any>): Promise<void>
  /** Deliver (write/copy/deploy) the package artifacts */
  deliver(jobId: string, pkg: KnowledgePackage, target: DeliveryTargetType, artifacts: PackageArtifact[]): Promise<DeliveryRecord>
  /** Verify the delivery was successful */
  verify(record: DeliveryRecord): Promise<{ valid: boolean; errors: string[] }>
  /** Rollback to previous state */
  rollback(record: DeliveryRecord): Promise<void>
}

// ─── Freeze Rules (K3) ───

// FR-K11: Delivery is a Runtime, not a Script.
// DeliveryRuntime handles Queue → Dispatch → Retry → Rollback → Verify.
// No manual delivery steps. All delivery goes through the Runtime.

// FR-K12: Delivery Runtime does not care about target platform type.
// It only cares about DeliveryTarget. Platform differences are handled by Adapters.
// New platforms = new Adapter, not new Runtime.

// FR-K13: K3 only supports Local Delivery (sandbox/output/).
// Real external platforms (Website, CMS, Knowledge Base, AI Endpoint) are K4+.
// K3 must freeze before any external Delivery Adapter is built.
