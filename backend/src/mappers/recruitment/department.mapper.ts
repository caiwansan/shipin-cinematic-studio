/**
 * department.mapper.ts — 部门（企业工作空间）数据组装
 *
 * AR-01 Phase 4: Department 模块领域化
 * 将 Repository 原始数据组装为 DepartmentDTO
 */

import type { DepartmentRawData } from '../../repositories/recruitment/department.repository.js'

// ─── DTO 定义 ───

export interface DepartmentDTO {
  id: string
  name: string
  plan: string
  status: string
  createdAt: string
  pipelines: number
  conversations: number
  interviews: number
  campaigns: number
  aiEmployees: number
  aiActive: number
}

// ─── Mapper ───

export function mapDepartmentListToDTOList(rawList: DepartmentRawData[]): DepartmentDTO[] {
  return rawList.map((item) => ({
    id: item.id,
    name: item.name,
    plan: item.plan,
    status: item.status,
    createdAt: new Date(item.createdAt).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    pipelines: item.pipelines,
    conversations: item.conversations,
    interviews: item.interviews,
    campaigns: item.campaigns,
    aiEmployees: item.aiEmployees,
    aiActive: item.aiActive,
  }))
}
