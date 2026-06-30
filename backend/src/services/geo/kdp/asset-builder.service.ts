// ════════════════════════════════════════════════════════════
// KDP Service 1: AssetBuilderService
// ════════════════════════════════════════════════════════════
// Input: PublishingRecord
// Output: KnowledgeAsset + 3 AssetVariants (Human/Search/AI)
// FR-K6: Asset references claimId, never projectId directly
// FR-K7: Every asset must have all three variants
// FR-K8: KDP input is always PublishingRecord, never Claim
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { AssetType, AssetStatus } from '../types'
import crypto from 'crypto'

interface AssetBuildInput {
  recordId: string
  claimId: string
  assetType: AssetType
  title: string
  /** The raw claim content (markdown body) */
  rawContent: string
}

interface AssetBuildOutput {
  assetId: string
  variants: Array<{
    variantType: 'human' | 'search' | 'ai'
    contentType: string
    content: string
    version: string
  }>
}

export class AssetBuilderService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Build a KnowledgeAsset from a PublishingRecord.
   * Generates all three variants (human/search/ai) automatically.
   * Idempotent: if an asset already exists for this recordId, returns existing.
   */
  async buildFromRecord(input: AssetBuildInput): Promise<AssetBuildOutput> {
    // ── Idempotency: check existing ──
    const existing = await this.prisma.knowledgeAsset.findUnique({
      where: { recordId: input.recordId },
      include: { variants: true },
    })
    if (existing) {
      return {
        assetId: existing.id,
        variants: existing.variants.map(v => ({
          variantType: v.variantType as 'human' | 'search' | 'ai',
          contentType: v.contentType,
          content: v.content,
          version: v.version,
        })),
      }
    }

    // ── Generate three variants ──
    const version = '1.0.0'
    const humanContent = this.generateHumanVariant(input)
    const searchContent = this.generateSearchVariant(input)
    const aiContent = this.generateAIVariant(input)

    const humanHash = this.hash(humanContent)
    const searchHash = this.hash(searchContent)
    const aiHash = this.hash(aiContent)

    // ── Create asset + variants in transaction ──
    const asset = await this.prisma.$transaction(async (tx) => {
      const a = await tx.knowledgeAsset.create({
        data: {
          claimId: input.claimId,
          recordId: input.recordId,
          assetType: input.assetType,
          status: AssetStatus.Ready,
          version,
        },
      })

      await tx.assetVariant.createMany({
        data: [
          {
            assetId: a.id,
            variantType: 'human',
            contentType: 'text/markdown',
            content: humanContent,
            version,
            artifactHash: humanHash,
          },
          {
            assetId: a.id,
            variantType: 'search',
            contentType: 'application/ld+json',
            content: searchContent,
            version,
            artifactHash: searchHash,
          },
          {
            assetId: a.id,
            variantType: 'ai',
            contentType: 'application/json',
            content: aiContent,
            version,
            artifactHash: aiHash,
          },
        ],
      })

      return a
    })

    return {
      assetId: asset.id,
      variants: [
        { variantType: 'human', contentType: 'text/markdown', content: humanContent, version },
        { variantType: 'search', contentType: 'application/ld+json', content: searchContent, version },
        { variantType: 'ai', contentType: 'application/json', content: aiContent, version },
      ],
    }
  }

  /**
   * Human variant: Markdown (possibly with HTML wrappers later).
   * This is what human readers see on websites.
   */
  private generateHumanVariant(input: AssetBuildInput): string {
    const lines = input.rawContent.split('\n').filter(l => l.trim())
    // Strip JSON for schema_entity assets — present as code block
    if (input.assetType === AssetType.SchemaEntity) {
      return `## ${input.title}\n\n\`\`\`json\n${input.rawContent}\n\`\`\``
    }
    return input.rawContent
  }

  /**
   * Search variant: JSON-LD structured data for search engines.
   * Uses the claim content to build schema.org-compatible markup.
   */
  private generateSearchVariant(input: AssetBuildInput): string {
    const base: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': this.inferSchemaType(input.assetType),
      name: input.title,
      description: this.extractFirstParagraph(input.rawContent),
      version: '1.0.0',
    }

    // Add claim provenance
    base.provenance = {
      claimId: input.claimId,
      recordId: input.recordId,
    }

    return JSON.stringify(base, null, 2)
  }

  /**
   * AI variant: Structured knowledge representation for AI models.
   * Not just a JSON copy — this is a knowledge expression designed
   * to be consumed by LLMs and knowledge graphs.
   */
  private generateAIVariant(input: AssetBuildInput): string {
    const knowledgePack: Record<string, unknown> = {
      schemaVersion: '1.0',
      assetType: input.assetType,
      title: input.title,
      summary: this.extractFirstParagraph(input.rawContent),
      entities: this.extractEntities(input.rawContent),
      factualClaims: this.extractFactualStatements(input.rawContent),
      provenance: {
        type: 'verified_content',
        claimId: input.claimId,
        recordId: input.recordId,
        confidence: 'HIGH',
      },
      aiReadableStrategy: {
        promptOptimized: true,
        knowledgeGraphReady: true,
        factSheetCompatible: true,
      },
    }

    return JSON.stringify(knowledgePack, null, 2)
  }

  // ─── Helpers ───

  private inferSchemaType(assetType: AssetType): string {
    const map: Record<string, string> = {
      [AssetType.Article]: 'Article',
      [AssetType.SchemaEntity]: 'Product',
      [AssetType.EntityGraph]: 'DataFeed',
      [AssetType.FactSheet]: 'Dataset',
      [AssetType.ClaimGraph]: 'Graph',
      [AssetType.BrandProfile]: 'Organization',
      [AssetType.QAPack]: 'FAQPage',
      [AssetType.AIKnowledgeFeed]: 'Dataset',
      [AssetType.AIManifest]: 'SoftwareApplication',
    }
    return map[assetType] || 'Article'
  }

  private extractFirstParagraph(content: string): string {
    const clean = content.replace(/^#+\s*/gm, '').trim()
    const first = clean.split('\n\n')[0]
    return first?.substring(0, 500) || ''
  }

  private extractEntities(content: string): string[] {
    // Simple extraction: headers, bold terms, and capitalized proper nouns
    const headers = content.match(/[#]+\s+(.+)/g)?.map(h => h.replace(/^#+\s*/, '')) || []
    const boldTerms = content.match(/\*\*(.+?)\*\*/g)?.map(b => b.replace(/\*\*/g, '')) || []
    return [...new Set([...headers, ...boldTerms])].slice(0, 20)
  }

  private extractFactualStatements(content: string): Array<{ statement: string; type: string }> {
    // Extract bullet points as factual statements
    const bullets = content.match(/[-*]\s+(.+)/g)?.map(b => b.replace(/^[-*]\s*/, '')) || []
    return bullets.slice(0, 10).map(s => ({ statement: s, type: 'claim' }))
  }

  private hash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16)
  }
}
