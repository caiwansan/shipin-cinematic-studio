/**
 * recruitment-department.routes.ts — AI Recruitment Department API
 * Sprint-08A: AI Recruitment Department 重构
 *
 * 产品原则：
 * - 企业拥有独立的 AI 招聘部门
 * - 每个 AI 员工（Marketing / Recruiter / Interview）独立生命周期
 * - BYOK 强制：AI 员工只有配置模型后才能上岗
 * - Tenant 隔离：所有数据严格按 workspaceId/enterpriseId 隔离
 *
 * 复用现有 Hermes 基础设施：
 * - EnterpriseAgentWorkforce: AI 员工生命周期
 * - AIProviderConfig: BYOK 凭证
 * - EmployeeModelBinding: Agent ↔ Model 绑定
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { entitlementService } from '../services/enterprise/enterprise-entitlement.service.js'
import { requireEnterpriseWorkspaceContext } from '../services/enterprise-context.service.js'
import { getEnterpriseContext } from '../repositories/recruitment/enterprise-member.repository.js'

// ─── AI 员工类型定义 ───
const RECRUITMENT_AGENT_TYPES = {
  marketing: {
    code: 'marketing',
    name: 'AI Recruitment Marketing Agent',
    shortName: '招聘宣传官',
    description: '负责招聘宣传、社交媒体宣发、企业微信群运营、招聘互动、活动推广',
    capabilities: ['岗位发布', '社交媒体宣发', '社群运营', '招聘互动', '活动推广'],
    defaultModel: 'gpt-4o',
  },
  recruiter: {
    code: 'recruiter',
    name: 'Enterprise Recruiter Agent',
    shortName: 'AI 招聘官',
    description: '持续扫描 Talent Pool、Candidate Ranking、主动沟通、收集资料、提交 Candidate Brief',
    capabilities: ['人才扫描', '候选人排序', '主动沟通', '资料收集', 'Candidate Brief'],
    defaultModel: 'deepseek-v4-flash',
  },
  interview: {
    code: 'interview',
    name: 'AI Interview Agent',
    shortName: 'AI 面试官',
    description: '负责初面、技术面、英语测试、行为面试、自动纪要、自动评分',
    capabilities: ['初面', '技术面', '英语测试', '行为面试', '自动纪要', '面试报告'],
    defaultModel: 'gpt-4o',
  },
} as const

type AgentTypeCode = keyof typeof RECRUITMENT_AGENT_TYPES

// ─── Helper: resolve workspaceId → enterpriseId ───
async function resolveEnterpriseId(workspaceId?: string): Promise<string | null> {
  if (!workspaceId) return null
  const workspace = await prisma.enterpriseJobWorkspace.findUnique({
    where: { id: workspaceId },
    select: { enterpriseId: true },
  })
  return workspace?.enterpriseId || null
}

// ─── Helper: resolve enterpriseId → workspaceId ───
async function resolveWorkspaceId(enterpriseId: string): Promise<string | null> {
  const workspace = await prisma.enterpriseJobWorkspace.findUnique({
    where: { enterpriseId },
    select: { id: true },
  })
  return workspace?.id || null
}

// ─── Helper: ensure workforce records exist for a workspace ───
async function ensureWorkforceExists(workspaceId: string, enterpriseId: string): Promise<void> {
  for (const [agentType, def] of Object.entries(RECRUITMENT_AGENT_TYPES)) {
    const existing = await prisma.enterpriseAgentWorkforce.findUnique({
      where: { workspaceId_agentType: { workspaceId, agentType } },
    })
    if (!existing) {
      await prisma.enterpriseAgentWorkforce.create({
        data: {
          workspaceId,
          enterpriseId,
          agentType,
          displayName: def.shortName,
          roleDescription: def.description,
          status: 'trial',
          subscriptionPlan: 'starter',
          sortOrder: agentType === 'marketing' ? 1 : agentType === 'recruiter' ? 2 : 3,
        },
      })
    }
  }
}

// ─── Helper: sync workforce → EnterpriseAgentProfile + EnterpriseAgentInstance ───
/**
 * P0-1: AI Employee Persistence
 * 将 enterprise_agent_workforce 的员工同步到 Hermes 持久化层
 * 创建 EnterpriseAgentProfile + EnterpriseAgentInstance
 */
