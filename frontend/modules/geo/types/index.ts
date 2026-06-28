// ============================================================
// GEO Frontend Types — KMKI-GEO V1
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
  timestamp: string
  reason?: string
  previousVersionId?: string
}

export interface LineageRecord {
  outputType: string
  outputSegment: string
  tracePath: string[]
}

// ─── Domain Models ───

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

export interface GraphNodeDetail {
  node: Entity
  edges: EntityRelation[]
}

export interface ProvenanceChain {
  current: Entity
  provenanceChain: Array<{
    action: string
    actor: string
    timestamp: string
    reason?: string
    source: string
  }>
}

export interface PipelineStep {
  key: string
  label: string
  status: 'pending' | 'active' | 'completed' | 'error'
  icon: string
}

export const PIPELINE_STEPS: PipelineStep[] = [
  { key: 'topic_research', label: '主题研究', status: 'pending', icon: '🔍' },
  { key: 'entity_discovery', label: '实体发现', status: 'pending', icon: '🧩' },
  { key: 'knowledge_graph', label: '知识图谱', status: 'pending', icon: '🕸️' },
  { key: 'review', label: '审核', status: 'pending', icon: '✅' },
  { key: 'publish', label: '发布', status: 'pending', icon: '🚀' },
]
