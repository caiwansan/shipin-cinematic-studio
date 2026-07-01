// ============================================================
// GEO Quality Service — Sprint 1B Knowledge Quality
// ============================================================

import { geoQualityRepository } from '../repositories/geo-quality.repository'
import { geoClaimRepository } from '../repositories/geo-claim.repository'
import { geoEvidenceService } from './geo-evidence.service'
import { geoSchemaRepository } from '../repositories/geo-schema.repository'
import type { QualityScore } from '../types'

export const geoQualityService = {
  /**
   * Calculate the composite Knowledge Quality Score for a project.
   * Combines 4 dimensions: Authority, Coverage, Evidence, Schema.
   */
  async calculateCompositeScore(projectId: string): Promise<number> {
    const [authority, coverage, evidence, schema] = await Promise.all([
      this.calculateAuthorityScore(projectId),
      this.calculateCoverageScore(projectId),
      this.calculateEvidenceScore(projectId),
      this.calculateSchemaScore(projectId),
    ])

    // Weighted composite: Authority 30%, Coverage 25%, Evidence 25%, Schema 20%
    const composite = authority * 0.3 + coverage * 0.25 + evidence * 0.25 + schema * 0.2

    // Store composite score
    await geoQualityRepository.create({
      projectId,
      dimension: 'composite',
      score: composite,
      breakdown: { authority, coverage, evidence, schema },
    })

    return composite
  },

  /**
   * Authority Score: Based on claim confidence + evidence credibility + citation authority levels.
   */
  async calculateAuthorityScore(projectId: string): Promise<number> {
    const claims = await geoClaimRepository.listByProjectId(projectId)
    if (claims.length === 0) return 0

    const avgClaimConfidence = claims.reduce((s, c) => s + c.confidence, 0) / claims.length

    // Get average evidence credibility
    const avgCredibility = await geoEvidenceService.getAverageCredibility(projectId)

    return (avgClaimConfidence + avgCredibility) / 2
  },

  /**
   * Coverage Score: What percentage of entities have claims.
   */
  async calculateCoverageScore(projectId: string): Promise<number> {
    // Count entities with at least one claim
    const allClaims = await geoClaimRepository.listByProjectId(projectId)
    const entitiesWithClaims = new Set(allClaims.map((c) => c.entityId)).size

    // Get total entity count from project via repository
    const { geoEntityRepository } = await import('../repositories/geo-entity.repository.js')
    const totalEntities = await geoEntityRepository.count({ where: { projectId } })

    if (totalEntities === 0) return 0
    return entitiesWithClaims / totalEntities
  },

  /**
   * Evidence Score: Average credibility of all evidence + evidence count per claim.
   */
  async calculateEvidenceScore(projectId: string): Promise<number> {
    const evidenceMetrics = await geoEvidenceService.getProjectCredibilityMetrics(projectId)
    if (evidenceMetrics.totalCount === 0) return 0

    return evidenceMetrics.averageScore
  },

  /**
   * Schema Score: Percentage of schema markup that validates successfully.
   */
  async calculateSchemaScore(projectId: string): Promise<number> {
    const schemas = await geoSchemaRepository.listByProjectId(projectId)
    if (schemas.length === 0) return 0

    const validCount = schemas.filter((s) => s.validationStatus === 'valid').length
    return validCount / schemas.length
  },

  /**
   * Get the latest quality score for a project.
   */
  async getLatestScore(projectId: string): Promise<QualityScore | null> {
    return geoQualityRepository.findLatestByProjectAndDimension(projectId, 'composite')
  },

  /**
   * Get all score dimensions for a project.
   */
  async getAllScores(projectId: string): Promise<QualityScore[]> {
    return geoQualityRepository.findByProjectId(projectId)
  },
}
