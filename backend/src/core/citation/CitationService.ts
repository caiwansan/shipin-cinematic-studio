// ============================================================
// Citation Service — Platform-level business logic for Citations
// ============================================================

import { citationRepository } from './CitationRepository'
import type { Citation, CreateCitationInput, UpdateCitationInput, SearchCitationsParams } from './types'

export const citationService = {
  /**
   * Create a citation with default provenance.
   */
  async create(input: CreateCitationInput): Promise<Citation> {
    return citationRepository.create({
      evidenceId: input.evidenceId,
      format: input.format || 'custom',
      citationText: input.citationText,
      sourceUrl: input.sourceUrl,
      publisher: input.publisher,
      author: input.author,
      datePublished: input.datePublished,
      authorityLevel: input.authorityLevel,
      provenance: {
        source: 'core.citation',
        action: 'created',
        actor: 'service:core.citation',
        reason: `Citation for evidence ${input.evidenceId}`,
      },
      metadata: input.metadata,
    })
  },

  /**
   * Find a citation by ID.
   */
  async findById(id: string): Promise<Citation | null> {
    return citationRepository.findById(id)
  },

  /**
   * Find all citations for a given evidence ID.
   */
  async findByEvidenceId(evidenceId: string): Promise<Citation[]> {
    return citationRepository.findByEvidenceId(evidenceId)
  },

  /**
   * Alias for findByEvidenceId.
   */
  async listByEvidence(evidenceId: string): Promise<Citation[]> {
    return citationRepository.findByEvidenceId(evidenceId)
  },

  /**
   * Update a citation.
   */
  async update(id: string, data: UpdateCitationInput): Promise<Citation | null> {
    return citationRepository.update(id, data)
  },

  /**
   * Delete a citation.
   */
  async delete(id: string): Promise<boolean> {
    return citationRepository.delete(id)
  },

  /**
   * Search citations with filters and full-text search.
   */
  async search(params: SearchCitationsParams): Promise<{ items: Citation[]; total: number }> {
    return citationRepository.search(params)
  },

  /**
   * Bulk import citations. Each citation will have its own provenance.
   */
  async importCitations(citations: CreateCitationInput[]): Promise<Citation[]> {
    const results: Citation[] = []
    for (const input of citations) {
      const citation = await citationRepository.create({
        evidenceId: input.evidenceId,
        format: input.format || 'custom',
        citationText: input.citationText,
        sourceUrl: input.sourceUrl,
        publisher: input.publisher,
        author: input.author,
        datePublished: input.datePublished,
        authorityLevel: input.authorityLevel,
        provenance: {
          source: 'core.citation',
          action: 'imported',
          actor: 'service:core.citation',
          reason: `Bulk import for evidence ${input.evidenceId}`,
        },
        metadata: input.metadata,
      })
      results.push(citation)
    }
    return results
  },

  /**
   * Export all citations for a given evidence ID.
   */
  async exportCitations(evidenceId: string): Promise<Citation[]> {
    return citationRepository.findByEvidenceId(evidenceId)
  },
}
