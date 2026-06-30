// ════════════════════════════════════════════════════════════
// P3 Service: PlanService — PublishPlan lifecycle
// ════════════════════════════════════════════════════════════
// Phase 3 — No Vue, no CMS, no UI

import { PrismaClient } from '@prisma/client'
import { PublishPlan, PlanStatus, CreatePlanDTO } from '../types'

export class PlanService {
  constructor(private prisma: PrismaClient) {}

  async create(dto: CreatePlanDTO): Promise<PublishPlan> {
    const plan = await this.prisma.publishPlan.create({
      data: {
        projectId: dto.projectId,
        title: dto.title,
        status: PlanStatus.Draft,
        targetChannels: JSON.parse(JSON.stringify(dto.targetChannels)),
        executionOrder: dto.executionOrder ? JSON.parse(dto.executionOrder) : undefined,
        claims: {
          create: dto.claimIds.map(claimId => ({
            claim: { connect: { id: claimId } },
          })),
        },
      },
      include: { claims: true },
    })
    return this.toDomain(plan)
  }

  async getById(id: string): Promise<PublishPlan | null> {
    const p = await this.prisma.publishPlan.findUnique({
      where: { id },
      include: { claims: { include: { claim: true } } },
    })
    return p ? this.toDomainWithClaims(p) : null
  }

  async listByProject(projectId: string): Promise<PublishPlan[]> {
    const plans = await this.prisma.publishPlan.findMany({
      where: { projectId },
      include: { claims: { include: { claim: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return plans.map(p => this.toDomainWithClaims(p))
  }

  async updateStatus(id: string, status: PlanStatus): Promise<PublishPlan> {
    const plan = await this.prisma.publishPlan.findUnique({ where: { id } })
    if (!plan) throw new Error(`Plan ${id} not found`)

    this.validateTransition(plan.status as PlanStatus, status)

    const data: any = { status }
    if (status === PlanStatus.Published) {
      data.publishedAt = new Date()
    }

    const updated = await this.prisma.publishPlan.update({
      where: { id },
      data,
      include: { claims: { include: { claim: true } } },
    })
    return this.toDomainWithClaims(updated)
  }

  async addClaims(id: string, claimIds: string[]): Promise<PublishPlan> {
    const plan = await this.prisma.publishPlan.findUnique({ where: { id } })
    if (!plan) throw new Error(`Plan ${id} not found`)
    if (plan.status !== PlanStatus.Draft && plan.status !== PlanStatus.InReview) {
      throw new Error(`Cannot add claims to plan in status ${plan.status}`)
    }

    await this.prisma.publishPlanToClaim.createMany({
      data: claimIds.map(claimId => ({ planId: id, claimId })),
      skipDuplicates: true,
    })

    return this.getById(id) as Promise<PublishPlan>
  }

  async removeClaim(id: string, claimId: string): Promise<PublishPlan> {
    await this.prisma.publishPlanToClaim.delete({
      where: { planId_claimId: { planId: id, claimId } },
    })
    return this.getById(id) as Promise<PublishPlan>
  }

  async delete(id: string): Promise<void> {
    const plan = await this.prisma.publishPlan.findUnique({ where: { id } })
    if (!plan) return
    if (plan.status === PlanStatus.Published) {
      throw new Error(`Cannot delete published plan ${id}`)
    }
    await this.prisma.publishPlan.delete({ where: { id } })
  }

  async incrementVersion(id: string): Promise<PublishPlan> {
    await this.prisma.publishPlan.update({
      where: { id },
      data: { status: PlanStatus.Draft },
    })
    return this.getById(id) as Promise<PublishPlan>
  }

  // ── Valid transitions ──
  private validateTransition(from: PlanStatus, to: PlanStatus): void {
    const allowed: Record<string, PlanStatus[]> = {
      [PlanStatus.Draft]: [PlanStatus.InReview],
      [PlanStatus.InReview]: [PlanStatus.Approved, PlanStatus.Draft],
      [PlanStatus.Approved]: [PlanStatus.Published, PlanStatus.Draft],
      [PlanStatus.Published]: [PlanStatus.RolledBack],
      [PlanStatus.RolledBack]: [PlanStatus.Draft],
    }
    const next = allowed[from]
    if (!next || !next.includes(to)) {
      throw new Error(`Illegal transition: ${from} → ${to}`)
    }
  }

  private toDomain(p: any): PublishPlan {
    return {
      id: p.id,
      projectId: p.projectId,
      title: p.title,
      claimIds: (p.claims || []).map((pc: any) => pc.claimId),
      targetChannels: (p as any).targetChannels || [],
      executionOrder: (p as any).executionOrder ? JSON.stringify(p.executionOrder) : undefined,
      status: p.status as PlanStatus,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      publishedAt: p.publishedAt?.toISOString(),
    }
  }

  private toDomainWithClaims(p: any): PublishPlan {
    return {
      ...this.toDomain(p),
      claimIds: (p.claims || []).map((pc: any) => pc.claim?.id || pc.claimId),
    }
  }
}