async function syncEmployeesToPersistence(workspaceId: string, enterpriseId: string): Promise<{
  profiles: number
  instances: number
}> {
  const workforce = await prisma.enterpriseAgentWorkforce.findMany({
    where: { workspaceId },
  })

  let profilesCreated = 0
  let instancesCreated = 0

  for (const emp of workforce) {
    // 1. Check if profile already exists (by name + workspace)
    const existingProfile = await prisma.enterpriseAgentProfile.findFirst({
      where: {
        tenantId: enterpriseId,
        name: emp.displayName,
      },
    })

    let profileId: string
    if (!existingProfile) {
      // Sprint-03: Entitlement 检查 — 创建 Agent 前验证套餐限额
      const check = await entitlementService.checkAgentCapability(enterpriseId)
      if (!check.allowed) {
        console.warn(`[RecruitmentDept] Agent 创建跳过: ${check.reason} (${check.current}/${check.limit})`)
        continue
      }
      const def = RECRUITMENT_AGENT_TYPES[emp.agentType as AgentTypeCode]
      const profile = await prisma.enterpriseAgentProfile.create({
        data: {
          tenantId: enterpriseId,
          name: emp.displayName,
          description: emp.roleDescription || '',
          role: emp.agentType,
          agentType: emp.agentType,
          goal: def?.description || emp.roleDescription || '',
          capabilities: JSON.stringify(def?.capabilities || []),
          tools: JSON.stringify([]),
          permissions: JSON.stringify([]),
          status: emp.status === 'active' ? 'active' : 'inactive',
          isDefault: false,
          metadata: JSON.stringify({
            workforceId: emp.id,
            workspaceId: emp.workspaceId,
            subscriptionPlan: emp.subscriptionPlan,
          }),
        },
      })
      profileId = profile.id
      profilesCreated++
    } else {
      profileId = existingProfile.id
    }

    // 2. Check if instance exists
    const existingInstance = await prisma.enterpriseAgentInstance.findUnique({
      where: { employeeId: profileId },
    })

    if (!existingInstance) {
      await prisma.enterpriseAgentInstance.create({
        data: {
          tenantId: enterpriseId,
          employeeId: profileId,
          agentId: `agent_${enterpriseId}_${profileId.slice(-8)}`,
          namespace: `tenant_${enterpriseId}`,
          runtime: 'openclaw',
          runtimeStatus: emp.status === 'active' ? 'active' : 'paused',
          totalTasks: emp.monthlyCalls || 0,
          totalErrors: 0,
          metadata: JSON.stringify({
            workforceId: emp.id,
            agentType: emp.agentType,
          }),
        },
      })
      instancesCreated++
    }
  }

  return { profiles: profilesCreated, instances: instancesCreated }
}

