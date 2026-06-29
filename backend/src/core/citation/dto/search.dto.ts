// ============================================================
// SearchCitationsRequest DTO
// ============================================================

import type { AuthorityLevel } from '../types'

export interface SearchCitationsQuery {
  evidenceId?: string
  authorityLevel?: AuthorityLevel
  q?: string
  limit?: number
  offset?: number
}
