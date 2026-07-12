// ════════════════════════════════════════════════════════════
// RecorderRepository — PublishingRecord 纯 CRUD
// ════════════════════════════════════════════════════════════
// Repository Boundary: 只有 CRUD 方法，无业务逻辑

import { PrismaClient } from '@prisma/client'

export class RecorderRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: Record<string, any>) {
    return this.prisma.publishingRecord.create({ data })
  }

  async findById(id: string) {
    return this.prisma.publishingRecord.findUnique({ where: { id } })
  }

  async update(id: string, data: Record<string, any>) {
    return this.prisma.publishingRecord.update({ where: { id }, data })
  }

  async findByPlan(planId: string) {
    return this.prisma.publishingRecord.findMany({
      where: { planId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findByClaim(claimId: string) {
    return this.prisma.publishingRecord.findMany({
      where: { claimId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findPlansByProject(projectId: string) {
    return this.prisma.publishPlan.findMany({ where: { projectId } })
  }

  async findRecordsByProject(projectId: string) {
    return this.prisma.publishingRecord.findMany({
      where: { plan: { projectId } },
    })
  }
}
