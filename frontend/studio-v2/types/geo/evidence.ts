// ============================================================
// GEO Evidence — Workflow Data Types (Sprint 3)
// ============================================================

export interface Evidence {
  id: string
  claimId: string
  source: string
  content: string
  credibilityScore: number
  verificationMethod: string
  citations: Citation[]
  createdAt: string
}

export interface Claim {
  id: string
  entityId: string
  text: string
  claimType: string
  confidence: number
  status: string
  evidences: Evidence[]
  createdAt: string
}

export interface HistoryEvent {
  id: string
  type: string
  description: string
  projectId: string
  timestamp: string
}

export interface Report {
  id: string
  projectId: string
  type: string
  title: string
  summary: string
  sections: ReportSection[]
  generatedAt: string
}

export interface ReportSection {
  title: string
  content: string
  type: string
}

// Citation from brand.ts — kept here for convenience
export interface Citation {
  id: string
  brandId: string
  sourceUrl: string
  sourceName: string
  sourceType: 'news' | 'social' | 'forum' | 'video' | 'review' | 'blog' | 'other'
  title: string
  snippet: string
  publishedAt: string
  sentiment: 'positive' | 'negative' | 'neutral'
  influenceScore: number
}
