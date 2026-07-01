// ════════════════════════════════════════════════════════════
// KH1-T005 — GeoKnowledgeProvider
// ════════════════════════════════════════════════════════════
// Bridges GEO workspace data into platform Canonical KnowledgePackage.
// Phase 2 of KDP → Knowledge Hub migration.
// ════════════════════════════════════════════════════════════

import { KnowledgePackage, KnowledgeClaim, KnowledgeEvidence, KnowledgeAsset, Citation, PublishingTarget, KnowledgeProvider } from '../../core/types'

export class GeoKnowledgeProvider implements KnowledgeProvider {
  workspace = 'geo'
  name = 'GeoKnowledgeProvider'

  constructor() {}

  canHandle(entityType: string, _entityId: string): boolean {
    return entityType === 'brand'
  }

  async buildContent(pkg: KnowledgePackage): Promise<KnowledgePackage> {
    // GEO fills in brand-specific knowledge:
    // Claims, Evidence, Assets will be populated here
    // For now, returns the package with empty content
    // Phase 2: integrate with GEO project service
    return pkg
  }

  getClaims(pkg: KnowledgePackage): KnowledgeClaim[] {
    return [] // TODO: KH2 — integrate with GEO claim service
  }

  getEvidence(pkg: KnowledgePackage): KnowledgeEvidence[] {
    return [] // TODO: KH2
  }

  getAssets(pkg: KnowledgePackage): KnowledgeAsset[] {
    return [] // TODO: KH2
  }

  getCitations(pkg: KnowledgePackage): Citation[] {
    return [] // TODO: KH2
  }

  getPublishingTargets(pkg: KnowledgePackage): PublishingTarget[] {
    return [] // TODO: KH2
  }
}
