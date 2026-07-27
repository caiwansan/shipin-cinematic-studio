/**
 * Code Governance Bridge — ER-05-TASK-02
 * Git Commit → Architecture Review → Audit Record → Enterprise Governance Log
 *
 * 职责: 将代码变更纳入企业治理审计
 * 架构: 只读监控 (不直接控制代码执行)
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../../utils/index.js'

// ─── Types ───────────────────────────────────────────────

export interface CodeChangeRecord {
  id: string
  organizationId: string
  agentId: string  // 执行变更的 Agent
  changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'REVIEW'
  targetFile: string
  description: string
  reviewStatus: 'pending' | 'approved' | 'rejected'
  auditTrail: string[]  // 审计链
  createdAt: string
}

// ─── Service ─────────────────────────────────────────────

export class CodeGovernanceService {

  /**
   * 记录代码变更
   */
  async recordChange(change: {
    organizationId: string
    agentId: string
    changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'REVIEW'
    targetFile: string
    description: string
  }): Promise<CodeChangeRecord> {
    const record: CodeChangeRecord = {
      id: `code-${Date.now()}`,
      organizationId: change.organizationId,
      agentId: change.agentId,
      changeType: change.changeType,
      targetFile: change.targetFile,
      description: change.description,
      reviewStatus: 'pending',
      auditTrail: [`[${new Date().toISOString()}] Change recorded by ${change.agentId}`],
      createdAt: new Date().toISOString(),
    }

    // 存储到 AgentAuditTrail（FK 保护：agentId 不存在时置空）
    let safeAgentId = change.agentId || null
    if (safeAgentId) {
      const agentExists = await prisma.enterpriseAgentProfile.findUnique({
        where: { id: safeAgentId },
        select: { id: true },
      })
      if (!agentExists) safeAgentId = null
    }
    const createData: Record<string, unknown> = {
      action: `CODE_${change.changeType}`,
      inputSummary: `${change.targetFile}: ${change.description}`,
      approvalStatus: 'pending',
      metadata: JSON.stringify({ targetFile: change.targetFile, description: change.description }),
    }
    if (safeAgentId) createData.agentId = safeAgentId
    await prisma.agentAuditTrail.create({ data: createData as any })

    return record
  }

  /**
   * 审核代码变更
   */
  async reviewChange(changeId: string, review: {
    status: 'approved' | 'rejected'
    reviewer: string
    reason: string
  }): Promise<CodeChangeRecord | null> {
    // 更新审计记录
    const auditRecord = await prisma.agentAuditTrail.findFirst({
      where: { action: { startsWith: 'CODE_' } },
      orderBy: { createdAt: 'desc' },
    })

    if (!auditRecord) return null

    await prisma.agentAuditTrail.update({
      where: { id: auditRecord.id },
      data: {
        approvalStatus: review.status,
        metadata: JSON.stringify({
          ...JSON.parse(auditRecord.metadata || '{}'),
          approvedBy: review.reviewer,
          approvalNote: review.reason,
        }),
      },
    })

    return {
      id: changeId,
      organizationId: '',
      agentId: auditRecord.agentId || '',
      changeType: auditRecord.action.replace('CODE_', '') as any,
      targetFile: '',
      description: auditRecord.inputSummary || '',
      reviewStatus: review.status,
      auditTrail: [
        `[${new Date().toISOString()}] Reviewed by ${review.reviewer}: ${review.status}`,
        `[${new Date().toISOString()}] Reason: ${review.reason}`,
      ],
      createdAt: auditRecord.createdAt.toISOString(),
    }
  }

  /**
   * 获取待审核变更
   */
  async getPendingChanges(organizationId: string): Promise<CodeChangeRecord[]> {
    const pendingAudits = await prisma.agentAuditTrail.findMany({
      where: {
        approvalStatus: 'pending',
        action: { startsWith: 'CODE_' },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return pendingAudits.map((a) => ({
      id: a.id,
      organizationId,
      agentId: a.agentId || '',
      changeType: a.action.replace('CODE_', '') as any,
      targetFile: '',
      description: a.inputSummary || '',
      reviewStatus: 'pending',
      auditTrail: [`[${a.createdAt.toISOString()}] Change recorded`],
      createdAt: a.createdAt.toISOString(),
    }))
  }
}

export const codeGovernanceService = new CodeGovernanceService()
