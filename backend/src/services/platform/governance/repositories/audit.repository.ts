// ============================================================
// AuditLog Repository — KMKI-PLAT-012
// ============================================================

import { getPrisma } from './base.js'
import type { AuditLogDTO, AuditQueryFilter } from '../types.js'

export class AuditRepository {
  async log(data: {
    tenantId: string; userId?: string; action: string; resource: string;
    resourceId?: string; details?: Record<string, any>; ipAddress?: string;
    userAgent?: string; metadata?: Record<string, any>
  }): Promise<AuditLogDTO> {
    const prisma = getPrisma()
    const log = await prisma.auditLog.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        details: data.details ? JSON.stringify(data.details) : null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    })
    return this.toDTO(log)
  }

  async query(filter: AuditQueryFilter): Promise<{ items: AuditLogDTO[]; total: number }> {
    const prisma = getPrisma()
    const where: any = { tenantId: filter.tenantId }
    if (filter.action) where.action = filter.action
    if (filter.resource) where.resource = filter.resource
    if (filter.userId) where.userId = filter.userId
    if (filter.fromDate || filter.toDate) {
      where.createdAt = {}
      if (filter.fromDate) where.createdAt.gte = filter.fromDate
      if (filter.toDate) where.createdAt.lte = filter.toDate
    }
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filter.limit ?? 50,
        skip: filter.offset ?? 0,
      }),
      prisma.auditLog.count({ where }),
    ])
    return { items: items.map(this.toDTO), total }
  }

  async getRecentByTenant(tenantId: string, limit = 20): Promise<AuditLogDTO[]> {
    const prisma = getPrisma()
    const logs = await prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return logs.map(this.toDTO)
  }

  private toDTO(l: any): AuditLogDTO {
    return {
      id: l.id,
      tenantId: l.tenantId,
      userId: l.userId || undefined,
      action: l.action,
      resource: l.resource,
      resourceId: l.resourceId || undefined,
      details: l.details ? JSON.parse(l.details) : undefined,
      ipAddress: l.ipAddress || undefined,
      userAgent: l.userAgent || undefined,
      metadata: l.metadata ? JSON.parse(l.metadata) : undefined,
      createdAt: l.createdAt,
    }
  }
}

export const auditRepository = new AuditRepository()
