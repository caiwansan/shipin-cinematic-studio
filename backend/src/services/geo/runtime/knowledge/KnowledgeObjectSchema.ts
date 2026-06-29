// KMKI-RUNTIME-012 — Knowledge Object Schema (V1)
// 所有 Agent 消费的唯一知识载体

export type KOStatus = 'DISCOVERED' | 'ENRICHING' | 'VERIFIED' | 'PUBLISHED' | 'ARCHIVED'

export interface EntitySnapshot {
  id: string
  name: string
  type: string
  description?: string
  metadata?: Record<string, unknown>
}

export interface RelationSnapshot {
  id: string
  sourceId: string
  targetId: string
  type: string
  metadata?: Record<string, unknown>
}

export interface ClaimSnapshot {
  id: string
  statement: string
  entityId: string
  confidence?: number
  metadata?: Record<string, unknown>
}

export interface EvidenceSnapshot {
  id: string
  content: string
  sourceUrl?: string
  claimId?: string
  reliability?: number
  metadata?: Record<string, unknown>
}

export interface CitationSnapshot {
  id: string
  sourceUrl: string
  title?: string
  snippet?: string
  claimId?: string
  metadata?: Record<string, unknown>
}

export interface KOProvenance {
  provider: string
  model: string
  promptVersion: string
  traceId: string
  runtimeVersion: string
}

export interface KnowledgeObjectData {
  id: string
  projectId: string
  workflowId?: string | null
  topic?: string | null
  status: KOStatus
  confidence?: number | null
  qualityScore?: number | null
  provenance?: KOProvenance | null
  entities: EntitySnapshot[]
  relations: RelationSnapshot[]
  claims: ClaimSnapshot[]
  evidence: EvidenceSnapshot[]
  citations: CitationSnapshot[]
  createdAt: string
  updatedAt: string
}

export function emptyKnowledgeObject(projectId: string): Omit<KnowledgeObjectData, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    projectId,
    status: 'DISCOVERED',
    entities: [],
    relations: [],
    claims: [],
    evidence: [],
    citations: [],
  }
}
