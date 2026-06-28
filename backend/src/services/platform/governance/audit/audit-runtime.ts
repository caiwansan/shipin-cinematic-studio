// ============================================================
// Audit Runtime — KMKI-PLAT-012
// Audit logs are immutable — never deleted
// ============================================================

import { auditRepository } from '../repositories/audit.repository.js'
import { platformEventBus } from '@platform/events/event-bus.js'
import { createAuditLoggedEvent } from '../events/governance-events.js'
import type { AuditLogDTO, AuditQueryFilter } from '../types.js'

export class AuditRuntime {
  async log(action: string, tenantId: string, resource: string, resourceId?: string, details?: Record<string, any>, userId?: string): Promise<AuditLogDTO> {
    const log = await auditRepository.log({
      tenantId,
      userId,
      action,
      resource,
      resourceId,
      details,
    })
    platformEventBus.emit(createAuditLoggedEvent(tenantId, { action, resource, resourceId }))
    return log
  }

  async queryAudit(filter: AuditQueryFilter): Promise<{ items: AuditLogDTO[]; total: number }> {
    return auditRepository.query(filter)
  }

  async getRecent(tenantId: string, limit = 20): Promise<AuditLogDTO[]> {
    return auditRepository.getRecentByTenant(tenantId, limit)
  }
}

export const auditRuntime = new AuditRuntime()
