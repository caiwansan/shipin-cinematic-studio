/**
 * routes/admin-recruitment.ts — 后台「求职招聘管理」API
 * UX-02: 平台运营视角，不是企业操作视角
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'
import { enterpriseLlmService } from '../services/enterprise/enterprise-llm.service.js'
import { maskKey } from '../services/crypto.service.js'
import { auditRepository } from '../repositories/recruitment/audit.repository.js'
import { mapAuditListToDTOList } from '../mappers/recruitment/audit.mapper.js'
import { jobRepository } from '../repositories/recruitment/job.repository.js'
import { mapJobListToDTOList } from '../mappers/recruitment/job.mapper.js'
import { conversationRepository } from '../repositories/recruitment/conversation.repository.js'
import { mapConversationListToDTOList } from '../mappers/recruitment/conversation.mapper.js'
import { candidateRepository } from '../repositories/recruitment/candidate.repository.js'
import { mapCandidateListToDTOList } from '../mappers/recruitment/candidate.mapper.js'
import { runtimeRepository } from '../repositories/recruitment/runtime.repository.js'
import { mapRuntimeListToDTOList } from '../mappers/recruitment/runtime.mapper.js'
import { interviewRepository } from '../repositories/recruitment/interview.repository.js'
import { mapInterviewListToDTOList } from '../mappers/recruitment/interview.mapper.js'
import { departmentRepository } from '../repositories/recruitment/department.repository.js'
import { mapDepartmentListToDTOList } from '../mappers/recruitment/department.mapper.js'
import { overviewRepository } from '../repositories/recruitment/overview.repository.js'
import { mapPlatformOverviewToDTO } from '../mappers/recruitment/overview.mapper.js'

export default async function adminRecruitmentRoutes(app: FastifyInstance) {

  // ─── Sprint-05: 企业套餐管理（集成在求职招聘管理下）───

  // GET /api/admin/recruitment/plans — 套餐列表
  app.get('/api/admin/recruitment/plans', { preHandler: [requireAdmin] }, async () => {
    const plans = await prisma.enterprisePlan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { subscriptions: true } } },
    })
    return { success: true, data: plans }
  })

  // POST /api/admin/recruitment/plans — 创建套餐
  app.post('/api/admin/recruitment/plans', { preHandler: [requireAdmin] }, async (request, reply) => {
    const b = request.body as any
    if (!b.name || !b.displayName) {
      return reply.status(400).send({ success: false, message: 'name 和 displayName 为必填' })
    }
    if (b.price === undefined || b.price < 0) {
      return reply.status(400).send({ success: false, message: 'price 必须 ≥ 0' })
    }
    const plan = await prisma.enterprisePlan.create({
      data: {
        name: b.name,
        displayName: b.displayName,
        description: b.description || null,
        price: b.price,
        yearlyPrice: b.yearlyPrice || b.price * 10, // 默认年付=10个月
        originalPrice: b.originalPrice ?? b.price,
        currency: b.currency || 'CNY',
        billingCycle: b.billingCycle || 'monthly',
        maxEmployees: b.maxEmployees ?? 2,
        maxChannels: b.maxChannels ?? 1,
        maxMembers: b.maxMembers ?? 5,
        storageLimit: b.storageLimit ?? 5,
        requireOwnLLMKey: b.requireOwnLLMKey !== undefined ? b.requireOwnLLMKey : true,
        allowedProviders: b.allowedProviders ?? ['deepseek', 'openai', 'claude', 'zhipu'],
        quotaPolicy: b.quotaPolicy || 'unlimited',
        features: b.features ?? [],
        enabled: b.enabled !== undefined ? b.enabled : true,
        sortOrder: b.sortOrder ?? 0,
      },
    })
    return { success: true, data: plan }
  })

  // PUT /api/admin/recruitment/plans/:id — 更新套餐
  app.put('/api/admin/recruitment/plans/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    const b = request.body as any
    const data: any = {}
    if (b.name !== undefined) data.name = b.name
    if (b.displayName !== undefined) data.displayName = b.displayName
    if (b.description !== undefined) data.description = b.description
    if (b.price !== undefined) data.price = b.price
    if (b.yearlyPrice !== undefined) data.yearlyPrice = b.yearlyPrice
    if (b.originalPrice !== undefined) data.originalPrice = b.originalPrice
    if (b.currency !== undefined) data.currency = b.currency
    if (b.billingCycle !== undefined) data.billingCycle = b.billingCycle
    if (b.maxEmployees !== undefined) data.maxEmployees = b.maxEmployees
    if (b.maxChannels !== undefined) data.maxChannels = b.maxChannels
    if (b.maxMembers !== undefined) data.maxMembers = b.maxMembers
    if (b.storageLimit !== undefined) data.storageLimit = b.storageLimit
    if (b.requireOwnLLMKey !== undefined) data.requireOwnLLMKey = b.requireOwnLLMKey
    if (b.allowedProviders !== undefined) data.allowedProviders = b.allowedProviders
    if (b.quotaPolicy !== undefined) data.quotaPolicy = b.quotaPolicy
    if (b.features !== undefined) data.features = b.features
    if (b.enabled !== undefined) data.enabled = b.enabled
    if (b.sortOrder !== undefined) data.sortOrder = b.sortOrder

    const plan = await prisma.enterprisePlan.update({ where: { id }, data })
    return { success: true, data: plan }
  })

  // DELETE /api/admin/recruitment/plans/:id — 删除套餐
  // Sprint-RECRUITMENT-REALITY-03 T03: 删除保护 — 有历史订阅的套餐禁止硬删，改用 toggle 停用保持历史
  app.delete('/api/admin/recruitment/plans/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    const plan = await prisma.enterprisePlan.findUnique({
      where: { id },
      include: { _count: { select: { subscriptions: true } } },
    })
    if (!plan) return reply.status(404).send({ success: false, message: '套餐不存在' })
    if (plan._count.subscriptions > 0) {
      return reply.status(400).send({ success: false, message: '该套餐存在历史订阅，禁止硬删；请使用「停用」按钮（toggle）保留历史' })
    }
    await prisma.enterprisePlan.delete({ where: { id } })
    return { success: true }
  })

  // PATCH /api/admin/recruitment/plans/:id/toggle — 启用/停用
  app.patch('/api/admin/recruitment/plans/:id/toggle', { preHandler: [requireAdmin] }, async (request) => {
    const { id } = request.params as any
    const plan = await prisma.enterprisePlan.findUnique({ where: { id } })
    if (!plan) return { success: false, message: '套餐不存在' }
    const updated = await prisma.enterprisePlan.update({
      where: { id },
      data: { enabled: !plan.enabled },
    })
    return { success: true, data: { id: updated.id, enabled: updated.enabled } }
  })

  // ─── Sprint-05: 企业订阅管理（Admin 视角）───

  // GET /api/admin/recruitment/subscriptions — 所有企业订阅列表
  app.get('/api/admin/recruitment/subscriptions', { preHandler: [requireAdmin] }, async (request) => {
    const { status, page = 1, limit = 20 } = request.query as any
    const where: any = {}
    if (status) where.status = status
    // Sprint-ADMIN-IA-RECRUITMENT-CLEANUP-01：query 参数为字符串，需显式转 Int（Prisma take/skip 校验）
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))

    const [subscriptions, total] = await Promise.all([
      prisma.enterpriseSubscription.findMany({
        where,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          plan: true,
          organization: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.enterpriseSubscription.count({ where }),
    ])

    return { success: true, data: subscriptions, total, page: pageNum, limit: limitNum }
  })

  // GET /api/admin/recruitment/subscriptions/:id — 订阅详情
  app.get('/api/admin/recruitment/subscriptions/:id', { preHandler: [requireAdmin] }, async (request) => {
    const { id } = request.params as any
    const sub = await prisma.enterpriseSubscription.findUnique({
      where: { id },
      include: {
        plan: true,
        organization: { include: { profile: true } },
        entitlement: true,
      },
    })
    return { success: true, data: sub }
  })

  // PATCH /api/admin/recruitment/subscriptions/:id/status — 手动变更订阅状态
  app.patch('/api/admin/recruitment/subscriptions/:id/status', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    const { status, reason } = request.body as any
    if (!status || !['active', 'suspended', 'cancelled', 'expired'].includes(status)) {
      return reply.status(400).send({ success: false, message: '无效状态' })
    }

    const sub = await prisma.enterpriseSubscription.findUnique({ where: { id } })
    if (!sub) return reply.status(404).send({ success: false, message: '订阅不存在' })

    await prisma.enterpriseSubscription.update({
      where: { id },
      data: { status },
    })

    // 同步 Entitlement
    const { entitlementService } = await import('../services/enterprise/enterprise-entitlement.service.js')
    if (status === 'active') {
      await entitlementService.createFromSubscription(sub.organizationId, sub.id)
    } else {
      await entitlementService.setStatus(sub.organizationId, status === 'suspended' ? 'suspended' : 'expired', reason || `Admin ${status}`)
    }

    return { success: true, message: `订阅已${status === 'active' ? '激活' : status === 'suspended' ? '冻结' : '变更'}` }
  })

  // ─── 平台运营概览 ───
  app.get('/api/admin/recruitment/overview', { preHandler: [requireAdmin] }, async (_request, reply) => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const rawData = await overviewRepository.fetchPlatformOverview(today)
      const dto = mapPlatformOverviewToDTO(rawData)
      return reply.send(dto)
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch overview', message: error.message })
    }
  })

  // ─── 企业列表（用于筛选） ───
  app.get('/api/admin/recruitment/enterprises', { preHandler: [requireAdmin] }, async (_request, reply) => {
    try {
      const enterprises = await jobRepository.findEnterprises()
      return reply.send({ list: enterprises })
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch enterprises', message: error.message })
    }
  })

  // ─── 部门列表 ───
  app.get('/api/admin/recruitment/departments', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { page = '1', pageSize = '20', keyword, plan, sortBy } = request.query as any
      const pageNum = Math.max(1, parseInt(page) || 1)
      const size = Math.min(100, Math.max(1, parseInt(pageSize) || 20))
      const { list, total } = await departmentRepository.findList({ page: pageNum, pageSize: size, keyword, plan, sortBy })
      const dtoList = mapDepartmentListToDTOList(list)
      return reply.send({ list: dtoList, total, page: pageNum, pageSize: size })
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch departments', message: error.message })
    }
  })

  // ─── AI 员工管理 ───
  app.get('/api/admin/recruitment/agents', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { page = '1', pageSize = '20', state, type, keyword } = request.query as any
      const pageNum = Math.max(1, parseInt(page) || 1)
      const size = Math.min(100, Math.max(1, parseInt(pageSize) || 20))
      const skip = (pageNum - 1) * size

      const where: any = {}
      if (state) where.lifecycleState = state

      const [instances, total] = await Promise.all([
        prisma.enterpriseAgentInstance.findMany({
          where,
          skip,
          take: size,
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.enterpriseAgentInstance.count({ where }),
      ])

      // 手动关联 Profile + Organization（无 Prisma 关系定义）
      const employeeIds = [...new Set(instances.map((i) => i.employeeId))]
      const orgIds = [...new Set(instances.map((i) => i.organizationId).filter(Boolean))]
      const [profiles, orgs] = await Promise.all([
        prisma.enterpriseAgentProfile.findMany({
          where: { id: { in: employeeIds } },
          select: { id: true, name: true, agentType: true, description: true },
        }),
        prisma.organization.findMany({
          where: { id: { in: orgIds } },
          select: { id: true, name: true },
        }),
      ])
      const profileMap = new Map(profiles.map((p) => [p.id, p]))
      const orgMap = new Map(orgs.map((o) => [o.id, o]))

      // type & keyword 过滤在内存中执行
      let list = instances.map((inst) => {
        const profile = profileMap.get(inst.employeeId)
        const org = inst.organizationId ? orgMap.get(inst.organizationId) : null
        return {
          id: inst.id,
          tenantId: inst.tenantId,
          name: profile?.name || 'Unknown',
          agentType: profile?.agentType || 'unknown',
          description: profile?.description || null,
          lifecycleState: inst.lifecycleState,
          lastRecoveredAt: inst.lastRecoveredAt,
          updatedAt: inst.updatedAt,
          enterprise: org ? { id: org.id, name: org.name } : null,
        }
      })
      // 二次过滤
      if (type) list = list.filter((x) => x.agentType === type)
      if (keyword) list = list.filter((x) => x.name.toLowerCase().includes(keyword.toLowerCase()))

      // 统计各状态数量
      const stateStats = await prisma.enterpriseAgentInstance.groupBy({
        by: ['lifecycleState'],
        _count: { lifecycleState: true },
      })
      const stateStatsMap: Record<string, number> = {}
      for (const s of stateStats) stateStatsMap[s.lifecycleState] = s._count.lifecycleState

      return reply.send({ list, total, page: pageNum, pageSize: size, stateStats: stateStatsMap })
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch agents', message: error.message })
    }
  })

  // ─── Agent 模型配置（P5-ADMIN-01）───

  // GET /api/admin/recruitment/agent-model-config — 获取所有可用模型配置（不含密钥）
  app.get('/api/admin/recruitment/agent-model-config', { preHandler: [requireAdmin] }, async (_request, reply) => {
    try {
      // 从所有企业收集去重的模型配置
      const configs = await prisma.enterpriseLlmConfig.findMany({
        where: { enabled: true, status: 'active' },
        orderBy: [{ provider: 'asc' }, { modelName: 'asc' }],
        select: {
          id: true, tenantId: true, provider: true, modelName: true,
          baseUrl: true, maxTokensPerDay: true, maxRequestsPerMinute: true,
          capabilities: true, enabled: true, status: true, createdAt: true,
        },
      })
      // 去重：同 provider + modelName 只保留一条
      const seen = new Set<string>()
      const deduped = configs.filter(c => {
        const key = `${c.provider}/${c.modelName}`
        if (seen.has(key)) return false
        seen.add(key); return true
      })
      return reply.send({
        list: deduped.map(c => ({
          ...c,
          capabilities: (() => { try { return JSON.parse(c.capabilities || '[]') } catch { return [] } })(),
        })),
        total: deduped.length,
      })
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch model configs', message: error.message })
    }
  })

  // GET /api/admin/recruitment/agents/:id/model-binding — 获取 Agent 的模型绑定
  app.get('/api/admin/recruitment/agents/:id/model-binding', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const bindings = await prisma.agentModelBinding.findMany({
        where: { agentId: id },
        include: {
          llmConfig: {
            select: {
              id: true, provider: true, modelName: true, baseUrl: true,
              enabled: true, status: true,
            },
          },
        },
        orderBy: { priority: 'desc' },
      })
      return reply.send({
        agentId: id,
        bindings: bindings.map(b => ({
          id: b.id,
          llmConfigId: b.llmConfigId,
          taskType: b.taskType,
          priority: b.priority,
          temperature: b.temperature,
          maxTokens: b.maxTokens,
          fallbackEnabled: b.fallbackEnabled,
          failureStrategy: b.failureStrategy,
          enabled: b.enabled,
          provider: b.llmConfig?.provider,
          modelName: b.llmConfig?.modelName,
        })),
      })
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch model binding', message: error.message })
    }
  })

  // POST /api/admin/recruitment/agents/:id/model-binding — 创建/更新模型绑定
  app.post('/api/admin/recruitment/agents/:id/model-binding', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { id: agentId } = request.params as any
      const body = request.body as any

      // 验证 Agent 存在
      const agent = await prisma.enterpriseAgentProfile.findUnique({ where: { id: agentId } })
      if (!agent) return reply.status(404).send({ error: 'Agent not found' })

      const { llmConfigId, taskType, priority, temperature, maxTokens, fallbackEnabled, failureStrategy, enabled } = body

      // 验证 llmConfig 存在
      const llmConfig = await prisma.enterpriseLlmConfig.findUnique({ where: { id: llmConfigId } })
      if (!llmConfig) return reply.status(404).send({ error: 'LLM config not found' })

      // upsert：同 agentId + taskType 唯一
      const binding = await prisma.agentModelBinding.upsert({
        where: {
          agentId_llmConfigId_taskType: { agentId, llmConfigId, taskType: taskType || 'default' },
        },
        create: {
          tenantId: agent.tenantId,
          agentId,
          llmConfigId,
          taskType: taskType || 'default',
          priority: priority ?? 0,
          temperature: temperature ?? 0.7,
          maxTokens: maxTokens ?? 16384,
          fallbackEnabled: fallbackEnabled ?? true,
          failureStrategy: failureStrategy || 'fallback',
          enabled: enabled ?? true,
        },
        update: {
          priority: priority ?? 0,
          temperature: temperature ?? 0.7,
          maxTokens: maxTokens ?? 16384,
          fallbackEnabled: fallbackEnabled ?? true,
          failureStrategy: failureStrategy || 'fallback',
          enabled: enabled ?? true,
        },
      })

      return reply.send({
        id: binding.id,
        agentId: binding.agentId,
        llmConfigId: binding.llmConfigId,
        taskType: binding.taskType,
        provider: llmConfig.provider,
        modelName: llmConfig.modelName,
        enabled: binding.enabled,
      })
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to bind model', message: error.message })
    }
  })

  // DELETE /api/admin/recruitment/agents/:id/model-binding/:bindingId — 删除模型绑定
  app.delete('/api/admin/recruitment/agents/:id/model-binding/:bindingId', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { bindingId } = request.params as any
      await prisma.agentModelBinding.delete({ where: { id: bindingId } })
      return reply.send({ success: true })
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to delete binding', message: error.message })
    }
  })

  // POST /api/admin/recruitment/agent-model-config — 新增全局模型配置（管理员创建）
  app.post('/api/admin/recruitment/agent-model-config', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const body = request.body as any
      if (!body.provider || !body.modelName || !body.apiKey) {
        return reply.status(400).send({ error: 'provider / modelName / apiKey 必填' })
      }
      const config = await enterpriseLlmService.create({
        tenantId: body.tenantId || 'platform',
        provider: body.provider,
        modelName: body.modelName,
        apiKey: body.apiKey,
        baseUrl: body.baseUrl,
        maxTokensPerDay: body.maxTokensPerDay,
        maxRequestsPerMinute: body.maxRequestsPerMinute,
        capabilities: body.capabilities,
        enabled: body.enabled ?? true,
      })
      return reply.send({
        id: config.id,
        provider: config.provider,
        modelName: config.modelName,
        enabled: config.enabled,
        hasKey: true,
      })
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to create model config', message: error.message })
    }
  })

  // PATCH /api/admin/recruitment/agent-model-config/:id — 更新模型配置
  app.patch('/api/admin/recruitment/agent-model-config/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const body = request.body as any
      const update: any = {}
      if (body.provider !== undefined) update.provider = body.provider
      if (body.modelName !== undefined) update.modelName = body.modelName
      if (body.apiKey !== undefined) update.apiKey = body.apiKey
      if (body.baseUrl !== undefined) update.baseUrl = body.baseUrl
      if (body.maxTokensPerDay !== undefined) update.maxTokensPerDay = body.maxTokensPerDay
      if (body.maxRequestsPerMinute !== undefined) update.maxRequestsPerMinute = body.maxRequestsPerMinute
      if (body.capabilities !== undefined) update.capabilities = body.capabilities
      if (body.enabled !== undefined) update.enabled = body.enabled
      if (body.status !== undefined) update.status = body.status

      const config = await enterpriseLlmService.update(id, update)
      return reply.send({
        id: config.id,
        provider: config.provider,
        modelName: config.modelName,
        enabled: config.enabled,
        hasKey: true,
      })
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to update model config', message: error.message })
    }
  })

  // POST /api/admin/recruitment/agent-model-config/:id/test — 测试模型连通性
  app.post('/api/admin/recruitment/agent-model-config/:id/test', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const result = await enterpriseLlmService.testConnection(id)
      return reply.send(result)
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to test connection', message: error.message })
    }
  })

  // ─── AI 员工状态变更 ───
  app.patch('/api/admin/recruitment/agents/:id/state', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const { state } = request.body as any
      if (!state) return reply.status(400).send({ error: 'Missing state' })
      const updated = await prisma.enterpriseAgentInstance.update({
        where: { id },
        data: { lifecycleState: state },
        select: { id: true, lifecycleState: true },
      })
      return reply.send(updated)
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to update agent state', message: error.message })
    }
  })

  // ─── Runtime Monitor ───
  app.get('/api/admin/recruitment/runtime', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { state, type } = request.query as any
      const { rows, total } = await runtimeRepository.findMany({ state, type })
      const list = mapRuntimeListToDTOList(rows)
      const byState = await runtimeRepository.countByState()
      return reply.send({ list, byState, total })
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch runtime', message: error.message })
    }
  })

  // ─── Candidate Pool ───

  // ─── P5-ADMIN-04: Human Review Action Layer ───

  // 审核队列列表
  app.get('/api/admin/recruitment/reviews', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { page = '1', pageSize = '20', status, priority } = request.query as any
      const pageNum = Math.max(1, parseInt(page) || 1)
      const size = Math.min(100, Math.max(1, parseInt(pageSize) || 20))
      const skip = (pageNum - 1) * size

      const where: any = {}
      if (status) where.status = status
      if (priority) where.priority = parseInt(priority)

      const [items, total] = await Promise.all([
        prisma.humanReviewItem.findMany({
          where,
          skip,
          take: size,
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
          include: {
            conversation: {
              select: {
                id: true,
                status: true,
                stage: true,
                matchScore: true,
                jobPostingId: true,
                jobPosting: { select: { id: true, title: true } },
              },
            },
          },
        }),
        prisma.humanReviewItem.count({ where }),
      ])

      // 状态统计
      const statusGroups = await prisma.humanReviewItem.groupBy({
        by: ['status'],
        _count: { status: true },
      })
      const statusCounts: Record<string, number> = {}
      for (const g of statusGroups) statusCounts[g.status] = g._count.status

      return reply.send({
        list: items.map((item: any) => ({
          id: item.id,
          candidateName: item.candidateName,
          jobTitle: item.jobTitle,
          matchScore: item.matchScore,
          overallScore: item.overallScore,
          briefSummary: item.briefSummary,
          aiRecommendation: item.aiRecommendation,
          priority: item.priority,
          status: item.status,
          submittedAt: item.submittedAt,
          createdAt: item.createdAt,
          reviewedAt: item.reviewedAt,
          decision: item.decision,
          reviewNote: item.reviewNote,
          conversationId: item.conversationId,
          conversationStatus: item.conversation?.status || null,
          conversationStage: item.conversation?.stage || null,
          jobPostingTitle: item.conversation?.jobPosting?.title || null,
        })),
        total,
        page: pageNum,
        pageSize: size,
        statusCounts,
      })
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch reviews', message: error.message })
    }
  })

  // 审核详情
  app.get('/api/admin/recruitment/reviews/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const item = await prisma.humanReviewItem.findUnique({
        where: { id },
        include: {
          conversation: {
            include: {
              jobPosting: { select: { id: true, title: true, description: true } },
              briefs: { orderBy: { version: 'desc' }, take: 1 },
              pipeline: {
                include: {
                  events: { orderBy: { createdAt: 'desc' }, take: 10 },
                },
              },
            },
          },
        },
      })
      if (!item) return reply.status(404).send({ error: 'Review not found' })

      return reply.send({
        id: item.id,
        candidateName: item.candidateName,
        jobTitle: item.jobTitle,
        matchScore: item.matchScore,
        overallScore: item.overallScore,
        briefSummary: item.briefSummary,
        aiRecommendation: item.aiRecommendation,
        priority: item.priority,
        status: item.status,
        submittedAt: item.submittedAt,
        reviewedAt: item.reviewedAt,
        reviewedBy: item.reviewedBy,
        decision: item.decision,
        reviewNote: item.reviewNote,
        conversation: item.conversation ? {
          id: item.conversation.id,
          status: item.conversation.status,
          stage: item.conversation.stage,
          matchScore: item.conversation.matchScore,
          jobPosting: item.conversation.jobPosting,
          latestBrief: item.conversation.briefs?.[0] || null,
          pipeline: item.conversation.pipeline ? {
            id: item.conversation.pipeline.id,
            stage: item.conversation.pipeline.stage,
            events: item.conversation.pipeline.events,
          } : null,
        } : null,
      })
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch review detail', message: error.message })
    }
  })

  // 审核决策
  app.post('/api/admin/recruitment/reviews/:id/decision', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const { decision, note } = request.body as any

      if (!decision || !['approved', 'rejected', 'need_info'].includes(decision)) {
        return reply.status(400).send({ error: 'Invalid decision. Must be: approved, rejected, need_info' })
      }

      const item = await prisma.humanReviewItem.findUnique({
        where: { id },
        include: { conversation: true },
      })
      if (!item) return reply.status(404).send({ error: 'Review not found' })
      if (item.status !== 'pending') {
        return reply.status(409).send({ error: `Review already ${item.status}` })
      }

      // 更新审核项
      const updated = await prisma.humanReviewItem.update({
        where: { id },
        data: {
          status: decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'need_info',
          decision,
          reviewNote: note || null,
          reviewedAt: new Date(),
        },
        select: {
          id: true,
          candidateName: true,
          status: true,
          decision: true,
          reviewNote: true,
          reviewedAt: true,
          conversationId: true,
        },
      })

      // 级联更新 RecruitmentConversation 状态
      if (item.conversationId) {
        const convStatus = decision === 'approved' ? 'HR_APPROVED' : decision === 'rejected' ? 'HR_REJECTED' : 'NEED_INFO'
        await prisma.recruitmentConversation.update({
          where: { id: item.conversationId },
          data: { status: convStatus },
        })

        // 写入 PipelineEvent 审计记录
        if (item.conversation.pipelineId) {
          await prisma.pipelineEvent.create({
            data: {
              pipelineId: item.conversation.pipelineId,
              type: 'hr_review_decision',
              fromStage: undefined,
              toStage: undefined,
              actor: 'admin',
              metadata: {
                reviewId: id,
                decision,
                note: note || null,
              },
            },
          })
        }
      }

      return reply.send(updated)
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to submit review decision', message: error.message })
    }
  })

  // Pipeline 阶段推进
  app.post('/api/admin/recruitment/pipelines/:id/stage', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const { stage, note } = request.body as any

      if (!stage) return reply.status(400).send({ error: 'Missing stage' })

      const pipeline = await prisma.recruitmentPipeline.findUnique({ where: { id } })
      if (!pipeline) return reply.status(404).send({ error: 'Pipeline not found' })

      if (pipeline.stage === stage) {
        return reply.status(409).send({ error: `Already at stage: ${stage}` })
      }

      const fromStage = pipeline.stage

      // 更新 Pipeline 阶段
      const updated = await prisma.recruitmentPipeline.update({
        where: { id },
        data: { stage, lastActivityAt: new Date() },
        select: { id: true, stage: true, lastActivityAt: true },
      })

      // 写入 PipelineEvent
      await prisma.pipelineEvent.create({
        data: {
          pipelineId: id,
          type: 'stage_advance',
          fromStage,
          toStage: stage,
          actor: 'admin',
          metadata: { note: note || null },
        },
      })

      return reply.send(updated)
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to advance pipeline stage', message: error.message })
    }
  })

  // P5-ADMIN-02: 候选人统计面板
  app.get('/api/admin/recruitment/candidates/stats', { preHandler: [requireAdmin] }, async (_request, reply) => {
    try {
      const stats = await candidateRepository.stats()
      return reply.send(stats)
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch candidate stats', message: error.message })
    }
  })

  // P5-ADMIN-02: 候选人详情（含 CareerProfile + 匹配记录）
  app.get('/api/admin/recruitment/candidates/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const detail = await candidateRepository.findById(id)
      if (!detail) return reply.status(404).send({ error: 'Candidate not found' })
      return reply.send(detail)
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch candidate detail', message: error.message })
    }
  })

  // P5-ADMIN-03: 候选人 Review 聚合（候选人画像 + 匹配 + 推荐依据）
  app.get('/api/admin/recruitment/candidates/:id/review', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const detail = await candidateRepository.findById(id)
      if (!detail) return reply.status(404).send({ error: 'Candidate not found' })

      // 组装推荐理由（基于 matchBreakdown + aiAnalysis 真实数据）
      const recommendations = detail.matches?.map((m: any) => ({
        jobId: m.job?.id,
        jobTitle: m.job?.title,
        matchScore: m.matchScore,
        matchBreakdown: m.matchBreakdown,
        aiAnalysis: m.aiAnalysis,
        status: m.status,
        matchedAt: m.createdAt,
      })) || []

      return reply.send({
        candidate: {
          id: detail.id,
          name: detail.name,
          email: detail.email,
          phone: detail.phone,
          city: detail.city,
          education: detail.education,
          experienceYears: detail.experienceYears,
          careerGoal: detail.careerGoal,
          skills: detail.skills,
          completeness: detail.completeness,
          createdAt: detail.createdAt,
        },
        careerProfile: detail.careerProfile || null,
        talentProfile: detail.talentProfile || null,
        skillEvidence: detail.candidateSkills || [],
        workExperiences: detail.workExperiences || [],
        educations: detail.educations || [],
        matches: {
          total: detail.matchCount || 0,
          items: detail.matches || [],
        },
        recommendations,
      })
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch candidate review', message: error.message })
    }
  })

  app.get('/api/admin/recruitment/candidates', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { page = '1', pageSize = '20', keyword, quality, status, sortBy } = request.query as any
      const pageNum = Math.max(1, parseInt(page) || 1)
      const size = Math.min(100, Math.max(1, parseInt(pageSize) || 20))
      const skip = (pageNum - 1) * size

      const { rows, total } = await candidateRepository.findMany({ skip, take: size, keyword, quality, status, sortBy })
      const list = mapCandidateListToDTOList(rows)
      return reply.send({ list, total, page: pageNum, pageSize: size })
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch candidates', message: error.message })
    }
  })

  // ─── Job Pool ───
  app.get('/api/admin/recruitment/jobs', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { page = '1', pageSize = '20', status, enterpriseId, keyword } = request.query as any
      const pageNum = Math.max(1, parseInt(page) || 1)
      const size = Math.min(100, Math.max(1, parseInt(pageSize) || 20))
      const skip = (pageNum - 1) * size

      const { rows, total } = await jobRepository.findMany({ skip, take: size, status, enterpriseId, keyword })
      const list = mapJobListToDTOList(rows)
      return reply.send({ list, total, page: pageNum, pageSize: size })
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch jobs', message: error.message })
    }
  })

  // ─── 岗位详情 ───
  app.get('/api/admin/recruitment/jobs/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const job = await jobRepository.findById(id)
      if (!job) return reply.status(404).send({ error: 'Job not found' })
      return reply.send(job)
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch job detail', message: error.message })
    }
  })

  // ─── 岗位状态变更 ───
  app.patch('/api/admin/recruitment/jobs/:id/status', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const { status } = request.body as any
      if (!status) return reply.status(400).send({ error: 'Missing status' })
      const updated = await jobRepository.updateStatus(id, status)
      return reply.send(updated)
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to update job status', message: error.message })
    }
  })

  // ─── Campaign 列表 ───
  app.get('/api/admin/recruitment/campaigns', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { page = '1', pageSize = '20', status, keyword } = request.query as any
      const pageNum = Math.max(1, parseInt(page) || 1)
      const size = Math.min(100, Math.max(1, parseInt(pageSize) || 20))
      const skip = (pageNum - 1) * size

      const where: any = {}
      if (status) where.status = status
      if (keyword) where.title = { contains: keyword, mode: 'insensitive' as any }

      const [campaigns, total] = await Promise.all([
        prisma.recruitmentCampaign.findMany({
          where,
          skip,
          take: size,
          orderBy: { createdAt: 'desc' },
          include: {
            enterprise: { select: { id: true, name: true } },
            _count: { select: { candidateMatches: true } },
          },
        }),
        prisma.recruitmentCampaign.count({ where }),
      ])

      // 状态统计
      const statusGroups = await prisma.recruitmentCampaign.groupBy({
        by: ['status'],
        _count: { status: true },
      })
      const statusCounts: Record<string, number> = {}
      for (const g of statusGroups) statusCounts[g.status] = g._count.status

      return reply.send({ list: campaigns, total, page: pageNum, pageSize: size, statusCounts })
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch campaigns', message: error.message })
    }
  })

  // ─── Campaign 审批 ───
  app.post('/api/admin/recruitment/campaigns/:id/approve', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const updated = await prisma.recruitmentCampaign.update({
        where: { id },
        data: { status: 'approved' },
        select: { id: true, title: true, status: true },
      })
      return reply.send(updated)
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to approve campaign', message: error.message })
    }
  })

  // ─── Campaign 状态变更 ───
  app.patch('/api/admin/recruitment/campaigns/:id/status', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const { status } = request.body as any
      if (!status) return reply.status(400).send({ error: 'Missing status' })
      const updated = await prisma.recruitmentCampaign.update({
        where: { id },
        data: { status },
        select: { id: true, title: true, status: true },
      })
      return reply.send(updated)
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to update campaign status', message: error.message })
    }
  })

  // ─── Conversation 列表 ───
  app.get('/api/admin/recruitment/conversations', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { page = '1', pageSize = '20', status, keyword, sortBy } = request.query as any
      const pageNum = Math.max(1, parseInt(page) || 1)
      const size = Math.min(100, Math.max(1, parseInt(pageSize) || 20))
      const skip = (pageNum - 1) * size

      const { rows, total } = await conversationRepository.findMany({ skip, take: size, status, keyword, sortBy })
      const list = mapConversationListToDTOList(rows)

      // Pipeline 状态统计
      const pipelineCounts = await prisma.recruitmentConversation.groupBy({
        by: ['status'],
        _count: { status: true },
      })
      const pipelineCountsMap: Record<string, number> = {}
      for (const pc of pipelineCounts) pipelineCountsMap[pc.status] = pc._count.status

      return reply.send({ list, total, page: pageNum, pageSize: size, pipelineCounts: pipelineCountsMap })
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch conversations', message: error.message })
    }
  })

  // ─── Interview 列表 ───
  app.get('/api/admin/recruitment/interviews', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { page = '1', pageSize = '20', status, score, keyword } = request.query as any
      const pageNum = Math.max(1, parseInt(page) || 1)
      const size = Math.min(100, Math.max(1, parseInt(pageSize) || 20))

      const { list, total } = await interviewRepository.findList({ page: pageNum, pageSize: size, status, score, keyword })
      const dtoList = mapInterviewListToDTOList(list)
      return reply.send({ list: dtoList, total, page: pageNum, pageSize: size })
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch interviews', message: error.message })
    }
  })

  // ─── 审计中心 ───
  app.get('/api/admin/recruitment/audit', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { page = '1', pageSize = '50', keyword, status, action, dateFrom, dateTo } = request.query as any
      const pageNum = Math.max(1, parseInt(page) || 1)
      const size = Math.min(200, Math.max(1, parseInt(pageSize) || 50))
      const skip = (pageNum - 1) * size

      const { rows, total } = await auditRepository.findMany({ skip, take: size, keyword, status, action, dateFrom, dateTo })
      const list = mapAuditListToDTOList(rows)

      // 汇总统计
      const [successCount, failureCount, totalCost] = await Promise.all([
        prisma.auditLog.count({ where: { status: 'success' } }),
        prisma.auditLog.count({ where: { status: 'failure' } }),
        prisma.auditLog.aggregate({ _sum: { cost: true } }),
      ])

      // 操作类型列表
      const actionTypes = await prisma.auditLog.groupBy({
        by: ['action'],
        _count: { action: true },
      })

      return reply.send({
        list, total, page: pageNum, pageSize: size,
        summary: {
          success: successCount,
          failure: failureCount,
          totalCost: totalCost._sum.cost ?? 0,
        },
        actionTypes: actionTypes.map(a => a.action),
      })
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to fetch audit', message: error.message })
    }
  })

  // ─── Sprint-06: Enterprise Revenue Analytics ───

  // GET /api/admin/recruitment/revenue — 收入总览
  app.get('/api/admin/recruitment/revenue', { preHandler: [requireAdmin] }, async () => {
    // 1. 企业总数 & 付费企业数
    const [totalOrgs, paidOrgs] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { subscription: { isNot: null } } }),
    ])

    // 2. 当前有效订阅（MRR 基础）
    const activeSubs = await prisma.enterpriseSubscription.findMany({
      where: { status: 'active' },
      select: { snapshotPrice: true, snapshotCycle: true, plan: { select: { price: true, yearlyPrice: true, displayName: true } } },
    })

    // MRR 计算：月付=月价格，年付=年价格/12
    let mrr = 0
    for (const sub of activeSubs) {
      const monthlyAmount = sub.snapshotCycle === 'yearly'
        ? (sub.snapshotPrice ?? sub.plan.yearlyPrice) / 12
        : (sub.snapshotPrice ?? sub.plan.price)
      mrr += monthlyAmount
    }
    const arr = mrr * 12

    // 3. 本月收入（已支付订单）
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const [monthRevenueResult, totalRevenueResult] = await Promise.all([
      prisma.paymentOrder.aggregate({
        where: { type: 'enterprise_subscription', status: 'paid', payTime: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.paymentOrder.aggregate({
        where: { type: 'enterprise_subscription', status: 'paid' },
        _sum: { amount: true },
      }),
    ])

    // 4. 本月新增企业
    const newOrgsThisMonth = await prisma.organization.count({
      where: { createdAt: { gte: monthStart } },
    })

    // 5. 套餐分布
    const planDistribution = await prisma.enterpriseSubscription.groupBy({
      by: ['planId'],
      where: { status: 'active' },
      _count: { planId: true },
    })
    const planDetails = await prisma.enterprisePlan.findMany({
      where: { id: { in: planDistribution.map(p => p.planId) } },
      select: { id: true, displayName: true },
    })
    const planMap = new Map(planDetails.map(p => [p.id, p.displayName]))
    const planStats = planDistribution.map(p => ({
      planId: p.planId,
      planName: planMap.get(p.planId) || 'Unknown',
      count: p._count.planId,
      revenueShare: activeSubs.filter(s => s.plan.displayName === planMap.get(p.planId)).length > 0
        ? Math.round((activeSubs.filter(s => s.plan.displayName === planMap.get(p.planId)).reduce((sum, s) => {
            const monthly = s.snapshotCycle === 'yearly' ? (s.snapshotPrice ?? s.plan.yearlyPrice) / 12 : (s.snapshotPrice ?? s.plan.price)
            return sum + monthly
          }, 0) / mrr) * 100)
        : 0,
    }))

    // 6. 订阅状态分布
    const subStatusStats = await prisma.enterpriseSubscription.groupBy({
      by: ['status'],
      _count: { status: true },
    })

    return {
      success: true,
      data: {
        overview: {
          totalOrgs,
          paidOrgs,
          mrr: Math.round(mrr), // 分
          arr: Math.round(arr), // 分
          monthRevenue: Math.round((monthRevenueResult._sum.amount ?? 0) * 100), // 元转分
          totalRevenue: Math.round((totalRevenueResult._sum.amount ?? 0) * 100), // 元转分
          newOrgsThisMonth,
          activeSubsCount: activeSubs.length,
        },
        planDistribution: planStats,
        subscriptionStatus: subStatusStats.map(s => ({ status: s.status, count: s._count.status })),
      },
    }
  })

  // GET /api/admin/recruitment/revenue/ai-roi — AI Employee ROI
  app.get('/api/admin/recruitment/revenue/ai-roi', { preHandler: [requireAdmin] }, async () => {
    // 1. 每个 AI Employee 的使用量和成本
    const agentUsage = await prisma.agentAuditTrail.groupBy({
      by: ['agentId'],
      _sum: { tokenUsage: true, cost: true, durationMs: true },
      _count: { id: true },
    })

    // 2. 获取 agent 信息
    const agentIds = agentUsage.map(a => a.agentId).filter(Boolean) as string[]
    const agentInstances = await prisma.enterpriseAgentInstance.findMany({
      where: { agentId: { in: agentIds } },
      select: { agentId: true, tenantId: true },
    })
    const agentMap = new Map(agentInstances.map(a => [a.agentId, a]))

    // 3. 获取组织信息
    const tenantIds = [...new Set(agentInstances.map(a => a.tenantId))]
    const orgs = await prisma.organization.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true },
    })
    const orgMap = new Map(orgs.map(o => [o.id, o.name]))

    // 4. 获取使用量（UsageLog）
    const usageByTenant = await prisma.usageLog.groupBy({
      by: ['tenantId'],
      where: { tenantId: { in: tenantIds } },
      _sum: { cost: true },
      _count: { id: true },
    })
    const usageMap = new Map(usageByTenant.map(u => [u.tenantId, u]))

    const aiRoi = agentUsage.filter(a => a.agentId).map(a => {
      const instance = agentMap.get(a.agentId!)
      const tenantId = instance?.tenantId
      const orgName = tenantId ? orgMap.get(tenantId) : 'Unknown'
      const usage = tenantId ? usageMap.get(tenantId) : null

      return {
        agentId: a.agentId,
        orgName,
        executionCount: a._count.id,
        totalTokens: a._sum.tokenUsage ?? 0,
        totalCost: Math.round((a._sum.cost ?? 0) * 100), // 元转分
        avgDurationMs: Math.round((a._sum.durationMs ?? 0) / (a._count.id || 1)),
        usageCost: Math.round((usage?._sum.cost ?? 0) * 100), // 元转分
      }
    }).sort((a, b) => b.totalCost - a.totalCost)

    return { success: true, data: aiRoi }
  })

  // GET /api/admin/recruitment/customers — 客户成功看板
  app.get('/api/admin/recruitment/customers', { preHandler: [requireAdmin] }, async (request) => {
    const { page = 1, limit = 20, risk } = request.query as any

    // 1. 获取所有有效订阅的企业
    const subs = await prisma.enterpriseSubscription.findMany({
      where: { status: 'active' },
      include: {
        plan: true,
        organization: {
          include: {
            profile: true,
            _count: { select: { members: true } },
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    // 2. 获取每个企业的 AI Employee 数量
    const orgIds = subs.map(s => s.organizationId)
    const agentCounts = await prisma.enterpriseAgentInstance.groupBy({
      by: ['tenantId'],
      where: { tenantId: { in: orgIds } },
      _count: { agentId: true },
    })
    const agentCountMap = new Map(agentCounts.map(a => [a.tenantId, a._count.agentId]))

    // 3. 获取本月使用量
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const usageThisMonth = await prisma.usageLog.groupBy({
      by: ['tenantId'],
      where: { tenantId: { in: orgIds }, createdAt: { gte: monthStart } },
      _sum: { cost: true },
      _count: { id: true },
    })
    const usageMap = new Map(usageThisMonth.map(u => [u.tenantId, u]))

    // 4. 获取 AgentAuditTrail 本月成本
    const auditThisMonth = await prisma.agentAuditTrail.groupBy({
      by: ['tenantId'],
      where: { tenantId: { in: orgIds }, createdAt: { gte: monthStart } },
      _sum: { cost: true, tokenUsage: true },
    })
    const auditMap = new Map(auditThisMonth.map(a => [a.tenantId, a]))

    // 5. 计算续费风险
    const days30FromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const customers = subs.map(sub => {
      const orgId = sub.organizationId
      const usage = usageMap.get(orgId)
      const audit = auditMap.get(orgId)
      const agentCount = agentCountMap.get(orgId) ?? 0
      const monthUsageCount = usage?._count.id ?? 0
      const monthCost = Math.round(((usage?._sum.cost ?? 0) + (audit?._sum.cost ?? 0)) * 100) // 分
      const tokensUsed = audit?._sum.tokenUsage ?? 0

      // 额度使用率（基于 maxAgents）
      const maxAgents = sub.snapshotMaxEmployees ?? sub.plan.maxEmployees
      const agentUsageRate = maxAgents > 0 ? Math.round((agentCount / maxAgents) * 100) : 0

      // 续费风险规则
      let riskLevel = 'healthy'
      const daysToExpire = Math.ceil((sub.expireAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysToExpire <= 30 && monthUsageCount < 10) {
        riskLevel = 'high' // 即将到期 + 低使用
      } else if (agentUsageRate >= 90) {
        riskLevel = 'high' // 额度即将耗尽
      } else if (monthUsageCount > 100 && sub.status === 'active') {
        riskLevel = 'high_value' // 高使用 + 持续付费
      } else if (daysToExpire <= 60) {
        riskLevel = 'medium' // 中期关注
      }

      return {
        orgId,
        orgName: sub.organization.name,
        planName: sub.plan.displayName,
        agentCount,
        maxAgents,
        agentUsageRate,
        monthUsageCount,
        monthCost, // 分
        tokensUsed,
        expireAt: sub.expireAt.toISOString(),
        daysToExpire,
        riskLevel,
      }
    })

    // 按风险过滤
    const filtered = risk ? customers.filter(c => c.riskLevel === risk) : customers

    // 统计
    const [totalHighRisk, totalHighValue, totalMedium] = await Promise.all([
      prisma.enterpriseSubscription.count({ where: { status: 'active', expireAt: { lte: days30FromNow } } }),
      prisma.enterpriseSubscription.count({ where: { status: 'active' } }),
      prisma.enterpriseSubscription.count({ where: { status: 'active', expireAt: { lte: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000) } } }),
    ])

    return {
      success: true,
      data: filtered,
      summary: {
        total: subs.length,
        highRisk: customers.filter(c => c.riskLevel === 'high').length,
        highValue: customers.filter(c => c.riskLevel === 'high_value').length,
        medium: customers.filter(c => c.riskLevel === 'medium').length,
        healthy: customers.filter(c => c.riskLevel === 'healthy').length,
      },
      page,
      limit,
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // Sprint-ADMIN-IA-RECRUITMENT-CLEANUP-01
  // 求职管家 Agent 产品定义（只读）— 管理「产品」不管理「模型」
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/admin/recruitment/agent-product', { preHandler: [requireAdmin] }, async (_request, reply) => {
    try {
      const { STATIC_SYSTEM_PROMPT } = await import('../services/career/career-advisor.service.js')
      const capabilities = [
        { code: 'resume_analysis', name: '简历分析', desc: '解析用户简历，提炼技能/经历/优势，输出结构化职业画像', enabled: true },
        { code: 'career_planning', name: '职业规划', desc: '基于用户背景与目标，提供转行/晋升/技能提升路线建议', enabled: true },
        { code: 'job_recommendation', name: '岗位推荐', desc: '根据画像输出求职方向与岗位匹配思路（不编造具体 JD）', enabled: true },
        { code: 'interview_coaching', name: '面试辅导', desc: '生成面试问题、提供回答框架与表达建议', enabled: true },
      ]
      const base = {
        name: 'Career Agent',
        displayName: '求职管家',
        avatar: '🧠',
        description: '昆仑镜求职工作台的 AI 职业助理：帮助求职者认识职业优势、分析求职方向、创建简历、提供职业建议。',
        status: 'active',
        audience: '所有登录用户（平台公共 AI Agent）',
        modelPolicy: '平台托管模型（career_advisor 白名单）；企业 AI 员工走 用户模型设置 → Runtime Resolver → Agent 执行（昆仑镜统一架构）',
      }
      const versions = [
        { version: 'v1', label: '当前线上版本', status: 'released', releasedAt: '2026-06', note: 'STATIC_SYSTEM_PROMPT · KV Cache 友好静态提示词', content: STATIC_SYSTEM_PROMPT },
        { version: 'v2', label: '规划中', status: 'planned', releasedAt: null, note: '待产品决策，版本走代码发布管理，不在此后台编辑' },
      ]
      return reply.send({ success: true, data: { base, capabilities, versions } })
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: error.message })
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // 企业套餐授权 — Admin 开通/续期（链路：Subscription → Entitlement → Provision）
  // 幂等：同一企业仅一条订阅（organizationId unique），重复开通 = 续期/换套餐
  // ═══════════════════════════════════════════════════════════════
  app.post('/api/admin/recruitment/authorization/grant', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { organizationId, planId, cycle = 'monthly', periodDays = 30 } = (request.body || {}) as any
      if (!organizationId || !planId) {
        return reply.status(400).send({ success: false, message: '缺少 organizationId / planId' })
      }
      const [org, plan] = await Promise.all([
        prisma.organization.findUnique({ where: { id: organizationId } }),
        prisma.enterprisePlan.findUnique({ where: { id: planId } }),
      ])
      if (!org) return reply.status(404).send({ success: false, message: '企业不存在' })
      if (!plan) return reply.status(404).send({ success: false, message: '套餐不存在' })

      const price = cycle === 'yearly' ? plan.yearlyPrice : plan.price
      const expireAt = new Date(Date.now() + Math.max(1, Number(periodDays) || 30) * 86400_000)

      // organizationId 唯一 → upsert（首次=开通，再次=续期/换套餐）
      const snapshot = {
        snapshotName: plan.displayName,
        snapshotPrice: price,
        snapshotCycle: cycle,
        snapshotMaxEmployees: plan.maxEmployees,
        snapshotMaxChannels: plan.maxChannels,
        snapshotMaxMembers: plan.maxMembers,
        snapshotFeatures: plan.features as any,
      }
      const subscription = await prisma.enterpriseSubscription.upsert({
        where: { organizationId },
        create: { organizationId, planId, status: 'active', startAt: new Date(), expireAt, autoRenew: true, ...snapshot },
        update: { planId, status: 'active', startAt: new Date(), expireAt, autoRenew: true, ...snapshot },
      })

      // Entitlement 同步（权益 = 订阅的实时兑现）
      const { entitlementService } = await import('../services/enterprise/enterprise-entitlement.service.js')
      const entitlement = await entitlementService.createFromSubscription(organizationId, subscription.id)

      // Provision AI 员工（按套餐 employees 配置幂等创建 Profile + Instance）
      // ⚠️ 注：employeeTemplate model 不存在于 schema，旧 provision 服务为死代码；此处内联幂等实现
      const provision = await provisionEmployeesByPlan(plan, organizationId)

      return reply.send({
        success: true,
        data: {
          subscriptionId: subscription.id,
          organizationId,
          planId,
          cycle,
          expireAt: expireAt.toISOString(),
          entitlement,
          provision,
        },
      })
    } catch (error: any) {
      console.error('[Authorization/Grant] ERROR:', error)
      return reply.status(500).send({ success: false, message: error.message })
    }
  })

  // ── 内置幂等 Provision：按套餐 capabilityCodes.employees 创建 EnterpriseAgentProfile + Instance ──
  async function provisionEmployeesByPlan(plan: any, organizationId: string) {
    const raw = plan.capabilityCodes as any
    let employees: Array<{ role: string; displayName: string }> = []
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      employees = Array.isArray(raw.employees) ? (raw.employees as Array<{ role: string; displayName: string }>) : []
    }
    const tenantId = organizationId
    const result: { provisioned: number; skipped: number; employees: any[] } = { provisioned: 0, skipped: 0, employees: [] }

    for (const emp of employees) {
      const role = emp.role
      const existing = await prisma.enterpriseAgentProfile.findFirst({ where: { organizationId, role } })
      if (existing) {
        result.skipped++
        result.employees.push({ id: existing.id, name: existing.name, role, status: 'skipped' })
        continue
      }
      const profile = await prisma.enterpriseAgentProfile.create({
        data: {
          tenantId,
          organizationId,
          name: emp.displayName || role,
          role,
          agentType: role,
          status: 'active',
          runtimeStatus: 'active',
          knowledgeScope: '[]',
          tools: '[]',
          permissions: '[]',
          capabilities: JSON.stringify(Array.isArray(raw) ? raw : []),
          metadata: '{}',
        },
      })
      const shortId = profile.id.slice(0, 8)
      const instance = await prisma.enterpriseAgentInstance.create({
        data: {
          tenantId,
          organizationId,
          employeeId: profile.id,
          agentId: `agent_${tenantId.slice(0, 8)}_${shortId}`,
          namespace: `tenant_${tenantId.slice(0, 8)}_${role}`,
          runtime: 'openclaw',
          runtimeStatus: 'active',
          lifecycleState: 'ACTIVE',
        },
      })
      result.provisioned++
      result.employees.push({ id: profile.id, instanceId: instance.id, name: profile.name, role, status: 'provisioned' })
    }
    return result
  }
}
