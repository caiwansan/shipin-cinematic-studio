/**
 * Workflow Routes — KM-AI-JOB-AGENT-07
 * AI 招聘经理 Hermes Workflow API
 *
 * 端点：
 *   POST /api/enterprise/workflow/execute   — 执行 Workflow
 *   GET  /api/enterprise/workflow/history    — 查询执行历史
 *   GET  /api/enterprise/workflow/tasks      — 查询 HR 任务列表
 *   POST /api/enterprise/workflow/tasks/:id  — 确认/完成任务
 */

import type { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { AgentExecutorImpl } from '../agent-runtime/brain/agent-executor'
import { createWorkflowExecutor, type WorkflowType } from '../services/enterprise/workflow/workflow-executor'

export async function workflowRoutes(fastify: FastifyInstance) {
  const prisma = new PrismaClient()
  const executor = new AgentExecutorImpl(prisma)
  const workflowExec = createWorkflowExecutor(prisma, executor)

  // ─── 执行 Workflow ────────────────────────────────────
  fastify.post<{
    Body: {
      workflowType: WorkflowType
      tenantId: string
      agentId?: string
      agentInstanceId?: string
      params?: Record<string, any>
    }
  }>('/api/enterprise/workflow/execute', async (request, reply) => {
    const { workflowType, tenantId, agentId, agentInstanceId, params } = request.body as any

    if (!workflowType || !tenantId) {
      return reply.code(400).send({ error: 'MISSING_PARAMS', message: 'workflowType and tenantId are required' })
    }

    // 解析用户身份
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'User identity required' })
    }

    // 自动查找 AI 招聘经理的 Agent 和 Instance
    let targetAgentId = agentId
    let targetInstanceId = agentInstanceId

    if (!targetAgentId || !targetInstanceId) {
      // 查找 career_advisor 类型的 Agent Profile
      const agentProfile = await (prisma as any).enterpriseAgentProfile.findFirst({
        where: { agentType: 'career_advisor' },
        select: { id: true },
      })
      if (!agentProfile) {
        return reply.code(404).send({ error: 'AGENT_NOT_FOUND', message: 'AI 招聘经理 Agent 不存在' })
      }
      targetAgentId = agentProfile.id

      // 查找对应的 Instance
      const instance = await (prisma as any).enterpriseAgentInstance.findFirst({
        where: { tenantId, employeeId: agentProfile.id },
        select: { id: true },
      })
      if (!instance) {
        return reply.code(404).send({ error: 'INSTANCE_NOT_FOUND', message: 'AI 招聘经理 Instance 不存在' })
      }
      targetInstanceId = instance.id
    }

    try {
      const result = await workflowExec.execute({
        workflowType,
        tenantId,
        userId,
        agentId: targetAgentId,
        agentInstanceId: targetInstanceId,
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

  // ─── 查询 Workflow 执行历史 ──────────────────────────
  fastify.get<{
    Querystring: {
      tenantId: string
      limit?: string
      offset?: string
    }
  }>('/api/enterprise/workflow/history', async (request, reply) => {
    const { tenantId } = request.query as any
    const limit = Math.min(parseInt((request.query as any).limit || '20'), 100)
    const offset = parseInt((request.query as any).offset || '0')

    if (!tenantId) {
      return reply.code(400).send({ error: 'MISSING_PARAMS', message: 'tenantId is required' })
    }

    const histories = await (prisma as any).agentMemory.findMany({
      where: {
        memoryType: 'workflow_execution',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    const filtered = histories.filter((h: any) => {
      try {
        const content = JSON.parse(h.content)
        return content.tenantId === tenantId
      } catch {
        return false
      }
    })

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
  })

  // ─── 查询 HR 任务列表 ────────────────────────────────
  fastify.get<{
    Querystring: {
      tenantId: string
      status?: string
    }
  }>('/api/enterprise/workflow/tasks', async (request, reply) => {
    const { tenantId, status } = request.query as any

    if (!tenantId) {
      return reply.code(400).send({ error: 'MISSING_PARAMS', message: 'tenantId is required' })
    }

    const tasks = await (prisma as any).agentMemory.findMany({
      where: {
        memoryType: 'hr_task',
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const filtered = tasks.filter((t: any) => {
      try {
        const content = JSON.parse(t.content)
        if (content.tenantId !== tenantId) return false
        if (status && content.status !== status) return false
        return true
      } catch {
        return false
      }
    })

    return reply.send({
      total: filtered.length,
      items: filtered.map((t: any) => {
        const content = JSON.parse(t.content)
        return {
          id: t.id,
          title: content.title,
          description: content.description,
          priority: content.priority,
          status: content.status,
          relatedCandidate: content.relatedCandidate,
          createdAt: content.createdAt,
        }
      }),
    })
  })

  // ─── 确认/完成 HR 任务 ───────────────────────────────
  fastify.post<{
    Params: { id: string }
    Body: {
      action: 'confirm' | 'complete' | 'dismiss'
      tenantId: string
    }
  }>('/api/enterprise/workflow/tasks/:id', async (request, reply) => {
    const { id } = request.params as any
    const { action, tenantId } = request.body as any

    if (!action || !tenantId) {
      return reply.code(400).send({ error: 'MISSING_PARAMS', message: 'action and tenantId are required' })
    }

    const task = await (prisma as any).agentMemory.findUnique({
      where: { id },
    })

    if (!task) {
      return reply.code(404).send({ error: 'TASK_NOT_FOUND', message: '任务不存在' })
    }

    const content = JSON.parse(task.content)
    if (content.tenantId !== tenantId) {
      return reply.code(403).send({ error: 'ACCESS_DENIED', message: '无权操作此任务' })
    }

    const statusMap: Record<string, string> = {
      confirm: 'confirmed',
      complete: 'done',
      dismiss: 'dismissed',
    }

    const newStatus = statusMap[action]
    if (!newStatus) {
      return reply.code(400).send({ error: 'INVALID_ACTION', message: '无效操作' })
    }

    content.status = newStatus
    content.updatedAt = new Date().toISOString()

    await (prisma as any).agentMemory.update({
      where: { id },
      data: { content: JSON.stringify(content) },
    })

    return reply.send({
      id,
      status: newStatus,
      message: `任务已${action === 'confirm' ? '确认' : action === 'complete' ? '完成' : '忽略'}`,
    })
  })
}
