// ============================================================
// AgentAccessResolver — M1-A1
// 解析组织下的 AI 员工（Agent）访问权限
// 对接 enterprise_agent_instance + enterprise_agent_profile
// ============================================================

import { prisma } from '../../../utils/index.js'
import type { AgentAccessDTO, AgentProfileDTO } from '../types.js'

export interface AgentAccessConfig {
  /** 是否启用 Agent 功能 */
  enabled: boolean
  /** Agent 数量上限 */
  maxAgents: number
}

export class AgentAccessResolver {
  /**
   * 通过组织 ID 解析 Agent 访问权限
   * 查询 enterprise_agent_instance 表
   */
  async resolveByOrganizationId(organizationId: string, maxAgents = 20): Promise<AgentAccessDTO> {
    // 查询活跃 Agent 实例
    const instances = await prisma.enterpriseAgentInstance.findMany({
      where: {
        tenantId: organizationId,
        status: 'active',
      },
      include: {
        profile: {
          select: {
            id: true,
            name: true,
            role: true,
            status: true,
            agentType: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const agentProfiles: AgentProfileDTO[] = instances
      .filter(i => i.profile)
      .map(i => ({
        id: i.profile!.id,
        name: i.profile!.name,
        role: i.profile!.role,
        status: i.profile!.status,
        agentType: i.profile!.agentType,
      }))

    return {
      enabled: true,
      maxAgents,
      activeAgents: instances.length,
      agentProfiles,
    }
  }

  /**
   * 通过 Governance TenantId 解析
   */
  async resolveByTenantId(tenantId: string, maxAgents = 20): Promise<AgentAccessDTO> {
    // 先找组织
    const org = await prisma.govOrganization.findFirst({
      where: { tenantId },
    })
    if (!org) {
      return { enabled: false, maxAgents: 0, activeAgents: 0, agentProfiles: [] }
    }

    return this.resolveByOrganizationId(org.id, maxAgents)
  }

  /**
   * 检查是否可创建新 Agent
   */
  canCreateAgent(access: AgentAccessDTO): boolean {
    return access.enabled && access.activeAgents < access.maxAgents
  }

  /**
   * 获取 Agent 摘要信息
   */
  getSummary(access: AgentAccessDTO): string {
    if (!access.enabled) return 'Agent 功能未启用'
    return `${access.activeAgents}/${access.maxAgents} 个 AI 员工在线`
  }
}

export const agentAccessResolver = new AgentAccessResolver()
