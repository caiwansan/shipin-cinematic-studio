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
        return reply.send({
          hasAgent: false,
          status: 'not_created',
          message: '尚未创建 AI 职业助理',
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

      return reply.send({
        hasAgent: true,
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
