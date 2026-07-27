/**
 * audit.repository.ts — AgentAuditTrail 数据访问层
 *
 * AR-01 Phase 1: Infrastructure
 * DP-5: Repository 只负责数据访问，不负责业务组装。
 */

import { prisma } from '../../utils/index.js'

export interface AuditQueryOptions {
  tenantId?: string
  agentId?: string
  skip: number
  take: number
}

export const auditRepository = {
  /**
   * 分页查询审计记录
   */
  async findMany(options: AuditQueryOptions) {
    const where: Record<string, string> = {}
    if (options.tenantId) where.tenantId = options.tenantId
    if (options.agentId) where.agentId = options.agentId

    const [rows, total] = await Promise.all([
      prisma.agentAuditTrail.findMany({
        where,
        skip: options.skip,
        take: options.take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.agentAuditTrail.count({ where }),
    ])

    return { rows, total }
  },
}
