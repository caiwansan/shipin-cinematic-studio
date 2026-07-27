/**
 * enterprise-talent-agent.ts — AI 猎聘顾问 API 路由
 * Sprint-07B-2: Talent Agent MVP
 *
 * 三个核心 API：
 * POST /api/enterprise/agents/talent/analyze   — 候选人深度分析
 * POST /api/enterprise/agents/talent/explain    — 匹配分解释
 * POST /api/enterprise/agents/talent/search     — 候选人搜索推荐
 *
 * 架构：
 * - 模型配置：EnterpriseLlmConfig（企业 AI 员工）
 * - 数据权限：只读本企业候选人
 * - 审计：记录所有 Agent 行为
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { talentAgentService } from '../services/enterprise/talent-agent.service.js'

export async function registerTalentAgentRoutes(app: FastifyInstance) {

  // ── POST /api/enterprise/agents/talent/analyze ──
  // 候选人深度分析
  app.post('/api/enterprise/agents/talent/analyze', async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

    const { candidateId } = request.body as { candidateId?: string }
    if (!candidateId) {
      return reply.status(400).send({ error: 'candidateId is required' })
    }

    try {
      // 1. 解析企业ID
      const ep = await prisma.enterpriseProfile.findFirst({ where: { organizationId: userId } })
      if (!ep) return reply.status(400).send({ error: 'No enterprise identity' })
      const tenantId = ep.organizationId

      // 2. 确保 Talent Agent 存在
      const agent = await talentAgentService.ensureTalentAgent(tenantId)
      if (!agent) return reply.status(500).send({ error: 'Failed to create talent agent' })

      // 3. 执行分析
      const result = await talentAgentService.analyzeCandidate(tenantId, userId, agent.id, candidateId)

      return reply.send({ success: true, result })
    } catch (error: any) {
      request.log.error(`[talent-agent] analyze failed: ${error.message}`)
      return reply.status(500).send({ error: 'Analysis failed', message: error.message?.slice(0, 200) })
    }
  })

  // ── POST /api/enterprise/agents/talent/explain ──
  // 匹配分解释
  app.post('/api/enterprise/agents/talent/explain', async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

    const { matchId } = request.body as { matchId?: string }
    if (!matchId) {
      return reply.status(400).send({ error: 'matchId is required' })
    }

    try {
      const ep = await prisma.enterpriseProfile.findFirst({ where: { organizationId: userId } })
      if (!ep) return reply.status(400).send({ error: 'No enterprise identity' })
      const tenantId = ep.organizationId

      const agent = await talentAgentService.ensureTalentAgent(tenantId)
      if (!agent) return reply.status(500).send({ error: 'Failed to create talent agent' })

      const result = await talentAgentService.explainMatch(tenantId, userId, agent.id, matchId)

      return reply.send({ success: true, result })
    } catch (error: any) {
      request.log.error(`[talent-agent] explain failed: ${error.message}`)
      return reply.status(500).send({ error: 'Explanation failed', message: error.message?.slice(0, 200) })
    }
  })

  // ── POST /api/enterprise/agents/talent/search ──
  // 候选人搜索推荐
  app.post('/api/enterprise/agents/talent/search', async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

    const { jobId, limit } = request.body as { jobId?: string; limit?: number }
    if (!jobId) {
      return reply.status(400).send({ error: 'jobId is required' })
    }

    try {
      const ep = await prisma.enterpriseProfile.findFirst({ where: { organizationId: userId } })
      if (!ep) return reply.status(400).send({ error: 'No enterprise identity' })
      const tenantId = ep.organizationId

      const agent = await talentAgentService.ensureTalentAgent(tenantId)
      if (!agent) return reply.status(500).send({ error: 'Failed to create talent agent' })

      const result = await talentAgentService.searchCandidates(
        tenantId, userId, agent.id, jobId, limit || 5
      )

      return reply.send({ success: true, result })
    } catch (error: any) {
      request.log.error(`[talent-agent] search failed: ${error.message}`)
      return reply.status(500).send({ error: 'Search failed', message: error.message?.slice(0, 200) })
    }
  })

  // ── GET /api/enterprise/agents/talent/status ──
  // 查询 Talent Agent 状态
  app.get('/api/enterprise/agents/talent/status', async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

    try {
      const ep = await prisma.enterpriseProfile.findFirst({ where: { organizationId: userId } })
      if (!ep) return reply.status(400).send({ error: 'No enterprise identity' })
      const tenantId = ep.organizationId

      const agent = await prisma.enterpriseAgentProfile.findFirst({
        where: { tenantId, agentType: 'talent_agent' },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          lastExecutionAt: true,
        },
      })

      // 检查 LLM 配置
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
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to get status' })
    }
  })
}

export default registerTalentAgentRoutes
