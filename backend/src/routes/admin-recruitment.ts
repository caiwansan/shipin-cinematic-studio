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
      if (type) where.profile = { agentType: type }
      if (keyword) where.profile = { ...where.profile, name: { contains: keyword, mode: 'insensitive' as any } }

      const [instances, total] = await Promise.all([
        prisma.enterpriseAgentInstance.findMany({
          where,
          skip,
          take: size,
          orderBy: { updatedAt: 'desc' },
          include: {
            profile: { select: { name: true, agentType: true, description: true } },
            enterprise: { select: { id: true, name: true } },
          },
        }),
        prisma.enterpriseAgentInstance.count({ where }),
      ])

      const list = instances.map(inst => ({
        id: inst.id,
        tenantId: inst.tenantId,
        name: inst.profile?.name || 'Unknown',
        agentType: inst.profile?.agentType || 'unknown',
        description: inst.profile?.description || null,
        lifecycleState: inst.lifecycleState,
        lastRecoveredAt: inst.lastRecoveredAt,
        updatedAt: inst.updatedAt,
        enterprise: inst.enterprise ? { id: inst.enterprise.id, name: inst.enterprise.name } : null,
      }))

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

  // P5-ADMIN-02: 候选人详情（含 TalentProfile + 匹配记录）
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
}
