/**
 * runtime.mapper.ts — EnterpriseAgentInstance → RuntimeDTO 映射
 *
 * AR-01 Phase 3: Relationship Domain
 * DP-4: Mapper 是唯一允许跨 Domain 组装数据的地方。
 * DP-2: Instance 是 Runtime 实例，Profile 是业务身份。
 *
 * 数据来源（Repository 已执行查询 + 内存组装）：
 *   - name/agentType → EnterpriseAgentProfile（通过 employeeId 手动关联）
 *   - lifecycleState/runtimeStatus → EnterpriseAgentInstance 直接字段
 *
 * 注意：Mapper 只做字段映射，不执行任何查询。
 *       agentType 永远来自 Profile，lifecycleState 永远来自 Instance。
 */

export interface RuntimeDTO {
  id: string
  tenantId: string
  name: string
  agentType: string
  lifecycleState: string
  runtimeStatus: string
  lastRecoveredAt: Date | null
  totalTasks: number
  totalErrors: number
  updatedAt: Date
}

export interface RuntimeResponse {
  list: RuntimeDTO[]
  byState: Record<string, number>
  total: number
}

/**
 * 将 Repository 返回的 RuntimeRow 映射为 RuntimeDTO
 *
 * 注意：Mapper 只做字段映射，不执行查询。
 */
export function mapRuntimeToDTO(row: {
  id: string
  tenantId: string
  lifecycleState: string
  runtimeStatus: string
  lastRecoveredAt: Date | null
  totalTasks: number
  totalErrors: number
  updatedAt: Date
  profileName: string | null
  profileAgentType: string | null
}): RuntimeDTO {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.profileName ?? 'Unknown',
    agentType: row.profileAgentType ?? 'unknown',
    lifecycleState: row.lifecycleState,
    runtimeStatus: row.runtimeStatus,
    lastRecoveredAt: row.lastRecoveredAt,
    totalTasks: row.totalTasks,
    totalErrors: row.totalErrors,
    updatedAt: row.updatedAt,
  }
}

export function mapRuntimeListToDTOList(
  rows: Parameters<typeof mapRuntimeToDTO>[0][]
): RuntimeDTO[] {
  return rows.map(mapRuntimeToDTO)
}
