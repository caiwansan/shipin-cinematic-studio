// ════════════════════════════════════════════════════════════
// D1-T001 — StoryKnowledgeProvider (Drama)
// Phase B1: First non-GEO real KnowledgeProvider
// ════════════════════════════════════════════════════════════
// All data fetching happens in buildContent() (async).
// Sync methods (getClaims, getEvidence, etc.) read from pkg.
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { v4 as uuid } from 'uuid'
import {
  KnowledgePackage, KnowledgeClaim, KnowledgeEvidence,
  KnowledgeAsset, Citation, PublishingTarget, KnowledgeProvider,
} from '../core/types'

export class StoryKnowledgeProvider implements KnowledgeProvider {
  workspace = 'drama'
  name = 'StoryKnowledgeProvider'

  constructor(private prisma: PrismaClient) {}

  canHandle(entityType: string, _entityId: string): boolean {
    return entityType === 'video' || entityType === 'episode'
  }

  async buildContent(pkg: KnowledgePackage): Promise<KnowledgePackage> {
    if (pkg.entityType !== 'video') return pkg

    const project = await this.prisma.project.findUnique({
      where: { id: pkg.entityId },
    })

    if (!project) return pkg

    pkg.title = project.name
    pkg.description = project.description || ''
    pkg.entityId = project.id

    pkg.tags = [...new Set([
      ...(pkg.tags || []),
      `type:${project.type || 'unknown'}`,
      `status:${project.status}`,
    ])]

    // Fetch all data now; sync methods read from these pre-loaded arrays
    pkg.claims = await this.fetchClaims(pkg.entityId)
    pkg.evidence = await this.fetchEvidence(pkg.entityId)
    pkg.assets = await this.fetchAssets(pkg.entityId)
    pkg.citations = await this.fetchCitations(pkg.entityId)

    return pkg
  }

  // ── Sync methods — read pre-loaded data ──

  getClaims(pkg: KnowledgePackage): KnowledgeClaim[] {
    return pkg.claims
  }

  getEvidence(pkg: KnowledgePackage): KnowledgeEvidence[] {
    return pkg.evidence
  }

  getAssets(pkg: KnowledgePackage): KnowledgeAsset[] {
    return pkg.assets
  }

  getCitations(pkg: KnowledgePackage): Citation[] {
    return pkg.citations
  }

  getPublishingTargets(_pkg: KnowledgePackage): PublishingTarget[] {
    return [{ adapter: 'website', config: {}, enabled: true }]
  }

  // ── Private helpers ──

  private async fetchClaims(projectId: string): Promise<KnowledgeClaim[]> {
    try {
      const scenes = await this.prisma.aiSceneSpec.findMany({
        where: { projectId },
        select: { id: true, sceneName: true, description: true, imagePrompt: true, mood: true, environment: true },
        take: 100,
      })
      return scenes.map(s => ({
        id: s.id,
        text: [s.sceneName, s.description, s.imagePrompt].filter(Boolean).join(' | ') || 'Scene spec',
        category: 'scene',
        confidence: 0.8,
        source: 'AiSceneSpec',
      }))
    } catch {
      return []
    }
  }

  private async fetchEvidence(projectId: string): Promise<KnowledgeEvidence[]> {
    try {
      const storyboards = await this.prisma.storyboard.findMany({
        where: { projectId },
        select: { id: true, subject: true, action: true, duration: true, storyboardImage: true, createdAt: true },
        take: 100,
      })
      return storyboards.map(sb => ({
        id: sb.id,
        source: 'Storyboard',
        content: `${sb.subject || ''} — ${sb.action || ''} (${sb.duration || 3}s)`,
        url: sb.storyboardImage || undefined,
        publishedAt: sb.createdAt.toISOString(),
      }))
    } catch {
      return []
    }
  }

  private async fetchAssets(projectId: string): Promise<KnowledgeAsset[]> {
    const assets: KnowledgeAsset[] = []

    try {
      const chars = await this.prisma.aiCharacterSpec.findMany({
        where: { projectId },
        select: { id: true, characterName: true, gender: true, variant: true },
        take: 50,
      })
      for (const c of chars) {
        assets.push({
          id: c.id,
          type: 'structured_data',
          content: JSON.stringify({ name: c.characterName, gender: c.gender, variant: c.variant }),
        })
      }
    } catch { /* empty */ }

    try {
      const tts = await this.prisma.tTSRecord.findMany({
        where: { projectId },
        select: { id: true, audioUrl: true, characterName: true },
        take: 50,
      })
      for (const t of tts) {
        assets.push({
          id: t.id,
          type: 'other',
          url: t.audioUrl || undefined,
          content: t.audioUrl || undefined,
        })
      }
    } catch { /* empty */ }

    return assets
  }

  private async fetchCitations(projectId: string): Promise<Citation[]> {
    try {
      const refs = await this.prisma.sceneReference.findMany({
        where: { projectId },
        select: { id: true, imageUrl: true, sceneName: true },
        take: 50,
      })
      return refs.map(r => ({
        id: r.id,
        url: r.imageUrl || '',
        title: r.sceneName || 'Scene reference',
        snippet: r.sceneName || undefined,
      }))
    } catch {
      return []
    }
  }
}
