// ════════════════════════════════════════════════════════════
// KDP K2 — Repository: KnowledgePackageRepository
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { KnowledgePackage, PackageType, PackageStatus } from '../../types'

export class KnowledgePackageRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    assetId: string
    projectId: string
    packageType: PackageType
    status?: PackageStatus
    version?: string
    artifactHash?: string
  }): Promise<KnowledgePackage> {
    const pkg = await this.prisma.knowledgePackage.create({
      data: {
        assetId: data.assetId,
        projectId: data.projectId,
        packageType: data.packageType,
        status: data.status ?? PackageStatus.Draft,
        version: data.version ?? '1.0.0',
        artifactHash: data.artifactHash ?? '',
      },
    })
    return this.toDTO(pkg)
  }

  async findById(id: string): Promise<KnowledgePackage | null> {
    const pkg = await this.prisma.knowledgePackage.findUnique({ where: { id } })
    return pkg ? this.toDTO(pkg) : null
  }

  async findByAssetId(assetId: string): Promise<KnowledgePackage[]> {
    const pkgs = await this.prisma.knowledgePackage.findMany({
      where: { assetId },
      orderBy: { createdAt: 'desc' },
    })
    return pkgs.map(p => this.toDTO(p))
  }

  async findByProject(projectId: string): Promise<KnowledgePackage[]> {
    const pkgs = await this.prisma.knowledgePackage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    return pkgs.map(p => this.toDTO(p))
  }

  async findByType(packageType: PackageType): Promise<KnowledgePackage[]> {
    const pkgs = await this.prisma.knowledgePackage.findMany({
      where: { packageType },
      orderBy: { createdAt: 'desc' },
    })
    return pkgs.map(p => this.toDTO(p))
  }

  async updateStatus(id: string, status: PackageStatus): Promise<KnowledgePackage> {
    const pkg = await this.prisma.knowledgePackage.update({
      where: { id },
      data: { status },
    })
    return this.toDTO(pkg)
  }

  async updateArtifactHash(id: string, hash: string): Promise<void> {
    await this.prisma.knowledgePackage.update({
      where: { id },
      data: { artifactHash: hash },
    })
  }

  async linkManifest(packageId: string, manifestId: string): Promise<void> {
    await this.prisma.knowledgePackage.update({
      where: { id: packageId },
      data: { manifestId },
    })
  }

  private toDTO(pkg: any): KnowledgePackage {
    return {
      id: pkg.id,
      assetId: pkg.assetId,
      projectId: pkg.projectId,
      packageType: pkg.packageType as PackageType,
      status: pkg.status as PackageStatus,
      version: pkg.version,
      artifactHash: pkg.artifactHash,
      manifestId: pkg.manifestId ?? undefined,
      createdAt: pkg.createdAt.toISOString(),
      updatedAt: pkg.updatedAt.toISOString(),
    }
  }
}
