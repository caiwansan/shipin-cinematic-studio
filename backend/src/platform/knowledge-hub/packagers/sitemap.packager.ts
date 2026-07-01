// ════════════════════════════════════════════════════════════
// KDP K2 — Sitemap Package Packager
// ════════════════════════════════════════════════════════════
// Generates a single <url> entry for the asset in sitemap.xml.
// For bundles, multiple entries would be aggregated by a sitemap index.
// ════════════════════════════════════════════════════════════

import { PackageType } from '../../types'
import { PackagerAdapter, AssetBuildContext, PipelineArtifact } from '../packaging-pipeline'

export class SitemapPackager implements PackagerAdapter {
  readonly packageType = PackageType.Sitemap

  async build(ctx: AssetBuildContext): Promise<PipelineArtifact[]> {
    const { id, title } = ctx.asset
    const changeFreq = ctx.humanContent ? 'weekly' : 'monthly'
    const priority = ctx.humanContent.length > 500 ? '0.8' : '0.5'

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://aigc.fushtn.com/knowledge/${id}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${changeFreq}</changefreq>
    <priority>${priority}</priority>
  </url>
</urlset>`

    return [
      {
        fileName: 'sitemap-entry.xml',
        filePath: `/sitemaps/${id}.xml`,
        mimeType: 'application/xml',
        content: xml,
        sortOrder: 0,
      },
    ]
  }

  preview(ctx: AssetBuildContext): string {
    const safeContent = ctx.humanContent || ''
    return `[Sitemap Package] "${ctx.asset.title || 'untitled'}"
  └── sitemap-entry.xml
  └── Priority: ${safeContent.length > 500 ? '0.8' : '0.5'}, Freq: weekly`
  }
}
