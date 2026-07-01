// ════════════════════════════════════════════════════════════
// KH2-T005 — WebhookPublisher
// ════════════════════════════════════════════════════════════
// Fires webhook notifications when a KnowledgePackage is published.
// ════════════════════════════════════════════════════════════

import { KnowledgePackage } from '../../core/types'
import { Publisher, PublishArtifact, PublisherCapability } from '../types'

export class WebhookPublisher implements Publisher {
  name = 'webhook'
  type = 'webhook' as const
  capabilities = [PublisherCapability.SupportsIncremental]

  async publish(pkg: KnowledgePackage): Promise<{ artifacts: PublishArtifact[] }> {
    const payload = {
      event: 'knowledge_package.published',
      data: {
        id: pkg.id,
        workspace: pkg.workspace,
        entityType: pkg.entityType,
        entityId: pkg.entityId,
        title: pkg.title,
        version: pkg.version,
        claimCount: pkg.claims.length,
        evidenceCount: pkg.evidence.length,
      },
    }

    // In production: POST to configured webhook URLs
    const artifacts: PublishArtifact[] = [{
      name: `webhook-${pkg.id.slice(0, 8)}`,
      mimeType: 'application/json',
    }]

    return { artifacts }
  }
}
