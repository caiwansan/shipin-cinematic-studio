// ============================================================
// GEO Citation Service — Sprint 1B Knowledge Quality
// ============================================================

import { geoCitationRepository } from '../repositories/geo-citation.repository'
import type { Citation, Evidence, AgentOutput } from '../types'
import { createProvenanceRecord } from '../types'

export const geoCitationService = {
  /**
   * Create a citation for an evidence entry with auto-formatting.
   */
  async create(data: {
    evidenceId: string
    format?: string
    citationText: string
    sourceUrl?: string
    publisher?: string
    author?: string
    datePublished?: string
    authorityLevel?: string
    metadata?: Record<string, unknown>
  }): Promise<Citation> {
    return geoCitationRepository.create({
      evidenceId: data.evidenceId,
      format: data.format || 'custom',
      citationText: data.citationText,
      sourceUrl: data.sourceUrl,
      publisher: data.publisher,
      author: data.author,
      datePublished: data.datePublished,
      authorityLevel: data.authorityLevel,
      provenance: createProvenanceRecord({
        source: 'geo.citation',
        action: 'created',
        actor: 'service:geo.citation',
        reason: `Citation for evidence ${data.evidenceId}`,
      }),
      metadata: data.metadata,
    })
  },

  /**
   * Generate a formatted citation from evidence data and source metadata.
   */
  format(evidence: Evidence, format: string = 'custom'): string {
    const sourceParts: string[] = []
    const datePart = evidence.collectedAt
      ? new Date(evidence.collectedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : ''

    switch (format) {
      case 'apa':
        if (evidence.metadata?.author) sourceParts.push(`${evidence.metadata.author}.`)
        sourceParts.push(`(${datePart}).`)
        sourceParts.push(`${evidence.metadata?.title || evidence.source}.`)
        if (evidence.metadata?.publisher) sourceParts.push(evidence.metadata.publisher as string)
        if (evidence.metadata?.url) sourceParts.push(evidence.metadata.url as string)
        break

      case 'mla':
        if (evidence.metadata?.author) sourceParts.push(`${evidence.metadata.author}.`)
        sourceParts.push(`"${evidence.metadata?.title || evidence.source}."`)
        if (evidence.metadata?.publisher) sourceParts.push(evidence.metadata.publisher as string)
        sourceParts.push(datePart)
        if (evidence.metadata?.url) sourceParts.push(evidence.metadata.url as string)
        break

      case 'custom':
      default:
        sourceParts.push(evidence.content || evidence.source)
        if (evidence.metadata?.url) sourceParts.push(`Source: ${evidence.metadata.url}`)
        break
    }

    return sourceParts.join(' ')
  },

  /**
   * Bulk create citations from agent output.
   */
  async createFromAgentOutput(evidenceId: string, agentOutput: AgentOutput<any>): Promise<Citation[]> {
    const citations: Citation[] = []
    for (const item of agentOutput.data) {
      const citation = await geoCitationRepository.create({
        evidenceId,
        format: item.format || 'custom',
        citationText: item.citationText || '',
        sourceUrl: item.sourceUrl,
        publisher: item.publisher,
        author: item.author,
        datePublished: item.datePublished,
        authorityLevel: item.authorityLevel,
        provenance: {
          ...agentOutput.provenance,
          diagnostics: agentOutput.diagnostics,
        },
      })
      citations.push(citation)
    }
    return citations
  },

  /**
   * Get all citations for an evidence entry.
   */
  async listByEvidence(evidenceId: string): Promise<Citation[]> {
    return geoCitationRepository.findByEvidenceId(evidenceId)
  },
}
