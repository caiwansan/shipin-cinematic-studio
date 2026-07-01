// Stub — PresentationKnowledgeProvider
// Placeholder for KH2+ integration

import { KnowledgePackage, KnowledgeProvider } from '../../core/types'

export class PresentationKnowledgeProvider implements KnowledgeProvider {
  workspace = 'ppt'
  name = 'PresentationKnowledgeProvider'

  canHandle(entityType: string, _entityId: string): boolean {
    return entityType === 'slide' || entityType === 'presentation'
  }

  async buildContent(pkg: KnowledgePackage): Promise<KnowledgePackage | null> {
    console.warn('[PresentationKnowledgeProvider] Stub — not implemented')
    return pkg
  }
}
