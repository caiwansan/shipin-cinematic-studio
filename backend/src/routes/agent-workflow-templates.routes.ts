/**
 * routes/agent-workflow-templates.routes.ts — AI-CENTER-03A AI 团队协作编排观察层
 *
 * 掌柜指令 2026-08-01：先让用户看到「不是一个人在 AI 工作，而是一支 AI 团队在协作」。
 * 只做识别/编排建议/展示，红线：❌ 不自动调用 Hermes ❌ 不自动创建任务
 * ❌ 不自动消耗 Token ❌ 不自动切换模型。
 *
 * 公开接口：
 *   GET /api/ai/agent-workflow-templates            → 模板列表（按业务场景过滤）
 *   GET /api/ai/agent-workflow-templates/:taskType  → 模板详情 + 每员工角色 + 模型建议（复用 02C 引擎）
 *
 * 模型建议是「展示层增强」：join AgentAIProfile + 02C 推荐引擎，让团队卡片显示
 * 每个 AI 员工的大脑建议（DeepSeek 92.7 / ChatGPT 93.6 ...），仍只建议不切换。
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { recommendForAgentType } from './agent-recommendation.routes.js'

interface TemplateAgent {
  agentType: string
  order: number
  task: string
}

async function decorate(agent: TemplateAgent) {
  const profile = await prisma.agentAiProfile.findUnique({ where: { agentType: agent.agentType } })
  // 02C 共享引擎：画像权重完整推荐（Bob → GPT/Claude，角色约束不丢失）
  const rec = await recommendForAgentType(agent.agentType)
  return {
    agentType: agent.agentType,
    order: agent.order,
    task: agent.task,
    roleName: profile?.roleName || agent.agentType,
    model: rec?.primary ? { provider: rec.primary.provider, name: rec.primary.name, score: rec.primary.score } : null,
  }
}

export default async function agentWorkflowTemplateRoutes(app: FastifyInstance) {
  // 模板列表（观察层：只展示，无副作用）
  app.get('/api/ai/agent-workflow-templates', async (req, reply) => {
    const { businessType, status } = req.query as { businessType?: string; status?: string }
    const where: Record<string, unknown> = {}
    if (businessType) where.businessType = businessType
    if (status) where.status = status
    else where.status = 'active'

    const templates = await prisma.agentWorkflowTemplate.findMany({ where, orderBy: { createdAt: 'asc' } })
    const data = await Promise.all(
      templates.map(async (t) => ({
        id: t.id,
        name: t.name,
        businessType: t.businessType,
        taskType: t.taskType,
        agentCount: (JSON.parse(t.agents) as TemplateAgent[]).length,
        status: t.status,
      })),
    )
    return { code: 0, data }
  })

  // 模板详情：有序团队 + 角色 + 每员工模型建议（02C 引擎）
  app.get('/api/ai/agent-workflow-templates/:taskType', async (req, reply) => {
    const { taskType } = req.params as { taskType: string }
    const t = await prisma.agentWorkflowTemplate.findUnique({ where: { id: `wf-${taskType}` } })
    if (!t) return reply.status(404).send({ code: 1, error: '模板不存在' })

    const agents = JSON.parse(t.agents) as TemplateAgent[]
    const ordered = agents.sort((a, b) => a.order - b.order)
    const team = await Promise.all(ordered.map(decorate))

    return {
      code: 0,
      data: {
        id: t.id,
        name: t.name,
        businessType: t.businessType,
        taskType: t.taskType,
        status: t.status,
        team,
        // 观察层边界声明：仅建议，不自动执行
        boundary: {
          autoExecute: false,
          autoCreateTask: false,
          autoConsumeToken: false,
          autoSwitchModel: false,
        },
      },
    }
  })
}
