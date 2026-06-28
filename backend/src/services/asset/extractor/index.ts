// ============================================================
// Asset Extractor — Normalizer output → Asset
// Receives Structured Blocks, creates Assets
// ============================================================

import crypto from 'crypto'
import { assetService } from '../asset.service.js'
import type { StructuredBlock } from '../types.js'

function generateHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

function extractMetadata(blocks: StructuredBlock[]): Record<string, unknown> {
  const headingTexts: string[] = []
  const paragraphCount = blocks.filter(b => b.type === 'paragraph').length
  const listCount = blocks.filter(b => b.type === 'list').length

  for (const block of blocks) {
    if (block.type === 'heading') {
      headingTexts.push(block.content)
    }
  }

  return {
    headingCount: headingTexts.length,
    paragraphCount,
    listCount,
    headings: headingTexts.slice(0, 20),
    blockCount: blocks.length,
  }
}

function buildContent(blocks: StructuredBlock[]): string {
  return blocks
    .map(b => {
      switch (b.type) {
        case 'title': return `# ${b.content}`
        case 'summary': return `> ${b.content}`
        case 'heading': return `## ${b.content}`
        case 'paragraph': return b.content
        case 'list': return b.content
        default: return b.content
      }
    })
    .filter(Boolean)
    .join('\n\n')
}

export const assetExtractor = {
  /**
   * Extract assets from structured blocks
   * Returns created/updated asset for each block group
   */
  async extract(projectId: string, url: string, blocks: StructuredBlock[], detectedType: string, title: string, summary: string): Promise<unknown> {
    const content = buildContent(blocks)
    const hash = generateHash(content)
    const metadata = extractMetadata(blocks)

    const asset = await assetService.createAsset({
      projectId,
      type: detectedType,
      title,
      content,
      summary,
      source: 'scanner',
      sourceUrl: url,
      hash,
      metadata,
      status: 'published',
    })

    // Add source URL as tag
    try {
      const domain = new URL(url).hostname
      await assetService.addTag(asset.id, `source:${domain}`)
      await assetService.addTag(asset.id, `type:${detectedType}`)
    } catch {
      // Ignore tag errors
    }

    return asset
  },
}
