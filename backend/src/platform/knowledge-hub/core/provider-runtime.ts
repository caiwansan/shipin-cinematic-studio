// ════════════════════════════════════════════════════════════
// KH1-T005 — ProviderRuntime
// ════════════════════════════════════════════════════════════
// Registry for all KnowledgeProviders.
// Workspaces register here; PackageBuilder queries here.
// ════════════════════════════════════════════════════════════

import { KnowledgeProvider } from '../core/types'

export class ProviderRuntime {
  private providers: Map<string, KnowledgeProvider> = new Map()

  register(provider: KnowledgeProvider): void {
    this.providers.set(provider.name, provider)
  }

  get(name: string): KnowledgeProvider | undefined {
    return this.providers.get(name)
  }

  getByWorkspace(workspace: string): KnowledgeProvider | undefined {
    for (const provider of this.providers.values()) {
      if (provider.workspace === workspace) return provider
    }
    return undefined
  }

  findProvider(entityType: string, entityId: string): KnowledgeProvider | undefined {
    for (const provider of this.providers.values()) {
      if (provider.canHandle(entityType, entityId)) return provider
    }
    return undefined
  }

  getAll(): KnowledgeProvider[] {
    return Array.from(this.providers.values())
  }
}
