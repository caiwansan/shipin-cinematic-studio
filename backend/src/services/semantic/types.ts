// ============================================================
// Semantic Runtime — Type Definitions
// Platform-level types for Entity, Topic, Taxonomy, Alias, Keyword
// ============================================================

/** Entity types supported by the Semantic Runtime */
export enum EntityType {
  Brand = 'Brand',
  Company = 'Company',
  Organization = 'Organization',
  Person = 'Person',
  Product = 'Product',
  Service = 'Service',
  Feature = 'Feature',
  Capability = 'Capability',
  Workflow = 'Workflow',
  Prompt = 'Prompt',
  API = 'API',
  Document = 'Document',
  Technology = 'Technology',
  Concept = 'Concept',
  Location = 'Location',
  Event = 'Event',
}

/** Relation types between semantic entities */
export enum RelationType {
  IsA = 'is_a',
  PartOf = 'part_of',
  RelatedTo = 'related_to',
  BelongsTo = 'belongs_to',
  Mentions = 'mentions',
  References = 'references',
  DependsOn = 'depends_on',
  Requires = 'requires',
  Produces = 'produces',
  Consumes = 'consumes',
  LeadsTo = 'leads_to',
  Alternative = 'alternative',
  Synonym = 'synonym',
}

/** Semantic entity interface */
export interface SemanticEntityData {
  id?: string
  projectId: string
  assetId?: string
  type: string
  name: string
  description?: string
  confidence?: number
  metadata?: Record<string, unknown>
  schemaVersion?: number
}

/** Semantic topic interface */
export interface SemanticTopicData {
  id?: string
  projectId: string
  name: string
  description?: string
  confidence?: number
  metadata?: Record<string, unknown>
  schemaVersion?: number
}

/** Semantic relation interface */
export interface SemanticRelationData {
  id?: string
  projectId: string
  fromEntityId?: string
  fromTopicId?: string
  toEntityId?: string
  toTopicId?: string
  relation: string
  confidence?: number
  metadata?: Record<string, unknown>
  schemaVersion?: number
}

/** Semantic alias interface */
export interface SemanticAliasData {
  id?: string
  entityId: string
  alias: string
  language?: string
  confidence?: number
}

/** Semantic taxonomy node interface */
export interface SemanticTaxonomyData {
  id?: string
  projectId: string
  name: string
  parentId?: string
  description?: string
  path?: string
  depth?: number
  metadata?: Record<string, unknown>
  schemaVersion?: number
}

/** Semantic keyword interface */
export interface SemanticKeywordData {
  id?: string
  projectId: string
  keyword: string
  entityId?: string
  language?: string
  confidence?: number
  metadata?: Record<string, unknown>
  schemaVersion?: number
}

/** Entity filter for search */
export interface EntityFilter {
  projectId: string
  type?: string
  name?: string
  search?: string
  confidenceMin?: number
  limit?: number
  offset?: number
}

/** Topic filter */
export interface TopicFilter {
  projectId: string
  name?: string
  search?: string
  limit?: number
  offset?: number
}

/** Relation filter */
export interface RelationFilter {
  projectId: string
  relation?: string
  fromEntityId?: string
  toEntityId?: string
  fromTopicId?: string
  toTopicId?: string
  limit?: number
  offset?: number
}

/** Taxonomy filter */
export interface TaxonomyFilter {
  projectId: string
  name?: string
  parentId?: string | null
  search?: string
  limit?: number
  offset?: number
}

/** Keyword filter */
export interface KeywordFilter {
  projectId: string
  keyword?: string
  language?: string
  entityId?: string
  search?: string
  limit?: number
  offset?: number
}

/** Pipeline configuration */
export interface SemanticPipelineConfig {
  chunkSize?: number // Max characters per chunk
  confidenceThreshold?: number // Minimum confidence for auto-accept
  maxKeywords?: number // Max keywords per entity
  maxTopics?: number // Max topics per extraction
  enabledExtractors?: string[] // Which extractors to run
  skipExisting?: boolean // Skip entities already resolved
}

export const DEFAULT_PIPELINE_CONFIG: SemanticPipelineConfig = {
  chunkSize: 5000,
  confidenceThreshold: 0.3,
  maxKeywords: 20,
  maxTopics: 10,
  skipExisting: false,
}

/** Chunk of content from an asset */
export interface ContentChunk {
  index: number
  text: string
  sourceUrl?: string
  metadata?: Record<string, unknown>
}

/** Input for chunking/pipeline operations */
export interface ChunkInput {
  content: string
  sourceUrl?: string
  metadata?: Record<string, unknown>
}

/** Extractor result */
export interface ExtractionResult {
  entities: Array<{
    type: string
    name: string
    confidence: number
    description?: string
  }>
  topics: Array<{
    name: string
    confidence: number
    description?: string
  }>
  keywords: Array<{
    keyword: string
    confidence: number
  }>
  relations: Array<{
    fromName: string
    toName: string
    relation: string
    confidence: number
  }>
}

/** Runtime event types */
export type SemanticEventType =
  | 'entity:created'
  | 'entity:updated'
  | 'entity:deleted'
  | 'topic:built'
  | 'topic:updated'
  | 'taxonomy:updated'
  | 'relation:created'
  | 'relation:deleted'
  | 'extraction:completed'
  | 'rebuild:completed'

export interface SemanticEvent {
  type: SemanticEventType
  projectId: string
  entityId?: string
  topicId?: string
  relationId?: string
  timestamp: Date
  data?: Record<string, unknown>
}
