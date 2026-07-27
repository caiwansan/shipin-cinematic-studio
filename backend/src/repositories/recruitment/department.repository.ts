/**
 * department.repository.ts — 部门（企业工作空间）数据访问层
 *
 * AR-01 Phase 4: Department 模块领域化
 *
 * 注意：这里的"部门"实际是 EnterpriseJobWorkspace（企业工作空间）
 * 每个 workspace 对应一个企业的招聘部门
 *
 * Schema 现实：
 * - EnterpriseJobWorkspace 有 enterpriseId, name, plan, status
 * - 通过 workspace._count 获取关联数据统计
 * - EnterpriseAgentInstance.tenantId = enterpriseId（不是 workspaceId）
 */

import { prisma } from '../../utils/index.js'

export interface DepartmentListQuery {
  page: number
  pageSize: number
}

export interface DepartmentRawData {
  id: string
  name: string
  plan: string
  status: string
  createdAt: Date
  pipelines: number
  conversations: number
  interviews: number
  campaigns: number
  aiEmployees: number
  aiActive: number
}

export const departmentRepository = {
  async findList(query: DepartmentListQuery): Promise<{ list: DepartmentRawData[]; total: number }> {
    const { page, pageSize } = query
    const skip = (page - 1) * pageSize

    const [workspaces, total] = await Promise.all([
      prisma.enterpriseJobWorkspace.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              recruitmentPipelines: true,
              recruitmentConversations: true,
              interviewSessions: true,
              recruitmentCampaigns: true,
            },
          },
        },
      }),
      prisma.enterpriseJobWorkspace.count(),
    ])

    // 获取每个 workspace 对应企业的 AI 员工状态
    // tenantId = enterpriseId（不是 workspaceId）
    const list: DepartmentRawData[] = await Promise.all(
      workspaces.map(async (ws) => {
        const instances = await prisma.enterpriseAgentInstance.findMany({
          where: { tenantId: ws.enterpriseId },
          select: { lifecycleState: true },
        })
        const active = instances.filter((i) => i.lifecycleState === 'ACTIVE').length
        return {
          id: ws.id,
          name: ws.name,
          plan: ws.plan,
          status: ws.status,
          createdAt: ws.createdAt,
          pipelines: ws._count.recruitmentPipelines,
          conversations: ws._count.recruitmentConversations,
          interviews: ws._count.interviewSessions,
          campaigns: ws._count.recruitmentCampaigns,
          aiEmployees: instances.length,
          aiActive: active,
        }
      })
    )

    return { list, total }
  },
}
