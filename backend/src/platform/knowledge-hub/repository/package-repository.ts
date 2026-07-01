// ════════════════════════════════════════════════════════════
// KH1-T003 — KnowledgePackageRepository
// ════════════════════════════════════════════════════════════
// Single data access layer for KnowledgePackage.
// No Engine or Workspace should access ORM directly.
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { KnowledgePackage } from '../core/types'

export class KnowledgePackageRepository {
  constructor(private prisma: PrismaClient) {}

  async create(pkg: KnowledgePackage): Promise<KnowledgePackage> {
    const record = await this.prisma.knowledgePackage.create({
      data: {
        id: pkg.id,
        assetId: pkg.entityId,
        projectId: pkg.entityId, // TODO: KH2 — decouple from projectId
        packageType: this.toPackageType(pkg.workspace),
        status: pkg.status,
        version: pkg.version,
        artifactHash: '',
      },
    })
    return { ...pkg, id: record.id }
  }

  async findById(id: string): Promise<KnowledgePackage | null> {
    const record = await this.prisma.knowledgePackage.findUnique({ where: { id } })
    if (!record) return null
    return this.toDTO(record)
  }

  async findByEntity(workspace: string, entityType: string, entityId: string): Promise<KnowledgePackage | null> {
    const record = await this.prisma.knowledgePackage.findFirst({
      where: {
        projectId: entityId,
        packageType: this.toPackageType(workspace),
      },
      orderBy: { createdAt: 'desc' },
    })
    if (!record) return null
    return this.toDTO(record)
  }

  async list(options: {
    workspace?: string
    status?: string
    page?: number
    pageSize?: number
  }): Promise<{ items: KnowledgePackage[]; total: number }> {
    const where: any = {}
    if (options.workspace) where.packageType = this.toPackageType(options.workspace)
    if (options.status) where.status = options.status

    const [records, total] = await Promise.all([
      this.prisma.knowledgePackage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: ((options.page ?? 1) - 1) * (options.pageSize ?? 20),
        take: options.pageSize ?? 20,
      }),
      this.prisma.knowledgePackage.count({ where }),
    ])

    return {
      items: records.map(r => this.toDTO(r)),
      total,
    }
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.prisma.knowledgePackage.update({
      where: { id },
      data: { status, updatedAt: new Date() },
    })
  }

  async delete(id: string): Promise<void> {
    await this.prisma.knowledgePackage.delete({ where: { id } })
  }

  private toDTO(record: any): KnowledgePackage {
    return {
      id: record.id,
      workspace: this.fromPackageType(record.packageType),
      entityType: 'unknown',
      entityId: record.projectId,
      title: record.id,
      description: '',
      version: record.version,
      status: record.status,
      statusHistory: [],
      claims: [],
      evidence: [],
      assets: [],
      citations: [],
      tags: [],
      publishingTargets: [],
      createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
      updatedAt: record.updatedAt?.toISOString?.() ?? record.updatedAt,
    }
  }

  private toPackageType(workspace: string): string {
    const map: Record<string, string> = {
      geo: 'website',
      novel: 'ai_feed',
      drama: 'knowledge_bundle',
      ppt: 'sitemap',
    }
    return map[workspace] || 'website'
  }

  private fromPackageType(packageType: string): string {
    const map: Record<string, string> = {
      website: 'geo',
      ai_feed: 'novel',
      knowledge_bundle: 'drama',
      sitemap: 'ppt',
    }
    return map[packageType] || 'geo'
  }
}
