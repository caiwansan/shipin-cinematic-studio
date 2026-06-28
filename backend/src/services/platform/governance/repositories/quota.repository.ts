// ============================================================
// Quota Repository — KMKI-PLAT-012
// ============================================================

import { getPrisma } from './base.js'
import type { QuotaDTO } from '../types.js'

export class QuotaRepository {
  async init(tenantId: string, defaults?: Partial<QuotaDTO>): Promise<QuotaDTO> {
    const prisma = getPrisma()
    const quota = await prisma.quota.upsert({
      where: { tenantId },
      create: {
        tenantId,
        dailyTokens: defaults?.dailyTokens ?? 1000,
        monthlyTokens: defaults?.monthlyTokens ?? 50000,
        imageCredits: defaults?.imageCredits ?? 100,
        videoMinutes: defaults?.videoMinutes ?? 30,
        speechMinutes: defaults?.speechMinutes ?? 60,
        concurrentJobs: defaults?.concurrentJobs ?? 1,
        workflowRuns: defaults?.workflowRuns ?? 10,
        agentSessions: defaults?.agentSessions ?? 5,
        storage: defaults?.storage ?? 500,
        workspaceCount: defaults?.workspaceCount ?? 1,
      },
      update: {},
    })
    return this.toDTO(quota)
  }

  async findByTenant(tenantId: string): Promise<QuotaDTO | null> {
    const prisma = getPrisma()
    const quota = await prisma.quota.findUnique({ where: { tenantId } })
    return quota ? this.toDTO(quota) : null
  }

  async update(tenantId: string, data: Partial<QuotaDTO>): Promise<QuotaDTO> {
    const prisma = getPrisma()
    const updateData: any = { ...data }
    delete updateData.id
    delete updateData.tenantId
    delete updateData.createdAt
    const quota = await prisma.quota.update({ where: { tenantId }, data: updateData })
    return this.toDTO(quota)
  }

  private toDTO(q: any): QuotaDTO {
    return {
      id: q.id,
      tenantId: q.tenantId,
      dailyTokens: q.dailyTokens,
      monthlyTokens: q.monthlyTokens,
      imageCredits: q.imageCredits,
      videoMinutes: q.videoMinutes,
      speechMinutes: q.speechMinutes,
      concurrentJobs: q.concurrentJobs,
      workflowRuns: q.workflowRuns,
      agentSessions: q.agentSessions,
      storage: q.storage,
      workspaceCount: q.workspaceCount,
      metadata: q.metadata ? JSON.parse(q.metadata) : undefined,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    }
  }
}

export const quotaRepository = new QuotaRepository()
