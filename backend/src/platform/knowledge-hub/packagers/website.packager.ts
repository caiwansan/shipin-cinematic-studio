// ════════════════════════════════════════════════════════════
// KDP K2 — Website Package Packager
// ════════════════════════════════════════════════════════════
// Converts a KnowledgeAsset into deployable HTML.
// Generates: index.html (or multiple pages for full bundles)
// ════════════════════════════════════════════════════════════

import { PackageType } from '../../types'
import { PackagerAdapter, AssetBuildContext, PipelineArtifact } from '../packaging-pipeline'

export class WebsitePackager implements PackagerAdapter {
  readonly packageType = PackageType.Website

  async build(ctx: AssetBuildContext): Promise<PipelineArtifact[]> {
    const { title, humanContent } = ctx.asset
    const safeTitle = title || ''
    const safeBody = humanContent || ''
    const html = this.renderPage(safeTitle, safeBody, ctx.searchContent || '', ctx.projectId)

    return [
      {
        fileName: 'index.html',
        filePath: '/index.html',
        mimeType: 'text/html',
        content: html,
        sortOrder: 0,
      },
    ]
  }

  preview(ctx: AssetBuildContext): string {
    const { title, humanContent } = ctx.asset
    return `[Website Package] "${title || 'untitled'}"
  └── index.html (${(humanContent || '').length} chars)
  └── Meta: includes search variant as JSON-LD`
  }

  private renderPage(title: string, body: string, ldJson: string, projectId: string): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escape(title)}</title>
  <meta name="description" content="${this.escape(body.substring(0, 160))}">
  <script type="application/ld+json">
${ldJson}
  </script>
</head>
<body>
  <article>
    <h1>${this.escape(title)}</h1>
    <div class="content">
${body.split('\n').map(line => `      <p>${this.escape(line)}</p>`).join('\n')}
    </div>
  </article>
</body>
</html>`
  }

  private escape(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  }
}
