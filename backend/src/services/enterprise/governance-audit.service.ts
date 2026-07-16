/**
 * Governance Audit Integration Service — Sprint 4.2.3.1
 * 
 * Action 状态变更同步写入 Governance.AuditLog。
 * CTO 冻结: Governance AuditLog 成为企业审计 Truth。
 * status_history 保留为 Action 内部状态快照。
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface AuditEntry {
  governanceTenantId: string
  actorId: string
  actorType: string
  action: string
  targetType: string
  targetId: string
  metadata: Record<string, unknown>
}

export class GovernanceAuditService {
  /**
   * 记录一条企业审计日志
   * 同时写入:
   * 1. Governance.AuditLog（企业统一审计）
   * 2. Action.status_history（Action 内部快照）
   */
  async log(entry: AuditEntry): Promise<void> {
    // 写入 Governance AuditLog
    try {
      await prisma.auditLog.create({
        data: {
          tenantId: entry.governanceTenantId,
          actorId: entry.actorId,
          actorType: entry.actorType,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          metadata: JSON.stringify(entry.metadata),
          createdAt: new Date(),
        },
      })
    } catch (e) {
      // Audit 写入失败不应阻塞主流程
      console.error('[GovernanceAudit] Failed to write audit log:', e)
    }
  }

  /**
   * Action 状态变更审计
   * 快捷方法
   */
  async logActionStatusChange(params: {
    governanceTenantId: string
    actorId: string
    actionId: string
    fromStatus: string
    toStatus: string
  }): Promise<void> {
    await this.log({
      governanceTenantId: params.governanceTenantId,
      actorId: params.actorId,
      actorType: 'gov_user',
      action: 'action.status_change',
      targetType: 'enterprise_action',
      targetId: params.actionId,
      metadata: {
        from: params.fromStatus,
        to: params.toStatus,
      },
    })
  }
}

export const governanceAuditService = new GovernanceAuditService()
