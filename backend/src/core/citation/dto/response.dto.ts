// ============================================================
// CitationResponse DTO
// ============================================================

import type { Citation } from '../types'

export interface CitationResponse {
  id: string
  evidenceId: string
  format: string
  citationText: string
  sourceUrl?: string
  publisher?: string
  author?: string
  datePublished?: string
  authorityLevel: string
  provenance: Record<string, unknown>
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface PaginatedCitationResponse {
  items: CitationResponse[]
  total: number
  limit: number
  offset: number
}
