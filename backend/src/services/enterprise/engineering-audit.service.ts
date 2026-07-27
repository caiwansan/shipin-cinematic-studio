/**
 * Engineering Audit Trail — ER-05-TASK-03
 * Who changed what? Why? Which Agent? Which Decision? Which Approval?
 *
 * 职责: 完整的企业工程审计链
 * 架构: 只读聚合 (不修改 Runtime)
 */
import { prisma } from '../../utils/index.js'

// ─── Types ───────────────────────────────────────────────

export interface AuditEntry {
  id: string
  timestamp: string
  actor: string  // Agent ID or User
  actorType: 'agent' | 'user' | 'system'
  action: string
  target: string
  result: 'success' | 'failure' | 'pending'
  reason?: string
  approval?: {
    approver: string
    status: 'approved' | 'rejected' | 'pending'
    note?: string
  }
}

export interface AuditQuery {
  organizationId: string
  agentId?: string
  actorType?: 'agent' | 'user' | 'system'
  action?: string
  startDate?: string
  endDate?: string
  limit?: number
}

// ─── Service ─────────────────────────────────────────────

export class EngineeringAuditService {

  /**
   * 查询审计日志
   */
  async queryAudit(query: AuditQuery): Promise<AuditEntry[]> {
    const where: any = {}

    if (query.agentId) {
      where.agentId = query.agentId
    }

    if (query.action) {
      where.action = { contains: query.action }
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {}
      if (query.startDate) where.createdAt.gte = new Date(query.startDate)
      if (query.endDate) where.createdAt.lte = new Date(query.endDate)
    }

    const records = await prisma.agentAuditTrail.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit || 100,
    })

    return records.map((r) => ({
      id: r.id,
      timestamp: r.createdAt.toISOString(),
      actor: r.agentId,
      actorType: 'agent' as const,
      action: r.action,
      target: r.description || '',
      result: r.approvalStatus === 'approved' ? 'success' : r.approvalStatus === 'rejected' ? 'failure' : 'pending',
      reason: r.description,
      approval: r.approvedBy ? {
        approver: r.approvedBy,
        status: r.approvalStatus as any,
        note: r.approvalNote || undefined,
      } : undefined,
    }))
  }

  /**
   * 获取审计统计
   */
  async getAuditStats(organizationId: string, agentId?: string): Promise<{
    total: number
    byAction: Record<string, number>
    byResult: Record<string, number>
    pendingApprovals: number
  }> {
    const where: any = {}
    if (agentId) where.agentId = agentId

    const records = await prisma.agentAuditTrail.findMany({ where })

    const byAction: Record<string, number> = {}
    const byResult: Record<string, number> = {}
    let pendingApprovals = 0

    for (const r of records) {
      byAction[r.action] = (byAction[r.action] || 0) + 1
      const result = r.approvalStatus === 'approved' ? 'success' : r.approvalStatus === 'rejected' ? 'failure' : 'pending'
      byResult[result] = (byResult[result] || 0) + 1
      if (r.approvalStatus === 'pending') pendingApprovals++
    }

    return {
      total: records.length,
      byAction,
      byResult,
      pendingApprovals,
    }
  }

  /**
   * 导出审计报告
   */
  async exportAuditReport(organizationId: string, options?: {
    startDate?: string
    endDate?: string
    format?: 'json' | 'csv'
  }): Promise<string> {
    const query: AuditQuery = { organizationId }
    if (options?.startDate) query.startDate = options.startDate
    if (options?.endDate) query.endDate = options.endDate

    const entries = await this.queryAudit(query)

    if (options?.format === 'csv') {
      const header = 'ID,Timestamp,Actor,ActorType,Action,Target,Result,Reason\n'
      const rows = entries.map((e) =>
        `${e.id},${e.timestamp},${e.actor},${e.actorType},${e.action},${e.target},${e.result},${e.reason || ''}`
      ).join('\n')
      return header + rows
    }

    return JSON.stringify(entries, null, 2)
  }
}

export const engineeringAuditService = new EngineeringAuditService()
