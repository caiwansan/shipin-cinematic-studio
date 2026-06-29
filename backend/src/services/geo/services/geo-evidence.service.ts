// ============================================================
// GEO Evidence Service — Sprint 1B Knowledge Quality
// ============================================================

import { geoEvidenceRepository } from '../repositories/geo-evidence.repository'
import type { Evidence, AgentOutput } from '../types'
import { createProvenanceRecord } from '../types'

export const geoEvidenceService = {
  /**
   * Create a new evidence entry for a claim.
   */
  async create(data: {
    claimId: string
    source: string
    content: string
    credibilityScore?: number
    verificationMethod?: string
    metadata?: Record<string, unknown>
  }): Promise<Evidence> {
    return geoEvidenceRepository.create({
      claimId: data.claimId,
      source: data.source,
      content: data.content,
      credibilityScore: data.credibilityScore ?? 0.0,
      verificationMethod: data.verificationMethod,
      provenance: createProvenanceRecord({
        source: 'geo.evidence',
        action: 'created',
        actor: 'service:geo.evidence',
        reason: `Evidence for claim ${data.claimId}`,
      }),
      metadata: data.metadata,
    })
  },

  /**
   * Bulk create evidences from agent output.
   */
  async createFromAgentOutput(claimId: string, agentOutput: AgentOutput<any>): Promise<Evidence[]> {
    const evidences: Evidence[] = []
    for (const item of agentOutput.data) {
      const evidence = await geoEvidenceRepository.create({
        claimId,
        source: item.source || '',
        content: item.content || '',
        credibilityScore: item.credibilityScore ?? agentOutput.confidence,
        verificationMethod: item.verificationMethod,
        provenance: {
          ...agentOutput.provenance,
          diagnostics: agentOutput.diagnostics,
        },
      })
      evidences.push(evidence)
    }
    return evidences
  },

  /**
   * Get all evidence for a claim.
   */
  async listByClaim(claimId: string): Promise<Evidence[]> {
    return geoEvidenceRepository.findByClaimId(claimId)
  },

  /**
   * Get aggregate credibility metrics for a project.
   */
  async getProjectCredibilityMetrics(projectId: string): Promise<{
    averageScore: number
    totalCount: number
  }> {
    const avgScore = await geoEvidenceRepository.averageCredibilityByProjectId(projectId)
    const all = await geoEvidenceRepository.listByProjectId(projectId)
    return { averageScore: avgScore, totalCount: all.length }
  },

  /**
   * Get average credibility across a project.
   */
  async getAverageCredibility(projectId: string): Promise<number> {
    return geoEvidenceRepository.averageCredibilityByProjectId(projectId)
  },

  /**
   * Delete an evidence entry.
   */
  async delete(id: string): Promise<boolean> {
    return geoEvidenceRepository.delete(id)
  },
}
