// ============================================================
// Platform-level Citation Types
// ============================================================

export type AuthorityLevel = 'government' | 'academic' | 'industry' | 'news' | 'community'

export interface Citation {
  id: string
  evidenceId: string
  format: string
  citationText: string
  sourceUrl?: string
  publisher?: string
  author?: string
  datePublished?: string
  authorityLevel: AuthorityLevel
  tenantId?: string
  provenance: Record<string, unknown>
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface CitationProvenance {
  source: string
  action: string
  actor: string
  reason: string
  diagnostics?: Record<string, unknown>
  timestamp?: string
}

export interface CreateCitationInput {
  evidenceId: string
  format?: string
  citationText: string
  sourceUrl?: string
  publisher?: string
  author?: string
  datePublished?: string
  authorityLevel?: AuthorityLevel
  metadata?: Record<string, unknown>
}

export interface UpdateCitationInput {
  format?: string
  citationText?: string
  sourceUrl?: string
  publisher?: string
  author?: string
  datePublished?: string
  authorityLevel?: AuthorityLevel
  metadata?: Record<string, unknown>
}

export interface SearchCitationsParams {
  evidenceId?: string
  tenantId?: string
  authorityLevel?: AuthorityLevel
  q?: string
  limit?: number
  offset?: number
}