export const recruitmentDepartmentRoutes = async (fastify: FastifyInstance) => {

  // ─── JWT Auth for all routes ───
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  // ─── POST /api/enterprise/recruitment-department/sync-employees ───
  /**
   * P0-1: 手动触发 AI Employee 持久化同步
   * 将 enterprise_agent_workforce → EnterpriseAgentProfile + EnterpriseAgentInstance
   */
  fastify.post('/api/enterprise/recruitment-department/sync-employees', async (request, reply) => {
    try {
      const userId = (request as any).user?.id || (request as any).userId
      const { workspaceId } = request.body as any

      // Observation Sprint Step 1-B-2: workspace tenant boundary guard
      const wsc = await requireEnterpriseWorkspaceContext(userId, workspaceId)
      if (!wsc) return reply.status(403).send({ success: false, message: 'Workspace access denied' })
      const enterpriseId = wsc.enterpriseId

      // Ensure workforce exists first
      await ensureWorkforceExists(workspaceId, enterpriseId)

      // Sync to persistence layer
      const result = await syncEmployeesToPersistence(workspaceId, enterpriseId)

      return reply.send({
        success: true,
        data: {
          message: 'AI employees synced to persistence layer',
          profilesCreated: result.profiles,
          instancesCreated: result.instances,
        },
      })
    } catch (error: any) {
      request.log.error(`[recruitment-department] sync-employees: ${error.message}`)
      return reply.status(500).send({ success: false, error: 'Sync failed', detail: error.message })
    }
  })

  // ─── GET /api/enterprise/recruitment-department — AI 招聘部门首页 ───
  fastify.get('/api/enterprise/recruitment-department', async (request, reply) => {
    try {
      const userId = (request as any).user?.id || (request as any).userId
      const { workspaceId } = request.query as { workspaceId?: string }

      // Observation Sprint Step 1-B-2: workspace tenant boundary guard
      const wsc = await requireEnterpriseWorkspaceContext(userId, workspaceId)
      if (!wsc) return reply.status(403).send({ error: 'Workspace access denied' })
      const enterpriseId = wsc.enterpriseId

      const wsId = workspaceId || (await resolveWorkspaceId(enterpriseId))
      if (!wsId) {
        return reply.status(400).send({ error: 'Workspace not found' })
      }

      // Ensure workforce records exist (auto-provision on first visit)
      await ensureWorkforceExists(wsId, enterpriseId)

      // P0-1: Auto-sync to persistence layer (EnterpriseAgentProfile + Instance)
      await syncEmployeesToPersistence(wsId, enterpriseId)

      // Get all AI employees for this workspace
      const workforce = await prisma.enterpriseAgentWorkforce.findMany({
        where: { workspaceId: wsId },
        orderBy: { sortOrder: 'asc' },
      })

      // Get model bindings for each employee (manual join — no @relation declared)
      const allBindings = await prisma.employeeModelBinding.findMany({
        where: { employeeId: { in: workforce.map(e => e.id) } },
      })
      const providerConfigIds = [...new Set(allBindings.map(b => b.providerConfigId))]
      const providerConfigs = await prisma.aIProviderConfig.findMany({
        where: { id: { in: providerConfigIds } },
        select: { id: true, provider: true, model: true, baseUrl: true },
      })
      const providerConfigMap = new Map(providerConfigs.map(p => [p.id, p]))

      const employees = workforce.map((emp) => {
        const bindings = allBindings.filter(b => b.employeeId === emp.id)
        const def = RECRUITMENT_AGENT_TYPES[emp.agentType as AgentTypeCode]

        return {
          id: emp.id,
          agentType: emp.agentType,
          name: emp.displayName || def?.name || emp.agentType,
          shortName: def?.shortName || emp.agentType,
          description: emp.roleDescription || def?.description || '',
          capabilities: def?.capabilities || [],
          status: emp.status,
          subscriptionPlan: emp.subscriptionPlan,
          trialEndsAt: emp.trialEndsAt,
          activatedAt: emp.activatedAt,
          pausedAt: emp.pausedAt,
          pauseReason: emp.pauseReason,
          monthlyCalls: emp.monthlyCalls,
          monthlyTokens: emp.monthlyTokens,
          monthlyCost: emp.monthlyCost,
          modelBindings: bindings.map((b) => {
            const pc = providerConfigMap.get(b.providerConfigId)
            return {
              id: b.id,
              provider: pc?.provider || null,
              model: b.modelName || pc?.model || null,
              baseUrl: pc?.baseUrl || null,
              temperature: b.temperature,
              maxTokens: b.maxTokens,
              enabled: b.enabled,
            }
          }),
          hasModelConfigured: bindings.length > 0 && bindings.some((b) => b.enabled),
          sortOrder: emp.sortOrder,
          createdAt: emp.createdAt,
          updatedAt: emp.updatedAt,
        }
      })

      // Summary stats
      const stats = {
        total: employees.length,
        active: employees.filter((e) => e.status === 'active').length,
        trial: employees.filter((e) => e.status === 'trial').length,
        paused: employees.filter((e) => e.status === 'paused').length,
        withModel: employees.filter((e) => e.hasModelConfigured).length,
      }

      // ─── Beta UX: Per-employee today stats ───
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Campaign stats (for marketing agent)
      const campaignStats = await prisma.recruitmentCampaign.findMany({
        where: { workspaceId: wsId, createdAt: { gte: today } },
        select: { status: true, id: true },
      })
      const campaignsToday = campaignStats.length
      const campaignsPublished = campaignStats.filter(c => c.status === 'published').length

      // Conversation stats (for recruiter agent)
      const conversationStats = await prisma.recruitmentConversation.findMany({
        where: { workspaceId: wsId, createdAt: { gte: today } },
        select: { status: true, id: true },
      })
      const conversationsToday = conversationStats.length
      const conversationsWaiting = conversationStats.filter(c => c.status === 'WAITING_HR_REVIEW').length

      // Interview stats (for interview agent)
      const interviewStats = await prisma.interviewSession.findMany({
        where: { workspaceId: wsId, createdAt: { gte: today } },
        select: { status: true, id: true },
      })
      const interviewsToday = interviewStats.length
      const interviewsCompleted = interviewStats.filter(i => i.status === 'completed' || i.status === 'decision_made').length

      // Attach todayStats to each employee based on agentType
      const employeesWithStats = employees.map((emp) => {
        const def = RECRUITMENT_AGENT_TYPES[emp.agentType as AgentTypeCode]
        let todayStats: Record<string, number | string> = {}
        switch (emp.agentType) {
          case 'marketing':
            todayStats = {
              campaignsTotal: campaignsToday,
              campaignsPublished,
              postsToday: campaignsToday, // each campaign = posts to channels
            }
            break
          case 'recruiter':
            todayStats = {
              conversationsTotal: conversationsToday,
              waitingHR: conversationsWaiting,
              messagesToday: conversationsToday * 3, // estimated
            }
            break
          case 'interview':
            todayStats = {
              interviewsTotal: interviewsToday,
              interviewsCompleted,
              pendingReview: interviewsToday - interviewsCompleted,
            }
            break
          default:
            todayStats = {
              tasksToday: 0,
            }
        }
        return { ...emp, todayStats }
      })

      return reply.status(200).send({
        success: true,
        data: {
          workspaceId: wsId,
          enterpriseId,
          stats,
          employees: employeesWithStats,
        },
      })
    } catch (error: any) {
      request.log.error(`[recruitment-department] home: ${error.message}`)
      return reply.status(500).send({ error: 'Internal server error' })
    }
  })

  // ─── POST /api/enterprise/recruitment-department/employees/:id/activate — 激活 AI 员工 ───
  fastify.post('/api/enterprise/recruitment-department/employees/:id/activate', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const userId = (request as any).user?.id || (request as any).userId
      const { workspaceId } = request.query as { workspaceId?: string }

      // Observation Sprint Step 1-B-2: workspace tenant boundary guard
      const wsc = await requireEnterpriseWorkspaceContext(userId, workspaceId)
      if (!wsc) return reply.status(403).send({ error: 'Workspace access denied' })
      const enterpriseId = wsc.enterpriseId

      const employee = await prisma.enterpriseAgentWorkforce.findFirst({
        where: { id, workspaceId: workspaceId || undefined },
      })
      if (!employee) {
        return reply.status(404).send({ error: 'Employee not found' })
      }

      // Check if model is configured
      const bindings = await prisma.employeeModelBinding.findMany({
        where: { employeeId: id, enabled: true },
      })
      if (bindings.length === 0) {
        return reply.status(422).send({
          error: 'NO_MODEL_CONFIGURED',
          message: '请先配置 AI 员工的模型和 API Key 后再激活',
        })
      }

      // Activate
      const updated = await prisma.enterpriseAgentWorkforce.update({
        where: { id },
        data: {
          status: 'active',
          activatedAt: new Date(),
          trialEndsAt: null,
          pausedAt: null,
          pauseReason: null,
        },
      })

      return reply.status(200).send({
        success: true,
        data: {
          id: updated.id,
          status: updated.status,
          activatedAt: updated.activatedAt,
        },
      })
    } catch (error: any) {
      request.log.error(`[recruitment-department] activate: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to activate employee' })
    }
  })

  // ─── POST /api/enterprise/recruitment-department/employees/:id/pause — 暂停 AI 员工 ───
  fastify.post('/api/enterprise/recruitment-department/employees/:id/pause', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const userId = (request as any).user?.id || (request as any).userId
      const { workspaceId, reason } = request.query as { workspaceId?: string; reason?: string }

      // Observation Sprint Step 1-B-2: workspace tenant boundary guard
      const wsc = await requireEnterpriseWorkspaceContext(userId, workspaceId)
      if (!wsc) return reply.status(403).send({ error: 'Workspace access denied' })
      const enterpriseId = wsc.enterpriseId

      const employee = await prisma.enterpriseAgentWorkforce.findFirst({
        where: { id, workspaceId: workspaceId || undefined },
      })
      if (!employee) {
        return reply.status(404).send({ error: 'Employee not found' })
      }

      const updated = await prisma.enterpriseAgentWorkforce.update({
        where: { id },
        data: {
          status: 'paused',
          pausedAt: new Date(),
          pauseReason: reason || null,
        },
      })

      return reply.status(200).send({
        success: true,
        data: {
          id: updated.id,
          status: updated.status,
          pausedAt: updated.pausedAt,
        },
      })
    } catch (error: any) {
      request.log.error(`[recruitment-department] pause: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to pause employee' })
    }
  })

  // ─── POST /api/enterprise/recruitment-department/employees/:id/resume — 恢复 AI 员工 ───
  fastify.post('/api/enterprise/recruitment-department/employees/:id/resume', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const userId = (request as any).user?.id || (request as any).userId
      const { workspaceId } = request.query as { workspaceId?: string }

      // Observation Sprint Step 1-B-2: workspace tenant boundary guard
      const wsc = await requireEnterpriseWorkspaceContext(userId, workspaceId)
      if (!wsc) return reply.status(403).send({ error: 'Workspace access denied' })
      const enterpriseId = wsc.enterpriseId

      const employee = await prisma.enterpriseAgentWorkforce.findFirst({
        where: { id, workspaceId: workspaceId || undefined },
      })
      if (!employee) {
        return reply.status(404).send({ error: 'Employee not found' })
      }

      const updated = await prisma.enterpriseAgentWorkforce.update({
        where: { id },
        data: {
          status: 'active',
          activatedAt: new Date(),
          pausedAt: null,
          pauseReason: null,
        },
      })

      return reply.status(200).send({
        success: true,
        data: {
          id: updated.id,
          status: updated.status,
          activatedAt: updated.activatedAt,
        },
      })
    } catch (error: any) {
      request.log.error(`[recruitment-department] resume: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to resume employee' })
    }
  })

  // ─── GET /api/enterprise/recruitment-department/employees/:id/settings — 获取 AI 员工设置 ───
  fastify.get('/api/enterprise/recruitment-department/employees/:id/settings', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const userId = (request as any).user?.id || (request as any).userId
      const { workspaceId } = request.query as { workspaceId?: string }

      // Observation Sprint Step 1-B-2: workspace tenant boundary guard
      const wsc = await requireEnterpriseWorkspaceContext(userId, workspaceId)
      if (!wsc) return reply.status(403).send({ error: 'Workspace access denied' })
      const enterpriseId = wsc.enterpriseId

      const employee = await prisma.enterpriseAgentWorkforce.findFirst({
        where: { id, workspaceId: workspaceId || undefined },
      })
      if (!employee) {
        return reply.status(404).send({ error: 'Employee not found' })
      }

      // Get current model bindings (manual join)
      const bindings = await prisma.employeeModelBinding.findMany({
        where: { employeeId: id },
      })
      const bindingConfigIds = bindings.map(b => b.providerConfigId)
      const bindingConfigs = await prisma.aIProviderConfig.findMany({
        where: { id: { in: bindingConfigIds } },
        select: { id: true, provider: true, model: true, baseUrl: true, enabled: true },
      })
      const bindingConfigMap = new Map(bindingConfigs.map(p => [p.id, p]))

      // Get available provider configs for this enterprise
      const availableProviders = await prisma.aIProviderConfig.findMany({
        where: { organizationId: enterpriseId },
        select: { id: true, provider: true, model: true, baseUrl: true, enabled: true },
      })

      const def = RECRUITMENT_AGENT_TYPES[employee.agentType as AgentTypeCode]

      return reply.status(200).send({
        success: true,
        data: {
          id: employee.id,
          agentType: employee.agentType,
          name: employee.displayName,
          shortName: def?.shortName || employee.agentType,
          description: employee.roleDescription || def?.description || '',
          status: employee.status,
          currentBindings: bindings.map((b) => {
            const pc = bindingConfigMap.get(b.providerConfigId)
            return {
              id: b.id,
              providerConfigId: b.providerConfigId,
              provider: pc?.provider || null,
              model: b.modelName || pc?.model || null,
              baseUrl: pc?.baseUrl || null,
              temperature: b.temperature,
              maxTokens: b.maxTokens,
              enabled: b.enabled,
            }
          }),
          availableProviders: availableProviders.map((p) => ({
            id: p.id,
            provider: p.provider,
            model: p.model,
            baseUrl: p.baseUrl,
            enabled: p.enabled,
          })),
        },
      })
    } catch (error: any) {
      request.log.error(`[recruitment-department] settings: ${error.message}`)
      return reply.status(500).send({ error: 'Internal server error' })
    }
  })

  // ─── PUT /api/enterprise/recruitment-department/employees/:id/settings — 更新 AI 员工设置（BYOK 绑定） ───
  fastify.put('/api/enterprise/recruitment-department/employees/:id/settings', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const userId = (request as any).user?.id || (request as any).userId
      const { workspaceId } = request.query as { workspaceId?: string }
      const body = request.body as {
        providerConfigId?: string
        modelName?: string
        temperature?: number
        maxTokens?: number
        enabled?: boolean
      }

      // Observation Sprint Step 1-B-2: workspace tenant boundary guard
      const wsc = await requireEnterpriseWorkspaceContext(userId, workspaceId)
      if (!wsc) return reply.status(403).send({ error: 'Workspace access denied' })
      const enterpriseId = wsc.enterpriseId

      const employee = await prisma.enterpriseAgentWorkforce.findFirst({
        where: { id, workspaceId: workspaceId || undefined },
      })
      if (!employee) {
        return reply.status(404).send({ error: 'Employee not found' })
      }

      // Verify provider config belongs to this enterprise
      if (body.providerConfigId) {
        const providerConfig = await prisma.aIProviderConfig.findFirst({
          where: { id: body.providerConfigId, organizationId: enterpriseId },
        })
        if (!providerConfig) {
          return reply.status(403).send({ error: 'Provider config not found or access denied' })
        }
      }

      // Upsert model binding
      let binding
      const existingBinding = await prisma.employeeModelBinding.findFirst({
        where: { employeeId: id },
      })

      if (existingBinding) {
        binding = await prisma.employeeModelBinding.update({
          where: { id: existingBinding.id },
          data: {
            ...(body.providerConfigId !== undefined ? { providerConfigId: body.providerConfigId } : {}),
            ...(body.modelName !== undefined ? { modelName: body.modelName } : {}),
            ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
            ...(body.maxTokens !== undefined ? { maxTokens: body.maxTokens } : {}),
            ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
          },
        })
      } else if (body.providerConfigId) {
        binding = await prisma.employeeModelBinding.create({
          data: {
            tenantId: enterpriseId,
            employeeId: id,
            providerConfigId: body.providerConfigId,
            modelName: body.modelName || '',
            temperature: body.temperature ?? 0.7,
            maxTokens: body.maxTokens ?? 16384,
            enabled: body.enabled ?? true,
          },
        })
      } else {
        return reply.status(400).send({ error: 'providerConfigId is required for new binding' })
      }

      return reply.status(200).send({
        success: true,
        data: {
          id: binding.id,
          providerConfigId: binding.providerConfigId,
          modelName: binding.modelName,
          temperature: binding.temperature,
          maxTokens: binding.maxTokens,
          enabled: binding.enabled,
        },
      })
    } catch (error: any) {
      request.log.error(`[recruitment-department] update-settings: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to update settings' })
    }
  })

  // ─── POST /api/enterprise/recruitment-department/employees/:id/test-connection — 测试 BYOK 连接 ───
  fastify.post('/api/enterprise/recruitment-department/employees/:id/test-connection', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const userId = (request as any).user?.id || (request as any).userId
      const { workspaceId } = request.query as { workspaceId?: string }

      // Observation Sprint Step 1-B-2: workspace tenant boundary guard
      const wsc = await requireEnterpriseWorkspaceContext(userId, workspaceId)
      if (!wsc) return reply.status(403).send({ error: 'Workspace access denied' })
      const enterpriseId = wsc.enterpriseId

      const employee = await prisma.enterpriseAgentWorkforce.findFirst({
        where: { id, workspaceId: workspaceId || undefined },
      })
      if (!employee) {
        return reply.status(404).send({ error: 'Employee not found' })
      }

      // Get active binding
      const binding = await prisma.employeeModelBinding.findFirst({
        where: { employeeId: id, enabled: true },
      })

      if (!binding) {
        return reply.status(422).send({ error: 'NO_MODEL_CONFIGURED', message: '未配置模型' })
      }

      const providerConfig = await prisma.aIProviderConfig.findUnique({
        where: { id: binding.providerConfigId },
        select: { provider: true, model: true, baseUrl: true, encryptedApiKey: true },
      })

      if (!providerConfig) {
        return reply.status(422).send({ error: 'PROVIDER_CONFIG_NOT_FOUND', message: 'Provider 配置不存在' })
      }

      const { provider, model, baseUrl } = providerConfig

      // Lightweight connection test: call /models endpoint
      const https = await import('https')
      const http = await import('http')

      const testUrl = baseUrl || getDefaultBaseUrl(provider)
      const url = new URL(testUrl)

      const result = await new Promise<{ ok: boolean; statusCode: number }>((resolve) => {
        const req = (url.protocol === 'https:' ? https : http).request(
          {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + '/models',
            method: 'GET',
            headers: { Authorization: `Bearer ${providerConfig.encryptedApiKey}` },
            timeout: 10000,
          },
          (res) => {
            resolve({ ok: res.statusCode === 200, statusCode: res.statusCode || 0 })
          }
        )
        req.on('error', () => resolve({ ok: false, statusCode: 0 }))
        req.on('timeout', () => { req.destroy(); resolve({ ok: false, statusCode: 0 }) })
        req.end()
      })

      let status: string
      if (result.ok) status = 'healthy'
      else if (result.statusCode === 401) status = 'invalid_key'
      else status = 'error'

      return reply.status(200).send({
        success: true,
        data: {
          provider,
          model: binding.modelName || model,
          status,
          lastCheck: new Date().toISOString(),
        },
      })
    } catch (error: any) {
      request.log.error(`[recruitment-department] test-connection: ${error.message}`)
      return reply.status(500).send({ error: 'Connection test failed' })
    }
  })

  // ─── GET /api/enterprise/recruitment/agents — 招聘专用 AI 员工列表 ───
  /**
   * 返回当前企业的招聘 Agent（marketing / recruiter / interview）
   * 数据源：EnterpriseAgentInstance + profile 表
   * 不返回非招聘类型的 Agent
   */
  fastify.get('/api/enterprise/recruitment/agents', async (request, reply) => {
    try {
      const userId = (request as any).user?.id || (request as any).userId
      const { workspaceId } = request.query as { workspaceId?: string }

      // 从 JWT 解析企业身份
      const ctx = await getEnterpriseContext(userId)
      if (!ctx) return reply.status(403).send({ error: 'No enterprise identity' })
      const enterpriseId = ctx.enterpriseId

      const tenantId = userId  // EnterpriseAgentInstance.tenantId = userId in current data model
      const recruitmentTypes = ['recruiter', 'marketing', 'interview']

      // 查询先 enterpriseAgentInstance（无 profile 关系，手动关联）
      const allInstances = await prisma.enterpriseAgentInstance.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
      })

      // 批量获取对应 profile
      const employeeIds = allInstances.map((i) => i.employeeId)
      const profiles = employeeIds.length > 0 ? await prisma.enterpriseAgentProfile.findMany({
        where: { id: { in: employeeIds } },
        select: { id: true, name: true, agentType: true, description: true, capabilities: true },
      }) : []
      const profileMap = new Map(profiles.map((p) => [p.id, p]))

      // 过滤为招聘类型的 agent
      let instances = allInstances.filter((i) => {
        const p = profileMap.get(i.employeeId)
        return p && recruitmentTypes.includes(p.agentType)
      })

      // 如果没有招聘 Agent，尝试从 workforce 创建默认的 3 个
      if (instances.length === 0) {
        const wsId = workspaceId || (await resolveWorkspaceId(enterpriseId))
        if (wsId) {
          await ensureWorkforceExists(wsId, enterpriseId)
          // 重查
          const retryRaw = await prisma.enterpriseAgentInstance.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'asc' },
          })
          const retryProfiles = retryRaw.length > 0 ? await prisma.enterpriseAgentProfile.findMany({
            where: { id: { in: retryRaw.map((i) => i.employeeId) } },
            select: { id: true, name: true, agentType: true, description: true, capabilities: true },
          }) : []
          const retryProfileMap = new Map(retryProfiles.map((p) => [p.id, p]))

          instances = retryRaw.filter((i) => {
            const p = retryProfileMap.get(i.employeeId)
            return p && recruitmentTypes.includes(p.agentType)
          })

          return reply.send({
            data: instances.map((inst) => ({
              id: inst.id,
              type: profileMap.get(inst.employeeId)?.agentType || 'recruiter',
              name: profileMap.get(inst.employeeId)?.name || 'AI 招聘员工',
              shortName: getShortName(profileMap.get(inst.employeeId)?.agentType || 'recruiter'),
              status: inst.lifecycleState === 'ACTIVE' ? 'active' : 'paused',
              capabilities: parseCapabilities(profileMap.get(inst.employeeId)?.capabilities),
              usage: 0,
              lastActive: inst.lastRecoveredAt || inst.updatedAt?.toISOString() || null,
              createdAt: inst.createdAt?.toISOString() || new Date().toISOString(),
            })),
          })
        }
      }

      return reply.send({
        data: instances.map((inst) => ({
          id: inst.id,
          type: profileMap.get(inst.employeeId)?.agentType || 'recruiter',
          name: profileMap.get(inst.employeeId)?.name || 'AI 招聘员工',
          shortName: getShortName(profileMap.get(inst.employeeId)?.agentType || 'recruiter'),
          status: inst.lifecycleState === 'ACTIVE' ? 'active' : 'paused',
          capabilities: parseCapabilities(profileMap.get(inst.employeeId)?.capabilities),
          usage: 0,
          lastActive: inst.lastRecoveredAt || inst.updatedAt?.toISOString() || null,
          createdAt: inst.createdAt?.toISOString() || new Date().toISOString(),
        })),
      })
    } catch (error: any) {
      request.log.error(`[recruitment-department] agents: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to fetch agents', message: error.message })
    }
  })
}

// ─── Helper: 获取招聘 Agent 的中文短名 ───
function getShortName(agentType: string): string {
  const map: Record<string, string> = {
    recruiter: 'AI 招聘官',
    marketing: '招聘宣传官',
    interview: 'AI 面试官',
  }
  return map[agentType] || 'AI 招聘员工'
}

// ─── Helper: 解析 capabilities JSON ───
function parseCapabilities(cap: unknown): string[] {
  if (!cap) return []
  if (Array.isArray(cap)) return cap
  if (typeof cap === 'string') {
    try { const parsed = JSON.parse(cap); return Array.isArray(parsed) ? parsed : [] }
    catch { return [] }
  }
  return []
}

function getDefaultBaseUrl(provider: string): string {
  const map: Record<string, string> = {
    deepseek: 'https://api.deepseek.com/v1',
    openai: 'https://api.openai.com/v1',
    qwen: 'https://dashscope.aliyuncs.com/v1',
    doubao: 'https://ark.cn-beijing.volces.com/v1',
    claude: 'https://api.anthropic.com/v1',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  }
  return map[provider] || 'https://api.openai.com/v1'
}
