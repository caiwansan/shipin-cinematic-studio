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
import { entitlementService } from '../services/enterprise/enterprise-entitlement.service.js'
import { hermesProfileService } from '../services/enterprise/hermes-profile.service'
import { resolveCurrentEnterprise } from '../services/enterprise-context.service.js'

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
      // F3: BYOK 不再是 Career Runtime 的硬阻断
      // 无 BYOK 用户走 Platform AI Gateway 兜底（businessType: career_agent）
      // resolveRuntimeConfig 优先级: 输入 > 企业 > 平台 > 用户 > 系统

      // Step 1: 检查或创建 Career Agent
      let agent = await careerAgentService.getCareerAgent(userId)
      let created = false

      if (!agent) {
        // Sprint-09B-3A Task 02-B: 权益门控
        // 个人用户 → 检查 career_agent 订阅
        // 企业用户 → 检查 enterprise 套餐限额
        const entitlement = await careerAgentService.checkProvisionEntitlement(userId)
        if (!entitlement.allowed) {
          return reply.code(403).send({
            error: 'ENTITLEMENT_REQUIRED',
            message: entitlement.reason,
            action: 'purchase_career_agent',
          })
        }

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

      // Sprint 1B-5: 解析企业身份作为 tenantId
      const enterprise = await resolveCurrentEnterprise(userId)
      const tenantId = (enterprise as any)?.id || userId

      // Step 3: 创建 Task 记录
      const task = await (prisma as any).enterpriseAgentTask.create({
        data: {
          tenantId,
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
        tenantId,
        organizationId: tenantId,
        userId,
        taskType: 'career_activation',
        instruction,
        // F3: 指定 businessType 使无 BYOK 用户走 Platform AI Gateway 兜底
        businessType: 'career_agent',
      })

      if (!result.success) {
        // Sprint-09C-3-2 Task 02: 异常包装 — 技术错误不暴露给用户
        // 映射规则：CONFIG_ERROR / PROVIDER_ERROR → 系统繁忙
        //         其他 → 友好提示，错误细节保留在 technicalError 中供排查
        const rawError = result.error || 'EXECUTION_FAILED'
        const isProviderIssue = /CONFIG_ERROR|PROVIDER_ERROR|NO_MODEL_CONFIG|PROVIDER_NOT_FOUND|401|403|429|timeout|abort/i.test(rawError)
        const userMessage = isProviderIssue
          ? '镜心暂时繁忙，AI模型服务暂时不可用，请稍后重试'
          : '任务未能按预期完成，请尝试重新分析'

        // 标记 Task 为失败，保留错误上下文
        await (prisma as any).enterpriseAgentTask.update({
          where: { id: task.id },
          data: {
            status: 'failed',
            completedAt: new Date(),
            outputSummary: userMessage,
          },
        }).catch(() => {})

        return reply.code(500).send({
          error: 'EXECUTION_FAILED',
          message: userMessage,
          technicalError: rawError,
          retryable: isProviderIssue,
          agent: {
            profileId: agent.profileId,
            instanceId: agent.instanceId,
            created,
          },
        })
      }

      // Step 5: 获取 Hermes Binding 信息
      const binding = await hermesProfileService.getBindingByInstance(agent.instanceId)

      // Sprint-10 Step 4A Task 02: 返回身份摘要，供前端构建欢迎消息
      const careerProfile = await prisma.careerProfile.findUnique({
        where: { userId },
        select: { id: true, candidateId: true, fullName: true, headline: true, yearsExperience: true, careerDirection: true },
      }).catch(() => null)

      let profileSummary: Record<string, any> | null = null
      if (careerProfile) {
        const skills: string[] = []
        try {
          const rawSkills = await prisma.$queryRawUnsafe<Array<{name: string}>>(
            'SELECT sk.name FROM candidate_skill cs JOIN skill sk ON cs.skill_id = sk.id WHERE cs.candidate_id = $1 LIMIT 5',
            careerProfile.candidateId
          )
          for (const s of rawSkills) skills.push(s.name)
        } catch {}

        profileSummary = {
          name: careerProfile.fullName,
          headline: careerProfile.headline,
          yearsExperience: careerProfile.yearsExperience,
          careerDirection: careerProfile.careerDirection,
          skills,
        }
      }

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
        // Sprint-10 Step 4A Task 02: 用户身份摘要
        identity: profileSummary ? {
          hasProfile: true,
          name: profileSummary.name,
          experience: profileSummary.yearsExperience > 0 ? `${profileSummary.yearsExperience}年经验` : undefined,
          direction: profileSummary.careerDirection,
          skills: profileSummary.skills,
        } : { hasProfile: false },
      })
    } catch (err: any) {
      console.error('[CareerActivation] error:', err.message)
      // Sprint-09C-3-2 Task 02: 防止技术细节泄露
      const raw = err.message || 'UNKNOWN_ERROR'
      const isProviderIssue = /CONFIG_ERROR|PROVIDER_ERROR|NO_MODEL|401|403|429|timeout|abort/i.test(raw)
      const userMessage = isProviderIssue
        ? '镜心暂时繁忙，AI模型服务暂时不可用，请稍后重试'
        : '系统暂时繁忙，请稍后重试'
      return reply.code(500).send({
        error: 'ACTIVATION_FAILED',
        message: userMessage,
        technicalError: raw,
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
      // Sprint 1B-5: 解析企业身份
      const enterprise = await resolveCurrentEnterprise(userId)
      const tenantId = (enterprise as any)?.id || userId

      const agent = await careerAgentService.getCareerAgent(userId)
      if (!agent) {
        return reply.send({ hasAgent: false, productionReady: false })
      }

      const instance = await (prisma as any).enterpriseAgentInstance.findUnique({
        where: { employeeId: agent.profileId },
      })

      const tasks = await (prisma as any).enterpriseAgentTask.count({
        where: { tenantId },
      })

      const outcomes = await (prisma as any).enterpriseOutcome.count({
        where: { tenantId },
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
