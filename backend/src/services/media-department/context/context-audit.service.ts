// ============================================================
// Context Audit Service — M1-A1
// 记录 Context Resolution 的审计日志
// 对接 governance.audit_log 表
// ============================================================

import { prisma } from '../../../utils/index.js'
import type { ContextAuditEntry } from '../types.js'

export class ContextAuditService {
  /**
   * 记录一次 Context Resolution 事件
   * 写入 governance.audit_log 表
   */
  async logResolution(entry: ContextAuditEntry): Promise<void> {
    await prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        userId: entry.userId,
        action: entry.action,
        resource: 'media_department_context',
        resourceId: entry.organizationId,
        details: JSON.stringify({
          organizationId: entry.organizationId,
          resolutionTimeMs: entry.resolutionTimeMs,
          timestamp: entry.timestamp.toISOString(),
        }),
      },
    })
  }

  /**
   * 查询用户的 Context Resolution 历史
   */
  async queryByUser(userId: string, limit = 20): Promise<ContextAuditEntry[]> {
    const logs = await prisma.auditLog.findMany({
      where: {
        userId,
        action: 'context_resolved',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return logs.map(log => ({
      userId: log.userId || '',
      organizationId: log.resourceId || '',
      tenantId: log.tenantId,
      timestamp: log.createdAt,
      action: 'context_resolved',
      resolutionTimeMs: log.details ? JSON.parse(log.details).resolutionTimeMs || 0 : 0,
    }))
  }

  /**
   * 查询组织的 Context Resolution 统计
   */
  async queryByOrganization(organizationId: string, limit = 50): Promise<ContextAuditEntry[]> {
    const logs = await prisma.auditLog.findMany({
      where: {
        resourceId: organizationId,
        action: 'context_resolved',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return logs.map(log => ({
      userId: log.userId || '',
      organizationId: log.resourceId || '',
      tenantId: log.tenantId,
      timestamp: log.createdAt,
      action: 'context_resolved',
      resolutionTimeMs: log.details ? JSON.parse(log.details).resolutionTimeMs || 0 : 0,
    }))
  }
}

export const contextAuditService = new ContextAuditService()
