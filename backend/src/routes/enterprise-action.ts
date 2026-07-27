/**
 * routes/enterprise-action.ts — AI 招聘官 Copilot Action API
 *
 * KM-AI-JOB-AGENT-05: Action Layer 路由
 *
 * POST /api/enterprise/agents/action/analyze-candidate
 * POST /api/enterprise/agents/action/communication
 * POST /api/enterprise/agents/action/suggest-interview
 * POST /api/enterprise/agents/action/suggest-pipeline
 *
 * 架构约束：
 *   - 通过 Tenant Guard 注入 orgId
 *   - 不直接查询数据库（通过 RecruitmentActionService → RecruitmentContextBuilder）
 *   - 不直接调用 LLM（通过 AgentExecutor → Gateway）
 *   - 所有结论附带 source 标记
 *   - 第一阶段只做建议，不自动修改招聘状态
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index'
import { AgentExecutorImpl } from '../agent-runtime/brain/agent-executor'
import { RecruitmentActionService, type CommunicationType } from '../services/enterprise/recruitment-action.service'

export async function registerEnterpriseActionRoutes(app: FastifyInstance) {

  // ── 共享：创建 Service 实例 ─────────────────────────────────
  function createService() {
    const executor = new AgentExecutorImpl(prisma)
    return new RecruitmentActionService(prisma, executor)
  }

  // ── 共享：解析 tenant context ───────────────────────────────
  function getTenantContext(request: any) {
    const ctx = request.tenantContext
    if (!ctx) {
      return null
    }
    return {
      tenantId: ctx.orgId,
      userId: ctx.userId || ctx.id,
    }
  }

  // ── POST /api/enterprise/agents/action/analyze-candidate ────
  app.post('/api/enterprise/agents/action/analyze-candidate', async (request, reply) => {
    const tenant = getTenantContext(request)
    if (!tenant) {
      return reply.status(403).send({ code: 403, codeKey: 'NO_TENANT', message: 'Requires organization membership' })
    }

    const { candidateName } = request.body as { candidateName?: string }
    if (!candidateName) {
      return reply.status(400).send({ code: 400, codeKey: 'MISSING_PARAM', message: 'candidateName is required' })
    }

    try {
      // 找到 AI 招聘官 Agent Profile
      const agentProfile = await (prisma as any).enterpriseAgentProfile.findFirst({
        where: { tenantId: tenant.tenantId, agentType: 'recruiter', status: 'active' },
        select: { id: true, name: true },
      })

      if (!agentProfile) {
        return reply.status(404).send({ code: 404, codeKey: 'NO_AGENT', message: '未找到 AI 招聘官 Agent' })
      }

      const service = createService()
      const result = await service.analyzeCandidate(
        tenant.tenantId,
        tenant.userId,
        agentProfile.id,
        candidateName,
      )

      return { code: 0, data: result }
    } catch (error: any) {
      return reply.status(500).send({
        code: 500,
        codeKey: 'ACTION_FAILED',
        message: '候选人分析失败',
        error: error.message?.slice(0, 200) || 'Unknown error',
      })
    }
  })

  // ── POST /api/enterprise/agents/action/communication ────────
  app.post('/api/enterprise/agents/action/communication', async (request, reply) => {
    const tenant = getTenantContext(request)
    if (!tenant) {
      return reply.status(403).send({ code: 403, codeKey: 'NO_TENANT', message: 'Requires organization membership' })
    }

    const { commType, candidateName, jobTitle } = request.body as {
      commType?: CommunicationType
      candidateName?: string
      jobTitle?: string
    }

    if (!commType || !candidateName) {
      return reply.status(400).send({ code: 400, codeKey: 'MISSING_PARAM', message: 'commType and candidateName are required' })
    }

    const validTypes: CommunicationType[] = [
      'initial_outreach', 'interview_invite', 'interview_reminder',
      'rejection_feedback', 'offer_negotiation',
    ]
    if (!validTypes.includes(commType)) {
      return reply.status(400).send({ code: 400, codeKey: 'INVALID_PARAM', message: `commType must be one of: ${validTypes.join(', ')}` })
    }

    try {
      const agentProfile = await (prisma as any).enterpriseAgentProfile.findFirst({
        where: { tenantId: tenant.tenantId, agentType: 'recruiter', status: 'active' },
        select: { id: true, name: true },
      })

      if (!agentProfile) {
        return reply.status(404).send({ code: 404, codeKey: 'NO_AGENT', message: '未找到 AI 招聘官 Agent' })
      }

      const service = createService()
      const result = await service.generateCommunication(
        tenant.tenantId,
        tenant.userId,
        agentProfile.id,
        commType,
        candidateName,
        jobTitle,
      )

      return { code: 0, data: result }
    } catch (error: any) {
      return reply.status(500).send({
        code: 500,
        codeKey: 'ACTION_FAILED',
        message: '沟通内容生成失败',
        error: error.message?.slice(0, 200) || 'Unknown error',
      })
    }
  })

  // ── POST /api/enterprise/agents/action/suggest-interview ─────
  app.post('/api/enterprise/agents/action/suggest-interview', async (request, reply) => {
    const tenant = getTenantContext(request)
    if (!tenant) {
      return reply.status(403).send({ code: 403, codeKey: 'NO_TENANT', message: 'Requires organization membership' })
    }

    const { candidateName } = request.body as { candidateName?: string }
    if (!candidateName) {
      return reply.status(400).send({ code: 400, codeKey: 'MISSING_PARAM', message: 'candidateName is required' })
    }

    try {
      const agentProfile = await (prisma as any).enterpriseAgentProfile.findFirst({
        where: { tenantId: tenant.tenantId, agentType: 'recruiter', status: 'active' },
        select: { id: true, name: true },
      })

      if (!agentProfile) {
        return reply.status(404).send({ code: 404, codeKey: 'NO_AGENT', message: '未找到 AI 招聘官 Agent' })
      }

      const service = createService()
      const result = await service.suggestInterview(
        tenant.tenantId,
        tenant.userId,
        agentProfile.id,
        candidateName,
      )

      return { code: 0, data: result }
    } catch (error: any) {
      return reply.status(500).send({
        code: 500,
        codeKey: 'ACTION_FAILED',
        message: '面试建议生成失败',
        error: error.message?.slice(0, 200) || 'Unknown error',
      })
    }
  })

  // ── POST /api/enterprise/agents/action/suggest-pipeline ──────
  app.post('/api/enterprise/agents/action/suggest-pipeline', async (request, reply) => {
    const tenant = getTenantContext(request)
    if (!tenant) {
      return reply.status(403).send({ code: 403, codeKey: 'NO_TENANT', message: 'Requires organization membership' })
    }

    const { candidateName } = request.body as { candidateName?: string }
    if (!candidateName) {
      return reply.status(400).send({ code: 400, codeKey: 'MISSING_PARAM', message: 'candidateName is required' })
    }

    try {
      const agentProfile = await (prisma as any).enterpriseAgentProfile.findFirst({
        where: { tenantId: tenant.tenantId, agentType: 'recruiter', status: 'active' },
        select: { id: true, name: true },
      })

      if (!agentProfile) {
        return reply.status(404).send({ code: 404, codeKey: 'NO_AGENT', message: '未找到 AI 招聘官 Agent' })
      }

      const service = createService()
      const result = await service.suggestPipelineMove(
        tenant.tenantId,
        tenant.userId,
        agentProfile.id,
        candidateName,
      )

      return { code: 0, data: result }
    } catch (error: any) {
      return reply.status(500).send({
        code: 500,
        codeKey: 'ACTION_FAILED',
        message: 'Pipeline 建议生成失败',
        error: error.message?.slice(0, 200) || 'Unknown error',
      })
    }
  })
}
