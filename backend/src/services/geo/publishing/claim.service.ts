// ════════════════════════════════════════════════════════════
// P3 Service: ClaimService — PublishableClaim CRUD + lifecycle
// ════════════════════════════════════════════════════════════
// Phase 3 — No Vue, no CMS, no UI

import { PrismaClient } from '@prisma/client'
import { ClaimContentType, ClaimStatus, PublishableClaim, CreateClaimDTO } from '../types'

export class ClaimService {
  constructor(private prisma: PrismaClient) {}

  async create(dto: CreateClaimDTO): Promise<PublishableClaim> {
    const claim = await this.prisma.publishableClaim.create({
      data: {
        projectId: dto.projectId,
        verificationId: dto.verificationId,
        sourceActionId: dto.sourceActionId,
        title: dto.title,
        contentType: dto.contentType,
        content: dto.content,
        status: ClaimStatus.Draft,
        version: '1.0.0',
      },
    })
    return this.toDomain(claim)
  }

  async getById(id: string): Promise<PublishableClaim | null> {
    const c = await this.prisma.publishableClaim.findUnique({ where: { id } })
    return c ? this.toDomain(c) : null
  }

  async listByProject(projectId: string): Promise<PublishableClaim[]> {
    const claims = await this.prisma.publishableClaim.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    return claims.map(c => this.toDomain(c))
  }

  async listByVerification(verificationId: string): Promise<PublishableClaim[]> {
    const claims = await this.prisma.publishableClaim.findMany({
      where: { verificationId },
      orderBy: { createdAt: 'desc' },
    })
    return claims.map(c => this.toDomain(c))
  }

  async updateContent(id: string, content: string): Promise<PublishableClaim> {
    const claim = await this.prisma.publishableClaim.findUnique({ where: { id } })
    if (!claim) throw new Error(`Claim ${id} not found`)
    if (claim.status === ClaimStatus.Published) {
      throw new Error(`Cannot update published claim ${id}`)
    }
    const updated = await this.prisma.publishableClaim.update({
      where: { id },
      data: { content, status: ClaimStatus.Ready },
    })
    return this.toDomain(updated)
  }

  async markReady(id: string): Promise<PublishableClaim> {
    const updated = await this.prisma.publishableClaim.update({
      where: { id },
      data: { status: ClaimStatus.Ready },
    })
    return this.toDomain(updated)
  }

  async delete(id: string): Promise<void> {
    const claim = await this.prisma.publishableClaim.findUnique({ where: { id } })
    if (!claim) return
    if (claim.status === ClaimStatus.Published) {
      throw new Error(`Cannot delete published claim ${id}`)
    }
    await this.prisma.publishableClaim.delete({ where: { id } })
  }

  // Bump version when content changes
  async bumpVersion(id: string, content: string): Promise<PublishableClaim> {
    const claim = await this.prisma.publishableClaim.findUnique({ where: { id } })
    if (!claim) throw new Error(`Claim ${id} not found`)

    const parts = claim.version.split('.').map(Number)
    const newVersion = `${parts[0]}.${parts[1]}.${(parts[2] || 0) + 1}`
    const updated = await this.prisma.publishableClaim.update({
      where: { id },
      data: { content, version: newVersion, status: ClaimStatus.Ready },
    })
    return this.toDomain(updated)
  }

  private toDomain(c: any): PublishableClaim {
    return {
      id: c.id,
      projectId: c.projectId,
      verificationId: c.verificationId,
      sourceActionId: c.sourceActionId,
      title: c.title,
      contentType: c.contentType as ClaimContentType,
      content: c.content,
      status: c.status as ClaimStatus,
      version: c.version,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }
  }
}
