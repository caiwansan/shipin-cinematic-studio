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
    select: { userId: true },
  })
  if (!project) return null

  // ① 先按用户 email 关联 govUser（tenantId 永不客户端决定/永不跨租户 findFirst）
  // 修复：旧实现 findFirst 任意 govOrganization（不按用户过滤）→ 非企业用户被路由到别人租户的 LLM Key
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })
  if (!user?.email) return null
  const govUser = await prisma.govUser.findFirst({
    where: { email: user.email, status: 'active' },
    select: { tenantId: true },
  })
  if (!govUser) return null

  // ② 用该 govUser 的租户找组织（同租户内，不越界）
  const membership = await prisma.govOrganization.findFirst({
    where: {
      tenantId: govUser.tenantId,
      status: 'active',
    },
    select: { id: true, tenantId: true },
  })
  if (!membership) return null

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
  {
    const permissionScope: string[] = []
    const knowledgeScope: string[] = []
    try {
      permissionScope.push(...(agent?.permissions ? JSON.parse(agent.permissions) : ['read_own_data']))
      knowledgeScope.push(...(agent?.knowledgeScope ? JSON.parse(agent.knowledgeScope) : []))
    } catch { /* 非法 JSON 时保持默认空数组，不再让调用方 500 */ }
    return {
      tenantId: membership.tenantId,
      organizationId: membership.id,
      agentId: agent?.id,
      agentType,
      taskType,
      permissionScope,
      knowledgeScope,
      traceId: `trace_${taskId}_${Date.now()}`,
      userId,
      credentialOwner: 'enterprise',
    }
  }
}
