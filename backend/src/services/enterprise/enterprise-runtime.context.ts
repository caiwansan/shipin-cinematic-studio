/**
 * Enterprise AI Workforce — EnterpriseRuntimeContext
 * 企业级 Agent 运行时身份证
 *
 * 所有 Enterprise Agent 调用必须携带此对象
 * 包含：租户、组织、Agent身份、权限范围、溯源ID
 */

export interface EnterpriseRuntimeContext {
  tenantId: string
  organizationId?: string
  agentId?: string
  agentType: string
  taskType: string
  permissionScope: string[]
  knowledgeScope: string[]
  traceId: string
  userId?: string
  credentialOwner: 'enterprise' | 'kunlun' | 'user'
}

/**
 * 从 HDZ Task 构建 EnterpriseRuntimeContext
 */
export async function buildEnterpriseRuntimeContext(
  userId: string,
  projectId: string,
  taskId: string,
  agentType: string,
  taskType: string
): Promise<EnterpriseRuntimeContext | null> {
  const { prisma } = await import('../../utils/index.js')

  // 查询该用户是否有 enterprise 项目绑定
  const project = await prisma.hdzProject.findUnique({
    where: { id: projectId },
    select: { userId: true, metadata: true },
  })
  if (!project) return null

  // 查找用户的 enterprise organization
  const membership = await prisma.govOrganization.findFirst({
    where: {
      tenantId: { not: undefined },
      status: 'active',
    },
    select: { id: true, tenantId: true },
  })

  // 查找 Agent Profile
  const agent = await prisma.enterpriseAgentProfile.findFirst({
    where: {
      tenantId: membership?.tenantId || 'none',
      agentType,
      status: 'active',
    },
    select: { id: true, permissions: true, knowledgeScope: true, tools: true },
  })

  // 如果有企业身份，构建 RuntimeContext
  if (membership) {
    return {
      tenantId: membership.tenantId,
      organizationId: membership.id,
      agentId: agent?.id,
      agentType,
      taskType,
      permissionScope: agent?.permissions ? JSON.parse(agent.permissions) : ['read_own_data'],
      knowledgeScope: agent?.knowledgeScope ? JSON.parse(agent.knowledgeScope) : [],
      traceId: `trace_${taskId}_${Date.now()}`,
      userId,
      credentialOwner: 'enterprise',
    }
  }

  return null
}
