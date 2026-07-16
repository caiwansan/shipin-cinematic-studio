/**
 * Outcome Service — Sprint 4.2.4-A
 * 职责: Outcome CRUD (Contract 1/2/3)
 * CTO 冻结: Outcome 是结构化事实层，不是 Revenue
 * CTO: Action COMPLETED → Outcome Required
 */
import { prisma } from '../../../utils/index.js'
import { governanceAuditService } from '../governance-audit.service.js'

export interface CreateOutcomeInput {
  tenantId: string
  governanceTenantId?: string | null
  actionId: string
  outcomeType?: string
  sourceType?: string
  status?: string
  summary?: string
  evidence?: any[]
  impactType?: string
  impactLevel?: number
  impactMetric?: string
  impactValue?: string
  impactSource?: string
  occurredAt?: Date
}

export interface UpdateOutcomeInput {
  outcomeType?: string
  summary?: string
  evidence?: any[]
  impactType?: string
  impactLevel?: number
  impactMetric?: string
  impactValue?: string
  impactSource?: string
  occurredAt?: Date
}

export class OutcomeService {
  /**
   * 创建 Outcome
   * CTO: Action COMPLETED 后必须创建 Outcome
   */
  async createOutcome(input: CreateOutcomeInput) {
    const now = new Date()
    return prisma.enterpriseOutcome.create({
      data: {
        tenantId: input.tenantId,
        governanceTenantId: input.governanceTenantId,
        actionId: input.actionId,
        outcomeType: input.outcomeType || 'OPERATIONAL',
        sourceType: input.sourceType || 'HUMAN',
        status: input.status || 'PENDING_VERIFY',
        summary: input.summary,
        evidence: input.evidence ? JSON.stringify(input.evidence) : '[]',
        impactType: input.impactType,
        impactLevel: input.impactLevel,
        impactMetric: input.impactMetric,
        impactValue: input.impactValue,
        impactSource: input.impactSource || 'manual',
        occurredAt: input.occurredAt || now,
        createdAt: now,
        updatedAt: now,
      },
    })
  }

  /**
   * 查询 Outcome (通过 actionId)
   */
  async getOutcomeByActionId(actionId: string) {
    return prisma.enterpriseOutcome.findUnique({
      where: { actionId },
    })
  }

  /**
   * 查询 Outcome (通过 id)
   */
  async getOutcomeById(id: string) {
    return prisma.enterpriseOutcome.findUnique({
      where: { id },
    })
  }

  /**
   * 查询租户下所有 Outcome
   */
  async listOutcomes(tenantId: string, params?: { status?: string; outcomeType?: string; limit?: number }) {
    return prisma.enterpriseOutcome.findMany({
      where: {
        tenantId,
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.outcomeType ? { outcomeType: params.outcomeType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: params?.limit || 50,
    })
  }

  /**
   * 更新 Outcome
   * CTO: 不允许通过 update 修改 status (用专门的 verify/reject/invalid)
   */
  async updateOutcome(id: string, input: UpdateOutcomeInput) {
    return prisma.enterpriseOutcome.update({
      where: { id },
      data: {
        ...input,
        evidence: input.evidence ? JSON.stringify(input.evidence) : undefined,
        updatedAt: new Date(),
      },
    })
  }

  /**
   * 确认 Outcome 有效
   * 状态: PENDING_VERIFY → VERIFIED
   */
  async verifyOutcome(id: string) {
    const now = new Date()
    const outcome = await prisma.enterpriseOutcome.update({
      where: { id },
      data: {
        status: 'VERIFIED',
        verifiedAt: now,
        updatedAt: now,
      },
    })

    // Audit
    await governanceAuditService.log({
      governanceTenantId: outcome.governanceTenantId || '',
      actorId: 'system',
      actorType: 'user',
      action: 'outcome.verified',
      targetType: 'enterprise_outcome',
      targetId: id,
      metadata: { status: 'VERIFIED' },
    })

    return outcome
  }

  /**
   * 拒绝 Outcome
   * 状态: PENDING_VERIFY → REJECTED
   */
  async rejectOutcome(id: string) {
    const now = new Date()
    const outcome = await prisma.enterpriseOutcome.update({
      where: { id },
      data: {
        status: 'REJECTED',
        updatedAt: now,
      },
    })

    await governanceAuditService.log({
      governanceTenantId: outcome.governanceTenantId || '',
      actorId: 'system',
      actorType: 'user',
      action: 'outcome.rejected',
      targetType: 'enterprise_outcome',
      targetId: id,
      metadata: { status: 'REJECTED' },
    })

    return outcome
  }

  /**
   * 标记 Outcome 无效
   * 状态: → INVALID
   */
  async markInvalid(id: string) {
    const now = new Date()
    const outcome = await prisma.enterpriseOutcome.update({
      where: { id },
      data: {
        status: 'INVALID',
        updatedAt: now,
      },
    })

    await governanceAuditService.log({
      governanceTenantId: outcome.governanceTenantId || '',
      actorId: 'system',
      actorType: 'user',
      action: 'outcome.invalid',
      targetType: 'enterprise_outcome',
      targetId: id,
      metadata: { status: 'INVALID' },
    })

    return outcome
  }

  /**
   * 删除 Outcome
   */
  async deleteOutcome(id: string) {
    return prisma.enterpriseOutcome.delete({
      where: { id },
    })
  }
}

export const outcomeService = new OutcomeService()
