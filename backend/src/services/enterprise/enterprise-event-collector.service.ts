/**
 * Enterprise Event Collector — Sprint 4.2.3.1
 * 
 * OperationEvent 覆盖增强。
 * CTO 要求: 任何重要动作自动进入 OperationEvent。
 * 
 * 覆盖事件类型:
 *   user.login / user.logout / user.tier_change
 *   tenant.created / tenant.governance_linked
 *   channel.connected / channel.disconnected / channel.expired
 *   action.approved / action.rejected / action.completed / action.verified
 *   approval.granted / approval.revoked
 *   permission.checked / permission.denied
 */

import { PrismaClient } from '@prisma/client'
import { governanceAuditService } from './governance-audit.service.js'

const prisma = new PrismaClient()

const ENTERPRISE_EVENT_COLLECTORS = [
  { source: 'user', events: ['login', 'logout', 'tier_change'] },
  { source: 'tenant', events: ['created', 'governance_linked'] },
  { source: 'channel', events: ['connected', 'disconnected', 'expired'] },
  { source: 'action', events: ['approved', 'rejected', 'completed', 'verified'] },
  { source: 'approval', events: ['granted', 'revoked'] },
  { source: 'permission', events: ['checked', 'denied'] },
] as const

export interface EnterpriseEvent {
  tenantId: string
  eventType: string
  actorType: string
  actorId: string
  actorName?: string
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
}

export class EnterpriseEventCollector {
  /**
   * 收集一条企业事件
   * 写入 enterprise_operation_event（带 governanceTenantId 双写）
   * 同步写入 governance_audit_log
   */
  async collect(event: EnterpriseEvent, governanceTenantId?: string | null): Promise<void> {
    const now = new Date()

    // 写入 Enterprise OperationEvent
    await prisma.enterpriseOperationEvent.create({
      data: {
        tenantId: event.tenantId,
        governanceTenantId: governanceTenantId || null,
        eventType: event.eventType,
        actorType: event.actorType,
        actorId: event.actorId,
        actorName: event.actorName,
        targetType: event.targetType,
        targetId: event.targetId,
        metadata: JSON.stringify(event.metadata || {}),
        createdAt: now,
      },
    })

    // 同步 Governance AuditLog
    if (governanceTenantId) {
      await governanceAuditService.log({
        governanceTenantId,
        actorId: event.actorId,
        actorType: event.actorType,
        action: event.eventType,
        targetType: event.targetType || 'system',
        targetId: event.targetId || 'none',
        metadata: event.metadata || {},
      })
    }
  }

  /**
   * 查找所有支持的事件类型
   */
  getSupportedEvents(): string[] {
    return ENTERPRISE_EVENT_COLLECTORS.flatMap(collector =>
      collector.events.map(event => `${collector.source}.${event}`)
    )
  }
}

export const enterpriseEventCollector = new EnterpriseEventCollector()
