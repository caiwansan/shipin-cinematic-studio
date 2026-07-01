// ════════════════════════════════════════════════════════════
// KH2-T005 — CMSPublisher
// ════════════════════════════════════════════════════════════
// Generic CMS adapter. Real implementations extend this per platform.
// ════════════════════════════════════════════════════════════

import { KnowledgePackage } from '../../core/types'
import { Publisher, PublishArtifact, PublisherCapability } from '../types'

export class CMSPublisher implements Publisher {
  name = 'cms'
  type = 'cms' as const
  capabilities = [
    PublisherCapability.SupportsIncremental,
    PublisherCapability.SupportsScheduling,
  ]

  // CMS configuration
  private baseUrl?: string
  private apiKey?: string

  constructor(config?: { baseUrl?: string; apiKey?: string }) {
    this.baseUrl = config?.baseUrl
    this.apiKey = config?.apiKey
  }

  async publish(pkg: KnowledgePackage): Promise<{ artifacts: PublishArtifact[] }> {
    const artifacts: PublishArtifact[] = []

    // In production: call CMS REST API to create/update content
    artifacts.push({
      name: `${pkg.entityType}/${pkg.entityId}`,
      mimeType: 'application/json',
    })

    return { artifacts }
  }

  validate(pkg: KnowledgePackage): { valid: boolean; errors?: string[] } {
    const errors: string[] = []
    if (!pkg.title) errors.push('CMS requires a title')
    if (!pkg.entityId) errors.push('CMS requires an entityId')
    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined }
  }
}
