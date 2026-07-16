/**
 * Enterprise AI Workforce — Agent Audit Trail Service
 * Agent 行为审计追踪
 */
import { prisma } from '../../utils/index.js'

export interface AuditLogEntry {
  tenantId: string
  agentId?: string
  taskId?: string
  action: string
  resource?: string
  resourceId?: string
  llmConfigId?: string
  tokenUsage?: number
  cost?: number
  inputSummary?: string
  outputSummary?: string
  durationMs?: number
  approvalStatus?: string
  metadata?: Record<string, any>
}

export class AgentAuditService {
  /**
   * 记录一条审计日志
   */
  async log(entry: AuditLogEntry) {
    return await prisma.agentAuditTrail.create({
      data: {
        tenantId: entry.tenantId,
        agentId: entry.agentId || null,
        taskId: entry.taskId || null,
        action: entry.action,
        resource: entry.resource || null,
        resourceId: entry.resourceId || null,
        llmConfigId: entry.llmConfigId || null,
        tokenUsage: entry.tokenUsage || 0,
        cost: entry.cost || 0,
        inputSummary: entry.inputSummary || null,
        outputSummary: entry.outputSummary || null,
        durationMs: entry.durationMs || 0,
        approvalStatus: entry.approvalStatus || 'auto_executed',
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : '{}',
      },
    })
  }

  /**
   * 查询审计日志（分页）
   */
  async list(tenantId: string, options?: { agentId?: string; limit?: number; offset?: number }) {
    const { agentId, limit = 50, offset = 0 } = options || {}
    const where: any = { tenantId }
    if (agentId) where.agentId = agentId

    const [items, total] = await Promise.all([
      prisma.agentAuditTrail.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.agentAuditTrail.count({ where }),
    ])

    return { items, total, limit, offset }
  }

  /**
   * 获取 Agent 汇总统计
   */
  async getAgentStats(tenantId: string, agentId: string) {
    const stats = await prisma.agentAuditTrail.aggregate({
      where: { tenantId, agentId },
      _sum: { tokenUsage: true, cost: true, durationMs: true },
      _count: { id: true },
    })
    return {
      totalCalls: stats._count.id,
      totalTokens: stats._sum.tokenUsage || 0,
      totalCost: stats._sum.cost || 0,
      totalDurationMs: stats._sum.durationMs || 0,
    }
  }
}

export const agentAuditService = new AgentAuditService()
