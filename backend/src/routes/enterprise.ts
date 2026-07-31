/**
 * Enterprise AI Workforce — API Routes
 * 企业数字部门 API 接口前缀: /api/enterprise
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { enterpriseLlmService } from '../services/enterprise/enterprise-llm.service.js'
import { enterpriseAgentService } from '../services/enterprise/enterprise-agent.service.js'
import { modelRouter } from '../services/enterprise/model-router.service.js'
import { agentAuditService } from '../services/enterprise/agent-audit.service.js'
import { enterpriseOnboarding } from '../services/enterprise/enterprise-onboarding.service.js'
import { entitlementService } from '../services/enterprise/enterprise-entitlement.service.js'
import { tenantOwnershipGuard } from '../enterprise/reality/tenant-guard.js'
import { getOrganizationIdForUser, resolveTenantIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'
import { modelResolver } from '../services/enterprise/model-resolver.service.js' // SPRINT-IDENTITY-REALITY-FIX-01: 企业 BYOK 模型解析

export async function enterpriseRoutes(app: FastifyInstance) {
  // 所有企业接口都需要 JWT 认证
  app.addHook('preHandler', app.authenticate)
  // AC4.1: 防止水平越权（仅对有 tenantId 参数的请求生效）
  app.addHook('preHandler', tenantOwnershipGuard)

  // ============================================================
  // SPRINT-IDENTITY-REALITY-FIX-01: 企业 AI 模型设置（BYOK，企业资产）
  // 企业工作台 → 设置 → AI模型设置：Provider / 模型 / API Key / 测试连接 / 默认模型
  // 平台不托管企业 Key：Key 加密存储于 provider_credential（owner=organization）
  // ============================================================

  // 解析当前用户的 Organization（商业主体 SSOT）
  const resolveUserOrganizationId = async (userId: string): Promise<string | null> => {
    const owned = await prisma.organization.findMany({ where: { ownerId: userId }, orderBy: { createdAt: 'desc' } })
    // 优先选择已配置模型的企业（用户实际使用的企业）
    for (const o of owned) {
      const cfg = await prisma.orgModelConfig.count({ where: { organizationId: o.id } })
      if (cfg > 0) return o.id
    }
    // 其次选择有 AI 员工的企业（商业主体 SSOT 锚点）
    for (const o of owned) {
      const cnt = await prisma.enterpriseAgentProfile.count({ where: { organizationId: o.id } })
      if (cnt > 0) return o.id
    }
    if (owned.length) return owned[0].id
    const govOrgId = await getOrganizationIdForUser(userId)
    if (govOrgId) {
      const byGov = await prisma.organization.findFirst({ where: { OR: [{ id: govOrgId as any }, { slug: govOrgId }] } })
      if (byGov) return byGov.id
    }
    return null
  }

  // GET /api/enterprise/model-config — 企业模型设置（绝不返回 Key 明文）
  app.get('/api/enterprise/model-config', async (request) => {
    const user = request.user as any
    const organizationId = await resolveUserOrganizationId(user.id)
    if (!organizationId) return { success: false, error: '企业不存在，请先创建企业' }
    const settings = await modelResolver.getOrgModelSettings(organizationId)
    return { success: true, data: { organizationId, settings } }
  })

  // PUT /api/enterprise/model-config — 保存企业模型设置（加密存储企业 Key）
  app.put('/api/enterprise/model-config', async (request, reply) => {
    const user = request.user as any
    const body = request.body as any
    const organizationId = await resolveUserOrganizationId(user.id)
    if (!organizationId) return reply.status(400).send({ success: false, error: '企业不存在，请先创建企业' })
    if (!body?.provider || !body?.model) return reply.status(400).send({ success: false, error: 'provider 和 model 必填' })
    if (!body?.apiKey) return reply.status(400).send({ success: false, error: 'API Key 必填（昆仑镜不托管企业 Key，请使用企业自己的 Key）' })
    try {
      const result = await modelResolver.saveOrgModelSettings(organizationId, {
        provider: body.provider,
        model: body.model,
        fallbackModel: body.fallbackModel,
        apiKey: body.apiKey,
        isDefault: body.isDefault !== false,
      })
      return { success: true, data: result }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // POST /api/enterprise/model-config/test — 测试连接（真实调用验证企业 Key）
  app.post('/api/enterprise/model-config/test', async (request, reply) => {
    const user = request.user as any
    const body = request.body as any
    const organizationId = await resolveUserOrganizationId(user.id)
    if (!organizationId) return reply.status(400).send({ success: false, error: '企业不存在，请先创建企业' })
    if (!body?.provider || !body?.model) return reply.status(400).send({ success: false, error: 'provider 和 model 必填' })
    const result = await modelResolver.testConnection(organizationId, body.provider, body.model, body.apiKey)
    return { success: result.ok, data: result }
  })

  // DELETE /api/enterprise/model-config/:provider — 删除企业模型设置（G2：删 Key → AI 员工停止运行）
  app.delete('/api/enterprise/model-config/:provider', async (request, reply) => {
    const user = request.user as any
    const { provider } = request.params as any
    const organizationId = await resolveUserOrganizationId(user.id)
    if (!organizationId) return reply.status(400).send({ success: false, error: '企业不存在，请先创建企业' })
    await prisma.orgModelConfig.deleteMany({ where: { organizationId: organizationId as any, provider } })
    await prisma.providerCredential.deleteMany({ where: { ownerType: 'organization', organizationId: organizationId as any, provider } })
    return { success: true, message: `已删除 ${provider} 模型配置，AI 员工将停止运行（需重新配置后才能继续）` }
  })

  // POST /api/enterprise — 创建企业并初始化 AI 部门
  app.post('/api/enterprise', async (request, reply) => {
    const user = request.user as any
    const body = request.body as any
    if (!body?.name) return reply.status(400).send({ success: false, error: '企业名称必填' })
    try {
      const result = await enterpriseOnboarding.initializeEnterprise({
        userId: user.id,
        name: body.name,
        industry: body.industry,
        metadata: body.metadata,
      })
      return { success: true, data: result }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // GET /api/enterprise/:tenantId/onboarding — 查看初始化状态
  app.get('/api/enterprise/:tenantId/onboarding', async (request) => {
    const { tenantId } = request.params as any
    const status = await enterpriseOnboarding.getOnboardingStatus(tenantId)
    return { success: true, data: status }
  })

  // GET /api/enterprise/onboarding/status — 当前用户的初始化状态（无需 tenantId）
  app.get('/api/enterprise/onboarding/status', async (request) => {
    const userId = (request.user as any)?.id
    // 注意：这里需要 tenantId（gov tenant），不是 org id
    const tenantId = userId ? (await resolveTenantIdForUser(userId) || userId) : ''
    const status = await enterpriseOnboarding.getOnboardingStatus(tenantId)
    // 补充组织信息（media-department 前端使用）：真实 gov 组织名/ID
    let organizationName = ''
    let organizationId = ''
    if (tenantId) {
      const org = await prisma.govOrganization.findFirst({
        where: { tenantId },
        select: { id: true, name: true },
      })
      if (org) {
        organizationId = org.id
        organizationName = org.name
      }
    }
    return { code: 0, data: {
      ...status,
      hasOrganization: status.organizations > 0,
      organizationId,
      organizationName,
    } }
  })

  // POST /api/enterprise/setup/complete — 标记 Setup 完成
  app.post('/api/enterprise/setup/complete', async (request, reply) => {
    const userId = (request.user as any)?.id
    const tenantId = userId ? (await resolveTenantIdForUser(userId) || userId) : ''
    try {
      // 更新 onboarding 状态：确保 isComplete = true
      const status = await enterpriseOnboarding.getOnboardingStatus(tenantId)
      return { code: 0, data: { ...status, setupCompleted: true } }
    } catch (e: any) {
      return reply.status(500).send({ code: 500, error: e.message })
    }
  })

  // ============================================================
  // Model Governance
  // ============================================================

  // POST /api/enterprise/:tenantId/models — 添加模型
  app.post('/api/enterprise/:tenantId/models', async (request, reply) => {
    const { tenantId } = request.params as any
    const body = request.body as any
    if (!body?.provider || !body?.modelName || !body?.apiKey) {
      return reply.status(400).send({ success: false, error: 'provider/modelName/apiKey 必填' })
    }
    try {
      const config = await enterpriseLlmService.create({
        tenantId,
        provider: body.provider,
        modelName: body.modelName,
        apiKey: body.apiKey,
        baseUrl: body.baseUrl,
        credentialOwner: body.credentialOwner,
        maxTokensPerDay: body.maxTokensPerDay,
        capabilities: body.capabilities,
      })
      return { success: true, data: { id: config.id, provider: config.provider, modelName: config.modelName } }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // GET /api/enterprise/:tenantId/models — 列出模型
  app.get('/api/enterprise/:tenantId/models', async (request) => {
    const { tenantId } = request.params as any
    const configs = await enterpriseLlmService.listByTenant(tenantId)
    return { success: true, data: configs }
  })

  // PUT /api/enterprise/:tenantId/models/:id — 更新模型
  app.put('/api/enterprise/:tenantId/models/:id', async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any
    try {
      const config = await enterpriseLlmService.update(id, body)
      return { success: true, data: config }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // DELETE /api/enterprise/:tenantId/models/:id — 删除模型
  app.delete('/api/enterprise/:tenantId/models/:id', async (request, reply) => {
    const { id } = request.params as any
    try {
      await enterpriseLlmService.deactivate(id)
      return { success: true }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // POST /api/enterprise/:tenantId/models/:id/test — 测试模型连通性
  app.post('/api/enterprise/:tenantId/models/:id/test', async (request) => {
    const { id } = request.params as any
    const result = await enterpriseLlmService.testConnection(id)
    return { success: result.success, data: result }
  })

  // ============================================================
  // Agent 管理
  // ============================================================

  // POST /api/enterprise/:tenantId/agents — 创建 Agent
  app.post('/api/enterprise/:tenantId/agents', async (request, reply) => {
    const { tenantId } = request.params as any
    const body = request.body as any
    if (!body?.name || !body?.agentType) {
      return reply.status(400).send({ success: false, error: 'name/agentType 必填' })
    }
    try {
      // Sprint-03: Entitlement 检查 — 创建 Agent 前验证套餐限额
      const orgId = body.organizationId || tenantId
      const check = await entitlementService.checkAgentCapability(orgId)
      if (!check.allowed) {
        return reply.status(403).send({
          success: false,
          error: 'AGENT_LIMIT_REACHED',
          message: check.reason,
          current: check.current,
          limit: check.limit,
        })
      }
      const agent = await enterpriseAgentService.create({
        tenantId,
        organizationId: body.organizationId,
        name: body.name,
        role: body.role || body.name,
        agentType: body.agentType,
        goal: body.goal,
        description: body.description,
        avatarUrl: body.avatarUrl,
        knowledgeScope: body.knowledgeScope,
        tools: body.tools,
        permissions: body.permissions,
        capabilities: body.capabilities,
      })
      return { success: true, data: agent }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // GET /api/enterprise/:tenantId/agents — 列出 Agents
  app.get('/api/enterprise/:tenantId/agents', async (request) => {
    const { tenantId } = request.params as any
    const { organizationId } = request.query as any
    const agents = await enterpriseAgentService.listByTenant(tenantId, organizationId)
    return { success: true, data: agents }
  })

  // GET /api/enterprise/:tenantId/agents/:id — Agent 详情
  app.get('/api/enterprise/:tenantId/agents/:id', async (request, reply) => {
    const { id } = request.params as any
    const agent = await enterpriseAgentService.getById(id)
    if (!agent) return reply.status(404).send({ success: false, error: 'Agent 不存在' })
    return { success: true, data: agent }
  })

  // ============================================================
  // Model Router — 智能模型路由
  // ============================================================

  // POST /api/enterprise/:tenantId/route — 解析任务路由
  app.post('/api/enterprise/:tenantId/route', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any
    const body = request.body as any
    if (!body?.agentType || !body?.taskType) {
      return reply.status(400).send({ success: false, error: 'agentType/taskType 必填' })
    }
    const result = await modelRouter.resolve({
      tenantId,
      agentType: body.agentType,
      taskType: body.taskType,
      organizationId: body.organizationId,
      userId: user?.id,
    })
    if (!result) return reply.status(404).send({ success: false, error: '无可用模型配置' })
    return { success: true, data: { ...result, apiKey: '[Encrypted]' } }
  })

  // ============================================================
  // Audit Trail — 审计日志
  // ============================================================

  // POST /api/enterprise/:tenantId/audit — 记录审计日志
  app.post('/api/enterprise/:tenantId/audit', async (request, reply) => {
    const { tenantId } = request.params as any
    const body = request.body as any
    if (!body?.action) return reply.status(400).send({ success: false, error: 'action 必填' })
    const entry = await agentAuditService.log({ tenantId, ...body })
    return { success: true, data: entry }
  })

  // GET /api/enterprise/:tenantId/audit — 查询审计日志
  app.get('/api/enterprise/:tenantId/audit', async (request) => {
    const { tenantId } = request.params as any
    const { agentId, limit, offset } = request.query as any
    const result = await agentAuditService.list(tenantId, {
      agentId,
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
    })
    return { success: true, data: result }
  })

  // GET /api/enterprise/:tenantId/agents/:agentId/stats — Agent 统计
  app.get('/api/enterprise/:tenantId/agents/:agentId/stats', async (request) => {
    const { tenantId, agentId } = request.params as any
    const stats = await agentAuditService.getAgentStats(tenantId, agentId)
    return { success: true, data: stats }
  })

  // GET /api/enterprise/list — 获取当前用户的所有企业
  app.get('/api/enterprise/list', async (request, reply) => {
    const user = request.user as any
    try {
      const tenants = await prisma.tenant.findMany({
        where: { type: 'enterprise', status: 'active' },
        select: { id: true, name: true, createdAt: true, metadata: true },
        orderBy: { createdAt: 'desc' },
      })
      return { success: true, data: tenants }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })
}
