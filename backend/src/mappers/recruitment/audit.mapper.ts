/**
 * audit.mapper.ts — AgentAuditTrail → AuditDTO 映射
 *
 * AR-01 Phase 1: Infrastructure
 * DP-4: Mapper 是唯一允许跨 Domain 组装数据的地方。
 */

export interface AuditDTO {
  id: string
  action: string
  approvalStatus: string
  durationMs: number
  cost: number
  createdAt: Date
}

/**
 * 将 Prisma AgentAuditTrail 映射为 AuditDTO
 */
export function mapAuditToDTO(row: {
  id: string
  action: string
  approvalStatus: string
  durationMs: number
  cost: number
  createdAt: Date
}): AuditDTO {
  return {
    id: row.id,
    action: row.action,
    approvalStatus: row.approvalStatus,
    durationMs: row.durationMs,
    cost: row.cost,
    createdAt: row.createdAt,
  }
}

/**
 * 批量映射
 */
export function mapAuditListToDTOList(rows: Parameters<typeof mapAuditToDTO>[0][]): AuditDTO[] {
  return rows.map(mapAuditToDTO)
}
