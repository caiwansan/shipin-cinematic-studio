// ════════════════════════════════════════════════════════════
// KDP K2 — RSS Package Packager
// ════════════════════════════════════════════════════════════
// Generates a single RSS feed entry per asset.
// Multiple entries are aggregated by a feed.xml at the project level.
// ════════════════════════════════════════════════════════════

import { PackageType } from '../../types'
import { PackagerAdapter, AssetBuildContext, PipelineArtifact } from '../packaging-pipeline'

export class RSSPackager implements PackagerAdapter {
  readonly packageType = PackageType.RSS

  async build(ctx: AssetBuildContext): Promise<PipelineArtifact[]> {
    const { id, title, claimId } = ctx.asset
    const description = ctx.humanContent.substring(0, 500)
    const now = new Date().toUTCString()
    const link = `https://aigc.fushtn.com/knowledge/${id}`
    const guid = `${id}-${claimId}`

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${this.escape(title)}</title>
    <link>${link}</link>
    <description>${this.escape(description.substring(0, 200))}</description>
    <language>zh-CN</language>
    <lastBuildDate>${now}</lastBuildDate>

    <item>
      <title>${this.escape(title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${guid}</guid>
      <pubDate>${now}</pubDate>
      <description>${this.escape(description)}</description>
      <content:encoded><![CDATA[${ctx.humanContent}]]></content:encoded>
    </item>
  </channel>
</rss>`

    return [
      {
        fileName: 'feed-entry.xml',
        filePath: `/feeds/${id}.xml`,
        mimeType: 'application/rss+xml',
        content: xml,
        sortOrder: 0,
      },
    ]
  }

  preview(ctx: AssetBuildContext): string {
    const safeContent = ctx.humanContent || ''
    return `[RSS Package] "${ctx.asset.title || 'untitled'}"
  └── feed-entry.xml
  └── Description: ${safeContent.substring(0, 80)}...`
  }

  private escape(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  }
}
