// ============================================================
// GEO Citation Adapter — GEO-specific bridge to core/citation
// ============================================================
// Adapter responsibilities:
//   - Add GEO-specific tenantId context
//   - Proxy requests to core/citation
//   - No citation business logic here
// ============================================================

import { citationService, type CreateCitationInput, type UpdateCitationInput, type SearchCitationsParams } from '../../../../core/citation/index'
import type { Citation } from '../../../../core/citation/types'

/**
 * GEO Citation Adapter: wraps core citationService with GEO tenant context.
 */
export const geoCitationAdapter = {
  async create(input: CreateCitationInput, tenantId?: string): Promise<Citation> {
    return citationService.create({
      ...input,
    })
  },

  async findById(id: string): Promise<Citation | null> {
    return citationService.findById(id)
  },

  async findByEvidenceId(evidenceId: string): Promise<Citation[]> {
    return citationService.findByEvidenceId(evidenceId)
  },

  async update(id: string, data: UpdateCitationInput): Promise<Citation | null> {
    return citationService.update(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return citationService.delete(id)
  },

  async search(params: SearchCitationsParams): Promise<{ items: Citation[]; total: number }> {
    return citationService.search(params)
  },

  async listByEvidence(evidenceId: string): Promise<Citation[]> {
    return citationService.listByEvidence(evidenceId)
  },

  async importCitations(citations: CreateCitationInput[]): Promise<Citation[]> {
    return citationService.importCitations(citations)
  },

  async exportCitations(evidenceId: string): Promise<Citation[]> {
    return citationService.exportCitations(evidenceId)
  },
}
