// ════════════════════════════════════════════════════════════
// KDP K2 — Repository: ArtifactRepository
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'

export class ArtifactRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    packageId: string
    fileName: string
    filePath: string
    mimeType: string
    content: string
    sortOrder?: number
  }): Promise<PackageArtifact> {
    const contentHash = this.sha256(data.content)
    const artifact = await this.prisma.packageArtifact.create({
      data: {
        packageId: data.packageId,
        fileName: data.fileName,
        filePath: data.filePath,
        mimeType: data.mimeType,
        content: data.content,
        contentHash,
        size: Buffer.byteLength(data.content, 'utf8'),
        sortOrder: data.sortOrder ?? 0,
      },
    })
    return this.toDTO(artifact)
  }

  async createBatch(artifacts: Array<{
    packageId: string
    fileName: string
    filePath: string
    mimeType: string
    content: string
    sortOrder?: number
  }>): Promise<PackageArtifact[]> {
    const data = artifacts.map(a => ({
      packageId: a.packageId,
      fileName: a.fileName,
      filePath: a.filePath,
      mimeType: a.mimeType,
      content: a.content,
      contentHash: this.sha256(a.content),
      size: Buffer.byteLength(a.content, 'utf8'),
      sortOrder: a.sortOrder ?? 0,
    }))
    await this.prisma.packageArtifact.createMany({ data })
    // Fetch back
    const created = await this.prisma.packageArtifact.findMany({
      where: { packageId: artifacts[0].packageId },
      orderBy: { sortOrder: 'asc' },
    })
    return created.map(a => this.toDTO(a))
  }

  async findByPackage(packageId: string): Promise<PackageArtifact[]> {
    const artifacts = await this.prisma.packageArtifact.findMany({
      where: { packageId },
      orderBy: { sortOrder: 'asc' },
    })
    return artifacts.map(a => this.toDTO(a))
  }

  async deleteByPackage(packageId: string): Promise<void> {
    await this.prisma.packageArtifact.deleteMany({
      where: { packageId },
    })
  }

  async totalArtifactSize(packageId: string): Promise<number> {
    const result = await this.prisma.packageArtifact.aggregate({
      where: { packageId },
      _sum: { size: true },
    })
    return result._sum.size ?? 0
  }

  async totalArtifactHash(packageId: string): Promise<string> {
    const artifacts = await this.prisma.packageArtifact.findMany({
      where: { packageId },
      orderBy: { sortOrder: 'asc' },
    })
    // Package hash = hash(manifestHash + sortedArtifactHashes)
    const concat = artifacts.map(a => a.contentHash).join('')
    return this.sha256(concat)
  }

  private sha256(content: string): string {
    return createHash('sha256').update(content).digest('hex')
  }

  private toDTO(a: any): PackageArtifact {
    return {
      id: a.id,
      packageId: a.packageId,
      fileName: a.fileName,
      filePath: a.filePath,
      mimeType: a.mimeType,
      content: a.content,
      contentHash: a.contentHash,
      size: a.size,
      sortOrder: a.sortOrder,
      createdAt: a.createdAt.toISOString(),
    }
  }
}
