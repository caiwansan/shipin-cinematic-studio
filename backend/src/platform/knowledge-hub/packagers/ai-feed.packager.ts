// ════════════════════════════════════════════════════════════
// KDP K2 — AI Feed Package Packager
// ════════════════════════════════════════════════════════════
// GEO's differentiator. AI Feed is NOT just JSON.
// It's a structured knowledge pack consumable by AI models:
// - Entities, Claims, FAQs, Facts, Relationships, Metadata
//
// Future: different AI platforms need only a format adapter
// (the knowledge structure itself is platform-independent).
// ════════════════════════════════════════════════════════════

import { PackageType } from '../../types'
import { PackagerAdapter, AssetBuildContext, PipelineArtifact } from '../packaging-pipeline'

export class AIFeedPackager implements PackagerAdapter {
  readonly packageType = PackageType.AIFeed

  async build(ctx: AssetBuildContext): Promise<PipelineArtifact[]> {
    const { id, title, claimId, assetType } = ctx.asset

    // Derive knowledge structure from variant content
    const summary = ctx.humanContent.substring(0, 1000)
    const structuredData = this.parseJSONorText(ctx.searchContent)

    // Entities from structured data
    const entities = this.extractEntities(structuredData, title, summary)

    // Claims (factual statements)
    const claims = this.extractClaims(id, claimId, summary)

    // FAQs derived from text patterns
    const faqs = this.extractFAQs(ctx.humanContent)

    // Facts (atomic statements)
    const facts = this.extractFacts(ctx.humanContent)

    // Relationships between entities
    const relationships = this.extractRelationships(entities)

    const aiFeed = {
      schema: 'https://schema.aigc.fushtn.com/knowledge-feed/v1',
      id,
      title,
      claimId,
      type: assetType,
      summary,
      language: 'zh-CN',
      freshness: new Date().toISOString(),
      entities,
      claims,
      faqs,
      facts,
      relationships,
      metadata: {
        version: ctx.asset.version || '1.0.0',
        estimatedQuality: summary.length > 300 ? 'high' : 'medium',
        hasSearchContent: ctx.searchContent.length > 0,
        totalChunks: this.countChunks(ctx.humanContent, ctx.searchContent, ctx.aiContent),
      },
    }

    return [
      {
        fileName: 'knowledge-feed.json',
        filePath: `/ai-feeds/${id}.json`,
        mimeType: 'application/json',
        content: JSON.stringify(aiFeed, null, 2),
        sortOrder: 0,
      },
    ]
  }

  preview(ctx: AssetBuildContext): string {
    const entityCount = this.roughEntityCount(ctx.humanContent || '')
    return `[AI Feed Package] "${ctx.asset.title || 'untitled'}"
  └── knowledge-feed.json
  └── ~${entityCount} entities, summary (${(ctx.humanContent || '').length} chars)
  └── Platform-independent knowledge structure`
  }

  // ─── Helpers ───

  private parseJSONorText(content: string): any {
    try { return JSON.parse(content) }
    catch { return {} }
  }

  private extractEntities(structured: any, title: string, summary: string): Array<{ name: string; type: string; description: string }> {
    const entities: Array<{ name: string; type: string; description: string }> = []

    // If search content has @graph or mainEntity, extract entities
    if (structured['@graph']) {
      for (const item of structured['@graph']) {
        if (item.name) {
          entities.push({
            name: item.name,
            type: item['@type'] || 'Thing',
            description: item.description || '',
          })
        }
      }
    }

    if (structured.mainEntity?.name) {
      entities.push({
        name: structured.mainEntity.name,
        type: structured.mainEntity['@type'] || 'Thing',
        description: structured.mainEntity.description || summary.substring(0, 200),
      })
    }

    // Always include the title as a concept
    if (entities.length === 0) {
      entities.push({ name: title, type: 'Concept', description: summary.substring(0, 200) })
    }

    return entities
  }

  private extractClaims(id: string, claimId: string, content: string): Array<{ id: string; text: string; confidence: string }> {
    const sentences = content.split(/[。！？.!?]/).filter(s => s.trim().length > 10)
    return sentences.slice(0, 5).map((s, i) => ({
      id: `${claimId}-claim-${i}`,
      text: s.trim(),
      confidence: 'verified',
    }))
  }

  private extractFAQs(content: string): Array<{ question: string; answer: string }> {
    // Simple heuristic: find "什么" / "如何" / "为什么" patterns
    const faqs: Array<{ question: string; answer: string }> = []
    const qaPattern = /(什么|如何|为什么|是否|怎样|哪些)[^。？?]*[？?]([^。]*。)/g
    let match
    while ((match = qaPattern.exec(content)) !== null && faqs.length < 3) {
      faqs.push({
        question: (match[0] || '').trim(),
        answer: (match[2] || '').trim(),
      })
    }
    return faqs
  }

  private extractFacts(content: string): Array<{ statement: string; source: string }> {
    const sentences = content.split(/[。！？.!?]/).filter(s => s.trim().length > 15)
    return sentences.slice(0, 8).map(s => ({
      statement: s.trim(),
      source: 'asset-content',
    }))
  }

  private extractRelationships(entities: any[]): Array<{ source: string; target: string; type: string }> {
    if (entities.length < 2) return []
    return [
      { source: entities[0].name, target: entities.length > 1 ? entities[1].name : entities[0].name, type: 'related_to' },
    ]
  }

  private roughEntityCount(content: string): number {
    return (content.match(/[A-Z][a-z]+/g) || []).filter(w => w.length > 2).length
  }

  private countChunks(...contents: string[]): number {
    return contents.reduce((sum, c) => sum + Math.ceil(c.length / 1024), 0)
  }
}
