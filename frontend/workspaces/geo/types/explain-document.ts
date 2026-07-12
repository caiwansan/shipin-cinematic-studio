// ============================================================
// ExplainDocument — Frontend Canonical Type
// RC1-T004: Explain Everywhere
//
// Mirrors the backend ExplainDocument type for frontend consumption.
// This is the ONLY explain model used on the frontend.
// DO NOT import ExplainResult (deprecated).
// ============================================================

export type ExplainSectionType =
  | 'evidence'
  | 'threshold'
  | 'impact'
  | 'rule'
  | 'reasoning'
  | 'recommendation'
  | 'metric'
  | 'timeline'

export interface ExplainItem {
  id: string
  label: string
  value: string | number | boolean | null
  detail?: string
  source?: string
  confidence?: number
  status?: 'positive' | 'negative' | 'neutral' | 'action_required'
}

export interface ExplainSection {
  type: ExplainSectionType
  title: string
  order: number
  items: ExplainItem[]
}

export interface ExplainMetadata {
  type: 'mission' | 'verification' | 'knowledge' | 'discovery'
  sourceId: string
  sourceType: string
  generatedAt: string
  provider: string
  version: string
}

export interface ExplainDocument {
  id: string
  title: string
  summary: string
  sections: ExplainSection[]
  confidence: number | null
  metadata: ExplainMetadata
}
