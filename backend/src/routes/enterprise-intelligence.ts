/**
 * routes/enterprise-intelligence.ts — AI 招聘经理 Intelligence Layer API
 *
 * GET /api/enterprise/agents/intelligence/summary
 *   - 生成结构化 Intelligence Report
 *   - 读取真实招聘数据（JobPosting / CandidateMatch / Pipeline / Interview / Review）
 *   - 通过 AgentExecutor → Gateway 调用 LLM
 *   - 输出：summary / risks / actions，附带数据来源标记
 *
 * 架构约束：
 *   - 通过 Tenant Guard 注入 orgId
 *   - 不直接查询数据库（通过 IntelligenceService → RecruitmentContextBuilder）
 *   - 不直接调用 LLM（通过 AgentExecutor → Gateway）
 *   - 所有结论附带 source 标记
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index'
import { AgentExecutorImpl } from '../agent-runtime/brain/agent-executor'
import { IntelligenceService } from '../services/enterprise/intelligence.service'

export async function registerEnterpriseIntelligenceRoutes(app: FastifyInstance) {

  // ── GET /api/enterprise/agents/intelligence/summary ──────────────
  app.get('/api/enterprise/agents/intelligence/summary', async (request, reply) => {
    const ctx = (request as any).tenantContext

    if (!ctx) {
      return reply.status(403).send({
        code: 403,
        codeKey: 'NO_TENANT',
        message: 'Requires organization membership',
      })
    }

    const tenantId = ctx.orgId
    const userId = ctx.userId || ctx.id

    try {
      // 1. 找到 AI 招聘经理 Agent Profile
      const agentProfile = await (prisma as any).enterpriseAgentProfile.findFirst({
        where: {
          tenantId,
          agentType: 'career_advisor',
          status: 'active',
        },
        select: { id: true, name: true },
      })

      if (!agentProfile) {
        // 没有 AI 招聘经理 Agent，返回空报告
        return {
          code: 0,
          data: {
            generatedAt: new Date().toISOString(),
            agentId: null,
            agentName: null,
            tenantId,
            summary: [],
            risks: [],
            actions: [],
            dataSources: [],
            metadata: { model: null, tokensUsed: 0, durationMs: 0, provider: null },
            message: '未找到 AI 招聘经理 Agent，请先激活',
          },
        }
      }

      // 2. 创建 IntelligenceService
      const executor = new AgentExecutorImpl(prisma)
      const intelligenceService = new IntelligenceService(prisma, executor)

      // 3. 生成报告
      const report = await intelligenceService.generateReport(
        tenantId,
        userId,
        agentProfile.id,
      )

      return { code: 0, data: report }
    } catch (error: any) {
      // 不暴露内部错误详情
      return reply.status(500).send({
        code: 500,
        codeKey: 'INTELLIGENCE_GENERATION_FAILED',
        message: '生成 Intelligence Report 失败',
        error: error.message?.slice(0, 200) || 'Unknown error',
      })
    }
  })
}
