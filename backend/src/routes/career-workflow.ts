/**
 * Career Workflow Routes — KM-AI-JOB-AGENT-08
 * AI 职业助理 Hermes Workflow API
 *
 * 端点：
 *   POST /api/career/agent/create           — 创建并部署 AI 职业助理
 *   GET  /api/career/agent/status           — 查询 AI 职业助理状态
 *   POST /api/career/workflow/execute       — 执行 Career Workflow
 *   GET  /api/career/workflow/history       — 查询执行历史
 */

import type { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { AgentExecutorImpl } from '../agent-runtime/brain/agent-executor'
import { CareerAgentService } from '../services/enterprise/workflow/career-agent.service'
import { createCareerWorkflowExecutor, type CareerWorkflowType } from '../services/enterprise/workflow/career-workflow-executor'
import { resolveCurrentEnterprise } from '../services/enterprise-context.service.js'

export async function careerWorkflowRoutes(fastify: FastifyInstance) {
  const prisma = new PrismaClient()
  const executor = new AgentExecutorImpl(prisma)
  const careerAgentService = new CareerAgentService(prisma)
  const careerWorkflowExec = createCareerWorkflowExecutor(prisma, executor)

  // ─── 创建 AI 职业助理 ─────────────────────────────────
  fastify.post<{
    Body: {
      goal?: string
      resumeId?: string
    }
  }>('/api/career/agent/create', { preHandler: fastify.authenticate }, async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'User identity required' })
    }

    const { goal, resumeId } = request.body as any

    try {
      // Sprint-09B-3A Task 02-B: 权益门控
      const entitlement = await careerAgentService.checkProvisionEntitlement(userId)
      if (!entitlement.allowed) {
        return reply.code(403).send({
          error: 'ENTITLEMENT_REQUIRED',
          message: entitlement.reason,
          action: 'purchase_career_agent',
        })
      }

      // 检查是否已存在
      const exists = await careerAgentService.hasCareerAgent(userId)
      if (exists) {
        const existing = await careerAgentService.getCareerAgent(userId)
        return reply.send({
          message: 'AI 职业助理已存在',
          agent: existing,
        })
      }

      const agent = await careerAgentService.createAndDeploy({
        userId,
        userName: (request as any).user?.username || '用户',
        goal,
        resumeId,
      })

      // Sprint-10 T01: 同步 subscription provisioning 状态
      try {
        const plan = await prisma.subscriptionPlan.findUnique({ where: { code: 'career_agent' } })
        if (plan) {
          const sub = await prisma.subscription.findFirst({
            where: { tenantId: userId, planId: plan.id, status: 'active' },
            orderBy: { createdAt: 'desc' },
          })
          if (sub) {
            let meta: Record<string, any> = {}
            try { meta = JSON.parse(sub.metadata || '{}') } catch {}
            await prisma.subscription.update({
              where: { id: sub.id },
              data: {
                metadata: JSON.stringify({
                  ...meta,
                  provisioningStatus: 'active',
                  provisionedVia: 'api_create',
                  provisioningUpdatedAt: new Date().toISOString(),
                }),
              },
            })
          }
        }
      } catch (syncErr: any) {
        console.warn(`[career-workflow] 同步 provisioning 状态失败: ${syncErr.message}`)
      }

      return reply.send({
        message: 'AI 职业助理创建成功',
        agent,
      })
    } catch (err: any) {
      return reply.code(500).send({
        error: 'CREATE_FAILED',
        message: err.message,
      })
    }
  })

  // ─── 查询 AI 职业助理状态（真实数据 + 统计） ──────────
  fastify.get('/api/career/agent/status', { preHandler: fastify.authenticate }, async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'User identity required' })
    }

    try {
      const agent = await careerAgentService.getCareerAgent(userId)
      if (!agent) {
        // Sprint-10 T01: 查询 provisioning 状态
        const plan = await prisma.subscriptionPlan.findUnique({ where: { code: 'career_agent' } })
        const subscription = plan ? await prisma.subscription.findFirst({
          where: { tenantId: userId, planId: plan.id, status: 'active' },
        }) : null

        // 检查 provisioning 状态
        let provisioningStatus: string | undefined
        let provisioningError: string | undefined
        if (subscription?.metadata) {
          try {
            const meta = JSON.parse(subscription.metadata)
            provisioningStatus = meta.provisioningStatus
            provisioningError = meta.provisioningError
          } catch {}
        }

        let message = '尚未创建 AI 职业助理'
        if (provisioningStatus === 'failed') {
          message = provisioningError ? `Agent 创建失败: ${provisioningError}，请重试` : 'Agent 创建失败，请重试'
        } else if (subscription && !provisioningStatus) {
          message = '订阅已激活，请创建 AI 职业助理'
        } else if (provisioningStatus === 'provisioning' || provisioningStatus === 'pending') {
          message = 'Agent 正在创建中，请稍候'
        }

        return reply.send({
          hasAgent: false,
          status: provisioningStatus === 'failed' ? 'provisioning_failed' : 'not_created',
          hasActiveSubscription: !!subscription,
          subscriptionStatus: subscription?.status || null,
          provisioningStatus,      // 'pending' | 'provisioning' | 'failed' | undefined
          provisioningError,        // 失败原因
          message,
          stats: { totalTasks: 0, completedTasks: 0, failedTasks: 0 },
          recentTasks: [],
        })
      }

      const instance = await (prisma as any).enterpriseAgentInstance.findUnique({
        where: { employeeId: agent.profileId },
      })

      // Sprint-SSOT-OBSERVATION-1B-7: tenantId 从 enterprise context 解析，不再用 userId
      const enterpriseContext = await resolveCurrentEnterprise(userId)
      const tasks = await (prisma as any).enterpriseAgentTask.findMany({
        where: { tenantId: enterpriseContext?.enterpriseId || userId },
        orderBy: { startedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          taskType: true,
          status: true,
          inputSummary: true,
          startedAt: true,
          completedAt: true,
        },
      })

      // SPRINT-CAREER-REALITY-01: 查询订阅状态（hasAgent 分支统一返回，支付轮询依赖）
      let subscriptionActive: any = null
      try {
        const careerPlan = await prisma.subscriptionPlan.findUnique({ where: { code: 'career_agent' } })
        subscriptionActive = careerPlan ? await prisma.subscription.findFirst({
          where: { tenantId: userId, planId: careerPlan.id, status: 'active' },
        }) : null
      } catch { /* ignore */ }

      return reply.send({
        hasAgent: true,
        hasActiveSubscription: !!subscriptionActive,
        subscriptionStatus: subscriptionActive?.status || null,
        status: instance?.runtimeStatus || agent.status,
        agent: {
          profileId: agent.profileId,
          instanceId: agent.instanceId,
          name: agent.agentName,
          runtime: instance?.runtime,
          lifecycleState: instance?.lifecycleState,
          tools: agent.tools,
          memoryNamespace: agent.memoryNamespace,
          identityProvider: agent.bindingId ? 'hermes' : undefined,
        },
        stats: {
          totalTasks: tasks.length,
          completedTasks: tasks.filter((t: any) => t.status === 'completed').length,
          failedTasks: tasks.filter((t: any) => t.status === 'failed').length,
        },
        recentTasks: tasks,
      })
    } catch (err: any) {
      return reply.code(500).send({
        error: 'QUERY_FAILED',
        message: err.message,
      })
    }
  })

  // ─── 执行 Career Workflow ─────────────────────────────
  fastify.post<{
    Body: {
      workflowType: CareerWorkflowType
      params?: Record<string, any>
    }
  }>('/api/career/workflow/execute', { preHandler: fastify.authenticate }, async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'User identity required' })
    }

    const { workflowType, params } = request.body as any

    if (!workflowType) {
      return reply.code(400).send({ error: 'MISSING_PARAMS', message: 'workflowType is required' })
    }

    try {
      // SPRINT-CAREER-REALITY-01: Career Agent 个人用户 BYOK Gate（KMKI Runtime Principle）
      // 纯个人用户（无企业关联）必须配置 UserModelConfigV2，禁止静默走平台 Key
      const enterprise = await resolveCurrentEnterprise(userId)
      if (!enterprise) {
        const { userModelConfigV2Repository } = await import('../services/hdz/repositories/user-model-config-v2.repository.js')
        const v2 = await userModelConfigV2Repository.findUnique({ userId })
        const hasByok = v2 && v2.llmEnabled && v2.llmApiKey && v2.llmApiKey.trim()
        if (!hasByok) {
          return reply.code(400).send({
            error: 'NO_BYOK_CONFIG',
            message: '未配置 AI 模型。请先在大模型设置中配置你自己的 API Key（DeepSeek/OpenAI/豆包等）',
            action: 'configure_model',
          })
        }
      }

      // 获取用户的 AI 职业助理 Runtime Context
      const runtimeCtx = await careerAgentService.getRuntimeContext(userId)
      if (!runtimeCtx) {
        // 自动创建 AI 职业助理
        const newAgent = await careerAgentService.createAndDeploy({
          userId,
          userName: (request as any).user?.username || '用户',
        })
        const ctx = await careerAgentService.getRuntimeContext(userId)
        if (!ctx) {
          return reply.code(500).send({ error: 'AGENT_INIT_FAILED', message: 'AI 职业助理初始化失败' })
        }
        const result = await careerWorkflowExec.execute({
          workflowType,
          userId,
          tenantId: ctx.tenantId,
          agentId: ctx.agentId,
          agentInstanceId: ctx.agentInstanceId,
          params,
        })
        return reply.send(result)
      }

      const result = await careerWorkflowExec.execute({
        workflowType,
        userId,
        tenantId: runtimeCtx.tenantId,
        agentId: runtimeCtx.agentId,
        agentInstanceId: runtimeCtx.agentInstanceId,
        params,
      })

      return reply.send(result)
    } catch (err: any) {
      return reply.code(500).send({
        error: 'WORKFLOW_FAILED',
        message: err.message,
      })
    }
  })

  // ─── 查询 Career Workflow 执行历史 ────────────────────
  fastify.get<{
    Querystring: {
      limit?: string
      offset?: string
    }
  }>('/api/career/workflow/history', { preHandler: fastify.authenticate }, async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'User identity required' })
    }

    const limit = Math.min(parseInt((request.query as any).limit || '20'), 100)
    const offset = parseInt((request.query as any).offset || '0')

    try {
      const histories = await (prisma as any).agentMemory.findMany({
        where: {
          memoryType: 'career_workflow_execution',
        },
        orderBy: { createdAt: 'desc' },
        take: limit + offset,
        skip: 0,
      })

      const filtered = histories.filter((h: any) => {
        try {
          const content = JSON.parse(h.content)
          return content.userId === userId
        } catch {
          return false
        }
      }).slice(offset, offset + limit)

      return reply.send({
        total: filtered.length,
        items: filtered.map((h: any) => {
          const content = JSON.parse(h.content)
          return {
            id: h.id,
            workflowType: content.workflowType,
            executedAt: content.executedAt,
            summary: content.summary,
            steps: content.steps,
          }
        }),
      })
    } catch (err: any) {
      return reply.code(500).send({
        error: 'QUERY_FAILED',
        message: err.message,
      })
    }
  })
}
