// ════════════════════════════════════════════════════════════
// ClaimRepository — PublishableClaim 纯 CRUD
// ════════════════════════════════════════════════════════════
// Repository Boundary: 只有 CRUD 方法，无业务逻辑

import { PrismaClient } from '@prisma/client'

export class ClaimRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    projectId: string
    verificationId?: string
    sourceActionId?: string
    title: string
    contentType: string
    content: string
    status: string
    version: string
  }) {
    return this.prisma.publishableClaim.create({ data })
  }

  async findById(id: string) {
    return this.prisma.publishableClaim.findUnique({ where: { id } })
  }

  async findByProject(projectId: string) {
    return this.prisma.publishableClaim.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findByVerification(verificationId: string) {
    return this.prisma.publishableClaim.findMany({
      where: { verificationId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async update(id: string, data: Record<string, any>) {
    return this.prisma.publishableClaim.update({ where: { id }, data })
  }

  async delete(id: string) {
    return this.prisma.publishableClaim.delete({ where: { id } })
  }
}
