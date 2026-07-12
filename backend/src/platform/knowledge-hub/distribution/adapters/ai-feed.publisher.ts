// ════════════════════════════════════════════════════════════
// P2A-003 — AI Feed Publisher
// ════════════════════════════════════════════════════════════
// GEO's differentiator. AI Feed is NOT format adaptation — it's a
// structured knowledge pack with entities, claims, evidence, citations.
//
// Future AI platform adapters consume this feed, not modify this Publisher.
//
// Generates:
//   ai-feed.json       — 结构化知识数据（entities + claims + evidence + citations）
//   ai-feed-summary.json — 摘要统计数据（供 Observation Engine 使用）
//   publish.json       — 统一发布元数据
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { PublishFile } from './contract'

interface AIFeedEntity {
  id: string
  name: string
  type: string
  description?: string
  properties?: Record<string, any>
}

interface AIFeedClaim {
  id: string
  text: string
  confidence?: number
  source?: string
  category?: string
}

interface AIFeedEvidence {
  id: string
  content: string
  source?: string
  url?: string
  claimId?: string
}

interface AIFeedCitation {
  id: string
  title: string
  url: string
  snippet?: string
}

interface AIFeedStructure {
  metadata: {
    packageId: string
    title: string
    version: string
    status: string
    language: string
    entityCount: number
    claimCount: number
    evidenceCount: number
    citationCount: number
  }
  entities: AIFeedEntity[]
  claims: AIFeedClaim[]
  evidence: AIFeedEvidence[]
  citations: AIFeedCitation[]
}

export class AIFeedPublisher {
  name = 'ai-feed'
  type = 'ai-feed'

  private prisma: PrismaClient

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? new PrismaClient()
  }

  async publish(packageId: string): Promise<PublishFile[]> {
    // 1. 读取 KnowledgePackage
    const dbPackage = await this.prisma.knowledgePackage.findUnique({
      where: { id: packageId },
    })
    if (!dbPackage) throw new Error(`Package not found: ${packageId}`)

    // 2. 读取 Manifest
    let manifest: any = null
    if (dbPackage.manifestId) {
      manifest = await this.prisma.packageManifest.findUnique({
        where: { id: dbPackage.manifestId },
      })
    }

    // 3. 读取 package.json Artifact — 获取 claims/evidence/citations/assets
    const artifacts = await this.prisma.packageArtifact.findMany({
      where: { packageId },
    })

    const mainArtifact = artifacts.find(a => a.fileName === 'package.json')
    let packageData: any = {
      claims: [],
      evidence: [],
      citations: [],
      assets: [],
    }
    if (mainArtifact) {
      try { packageData = JSON.parse(mainArtifact.content) } catch {}
    }

    const rawClaims: any[] = packageData.claims ?? []
    const rawEvidence: any[] = packageData.evidence ?? []
    const rawCitations: any[] = packageData.citations ?? []
    const rawAssets: any[] = packageData.assets ?? []

    const title = manifest?.title ?? dbPackage.id
    const language = manifest?.language ?? 'zh-CN'

    // ── Build AI Feed Structure ──
    const entities: AIFeedEntity[] = rawAssets
      .filter((a: any) => a.type === 'structured_data')
      .map((a: any) => {
        let entityData: any = {}
        try { entityData = JSON.parse(a.content ?? '{}') } catch {}
        return {
          id: a.id,
          name: entityData.name ?? entityData.title ?? 'Unknown',
          type: entityData.type ?? entityData.category ?? 'unknown',
          description: entityData.description ?? '',
          properties: this.extractProperties(entityData),
        }
      })

    const claims: AIFeedClaim[] = rawClaims.map((c: any) => ({
      id: c.id ?? '',
      text: c.text ?? c.content ?? '',
      confidence: c.confidence,
      source: c.source,
      category: c.category,
    }))

    const evidence: AIFeedEvidence[] = rawEvidence.map((e: any) => ({
      id: e.id ?? '',
      content: e.content ?? e.text ?? '',
      source: e.source,
      url: e.url,
      claimId: e.claimId,
    }))

    const citations: AIFeedCitation[] = rawCitations.map((c: any) => ({
      id: c.id ?? '',
      title: c.title ?? '',
      url: c.url ?? '',
      snippet: c.snippet ?? c.content?.substring(0, 200),
    }))

    const feed: AIFeedStructure = {
      metadata: {
        packageId,
        title,
        version: dbPackage.version,
        status: dbPackage.status,
        language,
        entityCount: entities.length,
        claimCount: claims.length,
        evidenceCount: evidence.length,
        citationCount: citations.length,
      },
      entities,
      claims,
      evidence,
      citations,
    }

    const files: PublishFile[] = []

    // ── ai-feed.json ──
    const feedContent = JSON.stringify(feed, null, 2)
    files.push({
      fileName: 'ai-feed.json',
      filePath: '/ai-feed/ai-feed.json',
      mimeType: 'application/json',
      content: feedContent,
      size: feedContent.length,
      contentHash: this.simpleHash(feedContent),
    })

    // ── ai-feed-summary.json ──
    const summary = JSON.stringify({
      packageId,
      title,
      metadata: feed.metadata,
      topClaims: claims.slice(0, 5).map(c => c.text.substring(0, 200)),
      entityNames: entities.map(e => e.name),
      citationCount: citations.length,
    }, null, 2)
    files.push({
      fileName: 'ai-feed-summary.json',
      filePath: '/ai-feed/ai-feed-summary.json',
      mimeType: 'application/json',
      content: summary,
      size: summary.length,
      contentHash: this.simpleHash(summary),
    })

    // ── publish.json ──
    const publishMeta = JSON.stringify({
      publisher: 'ai-feed',
      packageId,
      packageVersion: dbPackage.version,
      target: 'ai-feed',
      outputPath: `/distribution/${packageId}/ai-feed/`,
      status: dbPackage.status,
      entityCount: entities.length,
      claimCount: claims.length,
    }, null, 2)
    files.push({
      fileName: 'publish.json',
      filePath: '/ai-feed/publish.json',
      mimeType: 'application/json',
      content: publishMeta,
      size: publishMeta.length,
      contentHash: this.simpleHash(publishMeta),
    })

    return files
  }

  private extractProperties(data: any): Record<string, any> {
    const known = ['name', 'title', 'type', 'category', 'description', 'id']
    const props: Record<string, any> = {}
    for (const [key, value] of Object.entries(data)) {
      if (!known.includes(key) && typeof value !== 'object') {
        props[key] = value
      }
    }
    return props
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash).toString(16).padStart(8, '0')
  }
}
