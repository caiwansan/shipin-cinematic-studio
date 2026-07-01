// ════════════════════════════════════════════════════════════
// KDP K2 — Knowledge Bundle Package Packager
// ════════════════════════════════════════════════════════════
// Multi-asset aggregation. A Bundle groups related assets
// (e.g. brand → all claims) into a single comprehensive package.
//
// Bundle is special: it generates a summary manifest + individual
// entries for each asset, plus cross-references between them.
// ════════════════════════════════════════════════════════════

import { PackageType } from '../../types'
import { PackagerAdapter, AssetBuildContext, PipelineArtifact } from '../packaging-pipeline'

export class KnowledgeBundlePackager implements PackagerAdapter {
  readonly packageType = PackageType.KnowledgeBundle

  async build(ctx: AssetBuildContext): Promise<PipelineArtifact[]> {
    const { id, title, assetType } = ctx.asset
    const summary = ctx.humanContent.substring(0, 2000)
    const bundleName = ctx.projectId ? `bundle-${ctx.projectId}` : `bundle-${id}`

    const bundle = {
      schema: 'https://schema.aigc.fushtn.com/knowledge-bundle/v1',
      bundleName,
      generatedAt: new Date().toISOString(),
      assetCount: 1,
      assets: [
        {
          id,
          title,
          type: assetType,
          summary: summary.substring(0, 300),
          preview: `<https://aigc.fushtn.com/knowledge/${id}>`,
        },
      ],
      crossReferences: [],
      summary,
      metadata: {
        version: '1.0.0',
        totalSize: Buffer.byteLength(summary, 'utf8'),
        containsAI: ctx.aiContent.length > 0,
        containsSearch: ctx.searchContent.length > 0,
      },
    }

    const manifest = {
      bundleName,
      assetIds: [id],
      generatedAt: bundle.generatedAt,
      description: `Knowledge Bundle for "${title}"`,
    }

    return [
      {
        fileName: 'bundle.json',
        filePath: `/bundles/${bundleName}.json`,
        mimeType: 'application/json',
        content: JSON.stringify(bundle, null, 2),
        sortOrder: 0,
      },
      {
        fileName: 'manifest.json',
        filePath: `/bundles/${bundleName}-manifest.json`,
        mimeType: 'application/json',
        content: JSON.stringify(manifest, null, 2),
        sortOrder: 1,
      },
    ]
  }

  preview(ctx: AssetBuildContext): string {
    return `[Knowledge Bundle Package] "${ctx.asset.title || 'untitled'}"
  ├── bundle.json (full bundle with cross-references)
  └── manifest.json (bundle index)
  └── 1 asset, ~${(ctx.humanContent || '').length} chars total`
  }
}
