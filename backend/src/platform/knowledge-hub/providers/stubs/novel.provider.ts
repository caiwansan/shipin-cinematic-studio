// Stub — NovelKnowledgeProvider
// Placeholder for KH2+ integration

import { KnowledgePackage, KnowledgeClaim, KnowledgeEvidence, KnowledgeAsset, Citation, PublishingTarget, KnowledgeProvider } from '../../core/types'

export class NovelKnowledgeProvider implements KnowledgeProvider {
  workspace = 'novel'
  name = 'NovelKnowledgeProvider'

  canHandle(entityType: string, _entityId: string): boolean {
    return entityType === 'chapter' || entityType === 'novel'
  }

  async buildContent(pkg: KnowledgePackage): Promise<KnowledgePackage | null> {
    // Stub: no-op, return empty
    console.warn('[NovelKnowledgeProvider] Stub — not implemented')
    return pkg
  }
}
