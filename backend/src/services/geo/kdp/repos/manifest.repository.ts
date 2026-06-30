// ════════════════════════════════════════════════════════════
// KDP K2 — Repository: ManifestRepository
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { PackageManifest, DistributionTarget } from '../../types'

export class ManifestRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    sourceAssetId: string
    sourceClaimId: string
    sourceRecordId: string
    sourceProjectId?: string
    title: string
    summary: string
    estimatedSize: number
    mimeType: string
    language?: string
    preferredTargets?: DistributionTarget[]
    cacheTTL?: number
    requiresIndexing?: boolean
    priority?: 'high' | 'normal' | 'low'
    contentHash: string
    signed?: boolean
  }): Promise<PackageManifest> {
    const manifest = await this.prisma.packageManifest.create({
      data: {
        sourceAssetId: data.sourceAssetId,
        sourceClaimId: data.sourceClaimId,
        sourceRecordId: data.sourceRecordId,
        sourceProjectId: data.sourceProjectId ?? null,
        title: data.title,
        summary: data.summary,
        estimatedSize: data.estimatedSize,
        mimeType: data.mimeType,
        language: data.language ?? 'zh-CN',
        preferredTargets: data.preferredTargets ? JSON.parse(JSON.stringify(data.preferredTargets)) : [],
        cacheTTL: data.cacheTTL ?? 3600,
        requiresIndexing: data.requiresIndexing ?? true,
        priority: data.priority ?? 'normal',
        contentHash: data.contentHash,
        signed: data.signed ?? false,
        timestamp: new Date(),
      },
    })
    return this.toDTO(manifest)
  }

  async findById(id: string): Promise<PackageManifest | null> {
    const m = await this.prisma.packageManifest.findUnique({ where: { id } })
    return m ? this.toDTO(m) : null
  }

  async findByAssetId(sourceAssetId: string): Promise<PackageManifest[]> {
    const manifests = await this.prisma.packageManifest.findMany({
      where: { sourceAssetId },
      orderBy: { timestamp: 'desc' },
    })
    return manifests.map(m => this.toDTO(m))
  }

  async existsByAsset(sourceAssetId: string): Promise<boolean> {
    const count = await this.prisma.packageManifest.count({ where: { sourceAssetId } })
    return count > 0
  }

  private toDTO(m: any): PackageManifest {
    return {
      id: m.id,
      schemaVersion: m.schemaVersion,
      source: {
        assetId: m.sourceAssetId,
        claimId: m.sourceClaimId,
        recordId: m.sourceRecordId,
        projectId: m.sourceProjectId ?? undefined,
      },
      content: {
        title: m.title,
        summary: m.summary,
        estimatedSize: m.estimatedSize,
        mimeType: m.mimeType,
        language: m.language,
      },
      delivery: {
        preferredTargets: Array.isArray(m.preferredTargets) ? m.preferredTargets : JSON.parse(m.preferredTargets || '[]'),
        cacheTTL: m.cacheTTL,
        requiresIndexing: m.requiresIndexing,
        priority: m.priority,
      },
      validation: {
        contentHash: m.contentHash,
        signed: m.signed,
        timestamp: m.timestamp.toISOString(),
      },
    }
  }
}
