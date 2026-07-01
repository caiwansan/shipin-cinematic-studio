// Stub — StoryKnowledgeProvider
// Placeholder for KH2+ integration

import { KnowledgePackage, KnowledgeProvider } from '../../core/types'

export class StoryKnowledgeProvider implements KnowledgeProvider {
  workspace = 'drama'
  name = 'StoryKnowledgeProvider'

  canHandle(entityType: string, _entityId: string): boolean {
    return entityType === 'story' || entityType === 'episode'
  }

  async buildContent(pkg: KnowledgePackage): Promise<KnowledgePackage | null> {
    console.warn('[StoryKnowledgeProvider] Stub — not implemented')
    return pkg
  }
}
