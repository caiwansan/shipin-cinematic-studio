// ============================================================
// GEO Claim Service — Sprint 1B Knowledge Quality
// ============================================================

import { geoClaimRepository } from '../repositories/geo-claim.repository'
import type { Claim, AgentOutput } from '../types'
import { createProvenanceRecord } from '../types'

export const geoClaimService = {
  /**
   * Create a new claim linked to an entity.
   */
  async create(data: {
    entityId: string
    text: string
    claimType?: string
    confidence?: number
    sourceType?: string
    metadata?: Record<string, unknown>
  }): Promise<Claim> {
    return geoClaimRepository.create({
      entityId: data.entityId,
      text: data.text,
      claimType: data.claimType || 'fact',
      confidence: data.confidence ?? 0.0,
      sourceType: data.sourceType || 'llm_extracted',
      provenance: createProvenanceRecord({
        source: 'geo.claim',
        action: 'created',
        actor: 'service:geo.claim',
        reason: `Claim for entity ${data.entityId}`,
      }),
      metadata: data.metadata,
    })
  },

  /**
   * Bulk create claims from agent output.
   */
  async createFromAgentOutput(entityId: string, agentOutput: AgentOutput<any>): Promise<Claim[]> {
    const claims: Claim[] = []
    for (const item of agentOutput.data) {
      const claim = await geoClaimRepository.create({
        entityId,
        text: item.text || item,
        claimType: item.claimType || 'fact',
        confidence: item.confidence ?? agentOutput.confidence,
        sourceType: 'llm_extracted',
        provenance: {
          ...agentOutput.provenance,
          diagnostics: agentOutput.diagnostics,
        },
      })
      claims.push(claim)
    }
    return claims
  },

  /**
   * Get a single claim by ID.
   */
  async getById(id: string): Promise<Claim | null> {
    return geoClaimRepository.findById(id)
  },

  /**
   * List all claims for an entity.
   */
  async listByEntity(entityId: string): Promise<Claim[]> {
    return geoClaimRepository.findByEntityId(entityId)
  },

  /**
   * List all claims for a project (via entity linkage).
   */
  async listByProject(projectId: string): Promise<Claim[]> {
    return geoClaimRepository.listByProjectId(projectId)
  },

  /**
   * Update a claim.
   */
  async update(id: string, data: Partial<Claim>): Promise<Claim | null> {
    return geoClaimRepository.update(id, data)
  },

  /**
   * Delete a claim.
   */
  async delete(id: string): Promise<boolean> {
    return geoClaimRepository.delete(id)
  },

  /**
   * Get claims filtered by quality threshold.
   */
  async findByQuality(projectId: string, minConfidence: number): Promise<Claim[]> {
    const all = await geoClaimRepository.listByProjectId(projectId)
    return all.filter((c) => c.confidence >= minConfidence)
  },

  /**
   * Get claim count for an entity.
   */
  async countByEntity(entityId: string): Promise<number> {
    return geoClaimRepository.countByEntityId(entityId)
  },
}
