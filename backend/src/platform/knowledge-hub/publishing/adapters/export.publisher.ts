// ════════════════════════════════════════════════════════════
// KH2-T005 — ExportPublisher
// ════════════════════════════════════════════════════════════
// Generates export artifacts (ZIP, JSON, Markdown) from KnowledgePackage.
// ════════════════════════════════════════════════════════════

import { KnowledgePackage } from '../../core/types'
import { Publisher, PublishArtifact, PublisherCapability } from '../types'

export class ExportPublisher implements Publisher {
  name = 'export'
  type = 'export' as const
  capabilities = [
    PublisherCapability.SupportsRollback,
    PublisherCapability.SupportsPreview,
    PublisherCapability.SupportsVerification,
  ]

  async publish(pkg: KnowledgePackage): Promise<{ artifacts: PublishArtifact[] }> {
    const artifacts: PublishArtifact[] = []

    // JSON export
    artifacts.push({
      name: `${pkg.entityType}-${pkg.entityId}-v${pkg.version}.json`,
      mimeType: 'application/json',
    })

    // Markdown export
    artifacts.push({
      name: `${pkg.entityType}-${pkg.entityId}-v${pkg.version}.md`,
      mimeType: 'text/markdown',
    })

    // In production: bundle into ZIP
    artifacts.push({
      name: `${pkg.entityType}-${pkg.entityId}-v${pkg.version}.zip`,
      mimeType: 'application/zip',
    })

    return { artifacts }
  }
}
