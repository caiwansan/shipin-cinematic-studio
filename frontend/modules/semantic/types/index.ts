// ============================================================
// Semantic Module — Type Definitions (Frontend)
// ============================================================

export type EntityType =
  | 'Brand' | 'Company' | 'Organization' | 'Person'
  | 'Product' | 'Service' | 'Feature' | 'Capability'
  | 'Workflow' | 'Prompt' | 'API' | 'Document'
  | 'Technology' | 'Concept' | 'Location' | 'Event'

export type RelationType =
  | 'is_a' | 'part_of' | 'related_to' | 'belongs_to'
  | 'mentions' | 'references' | 'depends_on' | 'requires'
  | 'produces' | 'consumes' | 'leads_to' | 'alternative' | 'synonym'

export interface SemanticEntity {
  id: string
  projectId: string
  assetId: string | null
  type: string
  name: string
  description: string | null
  confidence: number
  metadata: string | null
  schemaVersion: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  aliases?: SemanticAlias[]
  topics?: { entityId: string; topicId: string; topic: SemanticTopic }[]
  sourceKeywords?: SemanticKeyword[]
}

export interface SemanticTopic {
  id: string
  projectId: string
  name: string
  description: string | null
  confidence: number
  metadata: string | null
  schemaVersion: number
  createdAt: string
  updatedAt: string
  entities?: { entityId: string; topicId: string; entity: SemanticEntity }[]
}

export interface SemanticRelation {
  id: string
  projectId: string
  fromEntityId: string | null
  fromTopicId: string | null
  toEntityId: string | null
  toTopicId: string | null
  relation: string
  confidence: number
  metadata: string | null
  schemaVersion: number
  createdAt: string
}

export interface SemanticAlias {
  id: string
  entityId: string
  alias: string
  language: string
  confidence: number
  entity?: SemanticEntity
}

export interface SemanticTaxonomy {
  id: string
  projectId: string
  name: string
  parentId: string | null
  description: string | null
  path: string | null
  depth: number
  metadata: string | null
  schemaVersion: number
  createdAt: string
  updatedAt: string
  parent?: SemanticTaxonomy | null
  children?: SemanticTaxonomy[]
}

export interface SemanticKeyword {
  id: string
  projectId: string
  keyword: string
  entityId: string | null
  language: string
  confidence: number
  metadata: string | null
  schemaVersion: number
  createdAt: string
  entity?: SemanticEntity | null
}

export interface EntityFilter {
  type?: string
  name?: string
  search?: string
  confidenceMin?: number
  limit?: number
  offset?: number
}

export interface TopicFilter {
  name?: string
  search?: string
  limit?: number
  offset?: number
}

export interface TaxonomyFilter {
  name?: string
  parentId?: string | null
  search?: string
  limit?: number
  offset?: number
}

export interface SemanticStats {
  entityCount: number
  topicCount: number
  relationCount: number
  aliasCount: number
  taxonomyCount: number
  keywordCount: number
}
