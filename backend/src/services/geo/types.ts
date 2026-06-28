// ============================================================
// GEO Core Types — KMKI-GEO V1 Spec Chapter 6
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

// ─── Core Domain Types ───

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

// ─── Agent Input/Output Types ───

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
