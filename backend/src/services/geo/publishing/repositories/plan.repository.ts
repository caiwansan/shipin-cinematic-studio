// ════════════════════════════════════════════════════════════
// PlanRepository — PublishPlan 纯 CRUD
// ════════════════════════════════════════════════════════════
// Repository Boundary: 只有 CRUD 方法，无业务逻辑

import { PrismaClient } from '@prisma/client'

export class PlanRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: Record<string, any>) {
    return this.prisma.publishPlan.create({ data, include: { claims: true } })
  }

  async findById(id: string) {
    return this.prisma.publishPlan.findUnique({
      where: { id },
      include: { claims: { include: { claim: true } } },
    })
  }

  async findByProject(projectId: string) {
    return this.prisma.publishPlan.findMany({
      where: { projectId },
      include: { claims: { include: { claim: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async update(id: string, data: Record<string, any>) {
    return this.prisma.publishPlan.update({
      where: { id },
      data,
      include: { claims: { include: { claim: true } } },
    })
  }

  async delete(id: string) {
    return this.prisma.publishPlan.delete({ where: { id } })
  }

  // ── 关联表操作 ──

  async createClaimLinks(planId: string, claimIds: string[]) {
    return this.prisma.publishPlanToClaim.createMany({
      data: claimIds.map(claimId => ({ planId, claimId })),
      skipDuplicates: true,
    })
  }

  async deleteClaimLink(planId: string, claimId: string) {
    return this.prisma.publishPlanToClaim.delete({
      where: { planId_claimId: { planId, claimId } },
    })
  }
}
