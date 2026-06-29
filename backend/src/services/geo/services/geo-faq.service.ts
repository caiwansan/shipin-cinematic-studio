// ============================================================
// GEO FAQ Service — Sprint 1B Knowledge Quality
// ============================================================

import { geoFAQRepository } from '../repositories/geo-faq.repository'
import type { FAQ, AgentOutput } from '../types'
import { createProvenanceRecord } from '../types'

export const geoFAQService = {
  /**
   * Create a new FAQ entry linked to an entity.
   */
  async create(data: {
    entityId: string
    question: string
    answer: string
    schemaType?: string
    confidence?: number
    metadata?: Record<string, unknown>
  }): Promise<FAQ> {
    return geoFAQRepository.create({
      entityId: data.entityId,
      question: data.question,
      answer: data.answer,
      schemaType: data.schemaType || 'FAQPage',
      confidence: data.confidence ?? 0.0,
      provenance: createProvenanceRecord({
        source: 'geo.faq',
        action: 'created',
        actor: 'service:geo.faq',
        reason: `FAQ for entity ${data.entityId}`,
      }),
      metadata: data.metadata,
    })
  },

  /**
   * Bulk create FAQs from agent output.
   */
  async createFromAgentOutput(entityId: string, agentOutput: AgentOutput<any>): Promise<FAQ[]> {
    const faqs: FAQ[] = []
    for (const item of agentOutput.data) {
      const faq = await geoFAQRepository.create({
        entityId,
        question: item.question || '',
        answer: item.answer || '',
        schemaType: item.schemaType || 'FAQPage',
        confidence: item.confidence ?? agentOutput.confidence,
        provenance: {
          ...agentOutput.provenance,
          diagnostics: agentOutput.diagnostics,
        },
      })
      faqs.push(faq)
    }
    return faqs
  },

  /**
   * Get all FAQs for an entity.
   */
  async listByEntity(entityId: string): Promise<FAQ[]> {
    return geoFAQRepository.findByEntityId(entityId)
  },

  /**
   * List all FAQs for a project (via entity linkage).
   */
  async listByProject(projectId: string): Promise<FAQ[]> {
    return geoFAQRepository.listByProjectId(projectId)
  },

  /**
   * Get a single FAQ by ID.
   */
  async getById(id: string): Promise<FAQ | null> {
    return geoFAQRepository.findById(id)
  },

  /**
   * Delete a FAQ entry.
   */
  async delete(id: string): Promise<boolean> {
    return geoFAQRepository.delete(id)
  },
}
