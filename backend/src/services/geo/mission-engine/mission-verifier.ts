// ─────────────────────────────────────────────────
// Mission Verifier — 验证 Mission 是否完成
// P0 — FROZEN
// ─────────────────────────────────────────────────

import type { Mission } from './types'
import { knowledgeObjectService } from '../runtime/knowledge/KnowledgeObjectService'
import { geoClaimRepository } from '../repositories/geo-claim.repository'
import { geoEvidenceRepository } from '../repositories/geo-evidence.repository'
import { geoSchemaRepository } from '../repositories/geo-schema.repository'

export class MissionVerifier {
  /**
   * Verify whether a mission has been completed
   */
  async verify(mission: Mission, brandId: string): Promise<boolean> {
    switch (mission.verification?.type) {
      case 'schema_exists':
        return await this.hasSchema(brandId)
      case 'claim_exists':
        return await this.hasClaims(brandId)
      case 'evidence_exists':
        return await this.hasEvidence(brandId)
      case 'faq_exists':
        return await this.hasFaqs(brandId)
      case 'manual':
        return false  // 手动标记
      default:
        return false
    }
  }

  private async hasSchema(brandId: string): Promise<boolean> {
    try {
      const schemas = await geoSchemaRepository.listByProjectId(brandId)
      return schemas.length > 0
    } catch (e) {
      return false
    }
  }

  private async hasClaims(brandId: string): Promise<boolean> {
    try {
      const claims = await geoClaimRepository.findMany({ where: { entity: { projectId: brandId } } })
      return claims.length > 0
    } catch (e) {
      return false
    }
  }

  private async hasEvidence(brandId: string): Promise<boolean> {
    try {
      const evidence = await geoEvidenceRepository.listByProjectId(brandId)
      return evidence.length > 0
    } catch (e) {
      return false
    }
  }

  private async hasFaqs(brandId: string): Promise<boolean> {
    try {
      // Try to check if FAQs exist for this brand
      // Use knowledge objects as a proxy for FAQ content
      const kos = await knowledgeObjectService.getByProject(brandId)
      return kos.length > 0
    } catch (e) {
      return false
    }
  }
}
