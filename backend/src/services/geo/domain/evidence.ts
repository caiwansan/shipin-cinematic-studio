// ============================================================
// Evidence — 统一的证据领域对象
// 从 Discovery 到 Verification 到 Learning，共用同一模型
// ============================================================

export interface GeoEvidence {
  id: string
  projectId: string
  entityId: string
  source: string
  claim: string
  supportLevel: 'strong' | 'partial' | 'conflicting' | 'none'
  confidence: number
  citations: GeoCitation[]
  createdAt: string
}

export interface GeoCitation {
  url: string
  title?: string
  snippet: string
  relevanceScore: number
}

export interface GeoConfidence {
  overall: number // 0-100
  entity: number
  presence: number
  knowledge: number
  evidence: number
}
