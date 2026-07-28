/**
 * enterprise-interview-agent.ts — AI 面试官 API 路由
 * Sprint-07B-3: Interview Agent MVP
 *
 * 三个核心 API：
 * POST /api/enterprise/agents/interview/generate   — 生成面试问题
 * POST /api/enterprise/agents/interview/followup    — 追问建议
 * POST /api/enterprise/agents/interview/summary     — 面试总结
 *
 * 架构：EnterpriseLlmConfig → executeViaGateway
 * 数据权限：只读本企业面试记录和候选人
 *
 * Observation Sprint Step 1-B-1:
 * Identity 解析必须经过 resolveCurrentEnterprise(OrgMember SSOT)
 * 禁止直接查询 prisma.enterpriseProfile.findFirst({ where: { organizationId: userId } })
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { interviewAgentService } from '../services/enterprise/interview-agent.service.js'
import { resolveCurrentEnterprise } from '../services/enterprise-context.service.js'

export async function registerInterviewAgentRoutes(app: FastifyInstance) {

  // Sprint 13: Security P0 — JWT auth for all Agent routes
  app.addHook('preHandler', app.authenticate)

  // ── POST /api/enterprise/agents/interview/generate ──
  app.post('/api/enterprise/agents/interview/generate', async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

    const { jobId, candidateId } = request.body as { jobId?: string; candidateId?: string }
    if (!jobId || !candidateId) {
      return reply.status(400).send({ error: 'jobId and candidateId are required' })
    }

    try {
      const ctx = await resolveCurrentEnterprise(userId)
      if (!ctx?.enterpriseProfile?.organizationId) return reply.status(403).send({ error: 'No enterprise identity' })
      const tenantId = ctx.enterpriseProfile.organizationId

      const agent = await interviewAgentService.ensureInterviewAgent(tenantId)
      if (!agent) return reply.status(500).send({ error: 'Failed to create interview agent' })

      const result = await interviewAgentService.generateQuestions(
        tenantId, userId, agent.id, jobId, candidateId
      )

      return reply.send({ success: true, result })
    } catch (error: any) {
      request.log.error(`[interview-agent] generate: ${error.message}`)
      return reply.status(500).send({ error: 'Generation failed', message: error.message?.slice(0, 200) })
    }
  })

  // ── POST /api/enterprise/agents/interview/followup ──
  app.post('/api/enterprise/agents/interview/followup', async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

    const { sessionId, lastQuestion, lastAnswer } = request.body as {
      sessionId?: string
      lastQuestion?: string
      lastAnswer?: string
    }
    if (!sessionId || !lastQuestion) {
      return reply.status(400).send({ error: 'sessionId and lastQuestion are required' })
    }

    try {
      const ctx = await resolveCurrentEnterprise(userId)
      if (!ctx?.enterpriseProfile?.organizationId) return reply.status(403).send({ error: 'No enterprise identity' })
      const tenantId = ctx.enterpriseProfile.organizationId

      const agent = await interviewAgentService.ensureInterviewAgent(tenantId)
      if (!agent) return reply.status(500).send({ error: 'Failed to create interview agent' })

      const result = await interviewAgentService.suggestFollowUp(
        tenantId, userId, agent.id, sessionId, lastQuestion, lastAnswer || ''
      )

      return reply.send({ success: true, result })
    } catch (error: any) {
      request.log.error(`[interview-agent] followup: ${error.message}`)
      return reply.status(500).send({ error: 'Follow-up failed', message: error.message?.slice(0, 200) })
    }
  })

  // ── POST /api/enterprise/agents/interview/summary ──
  app.post('/api/enterprise/agents/interview/summary', async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

    const { sessionId } = request.body as { sessionId?: string }
    if (!sessionId) {
      return reply.status(400).send({ error: 'sessionId is required' })
    }

    try {
      const ctx = await resolveCurrentEnterprise(userId)
      if (!ctx?.enterpriseProfile?.organizationId) return reply.status(403).send({ error: 'No enterprise identity' })
      const tenantId = ctx.enterpriseProfile.organizationId

      const agent = await interviewAgentService.ensureInterviewAgent(tenantId)
      if (!agent) return reply.status(500).send({ error: 'Failed to create interview agent' })

      const result = await interviewAgentService.summarizeInterview(
        tenantId, userId, agent.id, sessionId
      )

      return reply.send({ success: true, result })
    } catch (error: any) {
      request.log.error(`[interview-agent] summary: ${error.message}`)
      return reply.status(500).send({ error: 'Summary failed', message: error.message?.slice(0, 200) })
    }
  })

  // ── GET /api/enterprise/agents/interview/status ──
  app.get('/api/enterprise/agents/interview/status', async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

    try {
      const ctx = await resolveCurrentEnterprise(userId)
      if (!ctx?.enterpriseProfile?.organizationId) return reply.status(403).send({ error: 'No enterprise identity' })
      const tenantId = ctx.enterpriseProfile.organizationId

      const agent = await prisma.enterpriseAgentProfile.findFirst({
        where: { tenantId, agentType: 'interview_agent' },
        select: { id: true, name: true, status: true, createdAt: true, lastExecutionAt: true },
      })

      const llmConfig = await prisma.enterpriseLlmConfig.findFirst({
        where: { tenantId, status: 'active', enabled: true, credentialOwner: 'enterprise' },
        select: { provider: true, modelName: true },
      })

      return reply.send({
        success: true,
        agent,
        llmConfigured: !!llmConfig,
        llmProvider: llmConfig?.provider || null,
        llmModel: llmConfig?.modelName || null,
      })
    } catch {
      return reply.status(500).send({ error: 'Failed to get status' })
    }
  })
}

export default registerInterviewAgentRoutes
