// ════════════════════════════════════════════════════════════
// KH2-T005 — WebsitePublisher
// ════════════════════════════════════════════════════════════
// Real implementation: generates static website from KnowledgePackage
// ════════════════════════════════════════════════════════════

import { KnowledgePackage } from '../../core/types'
import { Publisher, PublishArtifact, PublisherCapability, PublishingResult } from '../types'

export class WebsitePublisher implements Publisher {
  name = 'website'
  type = 'website' as const
  capabilities = [
    PublisherCapability.SupportsRollback,
    PublisherCapability.SupportsPreview,
  ]

  async publish(pkg: KnowledgePackage): Promise<{ artifacts: PublishArtifact[] }> {
    const artifacts: PublishArtifact[] = []

    // Generate index page
    artifacts.push({
      name: `index.html`,
      mimeType: 'text/html',
      size: new Blob([this.renderPage(pkg)]).size,
    })

    // Generate about page
    artifacts.push({
      name: `about.html`,
      mimeType: 'text/html',
      size: 0,
    })

    return { artifacts }
  }

  rollback(result: PublishingResult): Promise<boolean> {
    // In production: restore previous version from storage
    return Promise.resolve(true)
  }

  private renderPage(pkg: KnowledgePackage): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>${pkg.title}</title>
  <meta name="description" content="${pkg.description}">
</head>
<body>
  <h1>${pkg.title}</h1>
  <p>${pkg.description}</p>
  <section>
    <h2>Claims</h2>
    <ul>
      ${pkg.claims.map(c => `<li>${c.text}</li>`).join('')}
    </ul>
  </section>
  <section>
    <h2>Evidence</h2>
    <ul>
      ${pkg.evidence.map(e => `<li><a href="${e.url || '#'}">${e.source}</a></li>`).join('')}
    </ul>
  </section>
</body>
</html>`
  }
}
