/**
 * Career Agent Activation Route — Sprint-03 Agent Activation Reality
 * 
 * 将 Career Agent 从"代码存在"推进到"生产执行"
 * 接入链路: EnterpriseAgentRuntimeService → ModelRouter → EnterpriseLlmConfig → callLLM
 */

import type { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { CareerAgentService, checkUserBYOK } from '../services/enterprise/workflow/career-agent.service'
import { enterpriseAgentRuntime } from '../services/enterprise/enterprise-agent-runtime.service'
import { hermesProfileService } from '../services/enterprise/hermes-profile.service'

export async function careerActivationRoutes(fastify: FastifyInstance) {
  const prisma = new PrismaClient()
  const careerAgentService = new CareerAgentService(prisma)

  /**
   * POST /api/career/agent/activate-and-execute
   * 激活 Career Agent 并执行首次任务
   * Reality Gate: 必须产生真实的 AgentTask + Outcome + AuditTrail
   */
  fastify.post<{
    Body: {
      instruction?: string
      goal?: string
    }
  }>('/api/career/agent/activate-and-execute', { preHandler: fastify.authenticate }, async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'User identity required' })
    }

    try {
      // Step 0: BYOK Gate — 检查用户是否配置了个人 LLM API Key
      const hasBYOK = await checkUserBYOK(userId)
      if (!hasBYOK) {
        return reply.code(400).send({
          error: 'NO_BYOK_CONFIG',
          message: '请先配置您的AI模型API Key后再创建AI职业助理',
          action: 'configure_llm',
          configUrl: '/workspace/settings/llm',
        })
      }

      // Step 1: 检查或创建 Career Agent
      let agent = await careerAgentService.getCareerAgent(userId)
      let created = false

      if (!agent) {
        const result = await careerAgentService.createAndDeploy({
          userId,
          userName: (request as any).user?.username || '用户',
          goal: request.body?.goal,
        })
        agent = result
        created = true
      }

      // Step 2: 查找 EnterpriseAgentInstance
      const instance = await (prisma as any).enterpriseAgentInstance.findUnique({
        where: { employeeId: agent.profileId },
      })

      if (!instance) {
        return reply.code(500).send({ error: 'INSTANCE_NOT_FOUND', message: 'Career Agent Instance 不存在' })
      }

      // Step 3: 创建 Task 记录
      const task = await (prisma as any).enterpriseAgentTask.create({
        data: {
          tenantId: userId,
          agentInstanceId: instance.id,
          taskType: 'career_activation',
          inputSummary: request.body?.instruction || '职业助理初始化：分析用户背景并提供求职建议',
          status: 'running',
          startedAt: new Date(),
        },
      })

      // Step 4: 通过生产链路执行任务
      const instruction = request.body?.instruction || 
        '请分析用户的职业背景，提供简要的求职建议。用户尚未填写职业档案，请先给出通用建议。'

      const result = await enterpriseAgentRuntime.executeTask({
        taskId: task.id,
        profileId: agent.profileId,
        tenantId: userId,
        organizationId: userId,
        userId,
        taskType: 'career_activation',
        instruction,
      })

      if (!result.success) {
        return reply.code(500).send({
          error: 'EXECUTION_FAILED',
          message: result.error || '任务执行失败',
          agent: {
            profileId: agent.profileId,
            instanceId: agent.instanceId,
            created,
          },
        })
      }

      // Step 5: 获取 Hermes Binding 信息
      const binding = await hermesProfileService.getBindingByInstance(agent.instanceId)

      return reply.send({
        message: created ? 'AI 职业助理已创建并执行首次任务' : 'AI 职业助理已执行任务',
        agent: {
          profileId: agent.profileId,
          instanceId: agent.instanceId,
          bindingId: agent.bindingId,
          hermesAgentId: agent.hermesAgentId,
          memoryNamespace: agent.memoryNamespace,
          identityProvider: binding?.identityProvider || 'hermes',
          status: agent.status,
          created,
        },
        execution: {
          taskId: task.id,
          status: 'completed',
          output: result.output,
          tokenInput: result.tokenInput,
          tokenOutput: result.tokenOutput,
          cost: result.cost,
          durationMs: result.durationMs,
          outcomeId: result.outcomeId,
          actionId: result.actionId,
        },
      })
    } catch (err: any) {
      console.error('[CareerActivation] error:', err.message)
      return reply.code(500).send({
        error: 'ACTIVATION_FAILED',
        message: err.message,
      })
    }
  })

  /**
   * GET /api/career/agent/verify
   * 验证 Career Agent 是否已进入生产层
   */
  fastify.get('/api/career/agent/verify', { preHandler: fastify.authenticate }, async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) {
      return reply.code(401).send({ error: 'UNAUTHORIZED' })
    }

    try {
      const agent = await careerAgentService.getCareerAgent(userId)
      if (!agent) {
        return reply.send({ hasAgent: false, productionReady: false })
      }

      const instance = await (prisma as any).enterpriseAgentInstance.findUnique({
        where: { employeeId: agent.profileId },
      })

      const tasks = await (prisma as any).enterpriseAgentTask.count({
        where: { tenantId: userId },
      })

      const outcomes = await (prisma as any).enterpriseOutcome.count({
        where: { tenantId: userId },
      })

      return reply.send({
        hasAgent: true,
        productionReady: !!instance && instance.runtime === 'enterprise',
        agent: {
          profileId: agent.profileId,
          instanceId: agent.instanceId,
          runtime: instance?.runtime,
          lifecycleState: instance?.lifecycleState,
        },
        stats: {
          tasks,
          outcomes,
        },
      })
    } catch (err: any) {
      return reply.code(500).send({ error: err.message })
    }
  })
}
