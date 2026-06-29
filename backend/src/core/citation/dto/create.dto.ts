// ============================================================
// CreateCitationRequest DTO
// ============================================================

import type { AuthorityLevel } from '../types'

export interface CreateCitationRequest {
  evidenceId: string
  format?: 'apa' | 'mla' | 'custom'
  citationText: string
  sourceUrl?: string
  publisher?: string
  author?: string
  datePublished?: string
  authorityLevel?: AuthorityLevel
  metadata?: Record<string, unknown>
}
