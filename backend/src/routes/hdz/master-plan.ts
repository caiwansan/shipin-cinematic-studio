/**
 * routes/hdz/master-plan.ts
 *
 * HDZ-NOVEL-INTELLIGENCE-01: 小说总体规划 CRUD
 *
 * GET    /api/hdz/projects/:projectId/master-plan     — 获取规划
 * PUT    /api/hdz/projects/:projectId/master-plan     — 更新规划（自动记录修订历史）
 * GET    /api/hdz/projects/:projectId/master-plan/revisions — 获取修订历史
 * POST   /api/hdz/projects/:projectId/master-plan/generate  — AI 生成总规划
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import { getUserLLMConfig } from '../../services/hdz/llm.client.js'
import { modelRouter } from '../../services/enterprise/model-router.service.js'
import { buildEnterpriseRuntimeContext } from '../../services/enterprise/enterprise-runtime.context.js'
import { callLLM } from '../../services/hdz/llm.client.js'

const MASTER_PLAN_PROMPT = `你是一位网文总规划师。根据用户提供的创作意图，生成一份完整的「小说总规划」。

⚠️ 严格满足以下字数要求（总長度不少于3000字）：
1. 世界观设定 worldDirection（500字以上）
2. 五卷结构 volumes（每卷200字以上，共1000字以上）
3. 主线冲突 mainConflict（每卷500字以上）
4. 人物成长 characterGrowth（每卷500字以上）
5. 伏笔系统 foreshadowing（5条以上，每条50字以上）
6. 世界规则禁条 forbiddenRules（5条以上，每条30字以上）
7. 结局方向 endingDirection（300字以上）

必须输出完整 JSON：
{
  "title": "书名",
  "genre": "类型",
  "totalChapter": 1000,
  "volumeCount": 5,
  "targetWords": 3000000,
  "worldDirection": "500字以上世界观描述",
  "endingDirection": "300字以上结局方向",
  "forbiddenRules": ["规则1", "规则2", "规则3", "规则4", "规则5"],
  "foreshadowing": [
    {"chapter": 20, "event": "伏笔事件描述(50字)", "payoff": "第500章：兑现描述(50字)"}
  ],
  "volumes": [
    {
      "volume": 1,
      "chapterRange": "1-200",
      "theme": "主题(50字以上)",
      "mainConflict": "主要冲突(200字以上)",
      "characterGrowth": "角色成长线(200字以上)",
      "keyEvents": ["事件1", "事件2", "事件3", "事件4", "事件5"]
    }
  ]
}`

export default async function masterPlanRoutes(app: FastifyInstance) {
  // 用户身份验证
  app.addHook('preHandler', app.authenticate)

  // 获取总规划
  app.get('/api/hdz/projects/:projectId/master-plan', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { userId: true, masterPlan: true, masterPlanVersion: true },
    })

    if (!project) return reply.status(404).send({ success: false, error: '项目不存在' })
    if (project.userId !== user.id) return reply.status(403).send({ success: false, error: '无权访问' })

    return {
      success: true,
      data: {
        masterPlan: project.masterPlan || {},
        version: project.masterPlanVersion || 0,
      },
    }
  })

  // 更新总规划（自动记录修订历史）
  app.put('/api/hdz/projects/:projectId/master-plan', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any
    const { masterPlan, reason } = request.body as any

    if (!masterPlan || typeof masterPlan !== 'object') {
      return reply.status(400).send({ success: false, error: 'masterPlan 格式错误' })
    }

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project) return reply.status(404).send({ success: false, error: '项目不存在' })
    if (project.userId !== user.id) return reply.status(403).send({ success: false, error: '无权访问' })

    const newVersion = (project.masterPlanVersion || 0) + 1

    // 记录修订历史
    await prisma.hdzPlanRevision.create({
      data: {
        projectId,
        version: newVersion,
        reason: reason || null,
        planBefore: project.masterPlan as any,
        planAfter: masterPlan as any,
        diffSummary: null, // TODO: AI 生成变更摘要
      },
    })

    // 更新规划
    const updated = await prisma.hdzProject.update({
      where: { id: projectId },
      data: {
        masterPlan: masterPlan as any,
        masterPlanVersion: newVersion,
      },
      select: { masterPlan: true, masterPlanVersion: true },
    })

    return { success: true, data: updated }
  })

  // 获取修订历史
  app.get('/api/hdz/projects/:projectId/master-plan/revisions', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })
    if (!project) return reply.status(404).send({ success: false, error: '项目不存在' })
    if (project.userId !== user.id) return reply.status(403).send({ success: false, error: '无权访问' })

    const revisions = await prisma.hdzPlanRevision.findMany({
      where: { projectId },
      orderBy: { version: 'desc' },
    })

    return { success: true, data: revisions }
  })

  // AI 生成总规划
  app.post('/api/hdz/projects/:projectId/master-plan/generate', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any
    const { userInput, totalChapter, volumeCount, genre } = request.body as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project) return reply.status(404).send({ success: false, error: '项目不存在' })
    if (project.userId !== user.id) return reply.status(403).send({ success: false, error: '无权访问' })

    // 获取 LLM 配置（Enterprise 优先）
    let userCfg = await getUserLLMConfig(user.id)
    const enterpriseCtx = await buildEnterpriseRuntimeContext(
      user.id, projectId, `master-plan-${Date.now()}`, 'planner', 'hdz_tasks'
    )
    if (enterpriseCtx) {
      const routeResult = await modelRouter.resolve({
        tenantId: enterpriseCtx.tenantId,
        agentType: 'planner',
        taskType: 'hdz_tasks',
        organizationId: enterpriseCtx.organizationId,
        userId: user.id,
      })
      if (routeResult) {
        userCfg = modelRouter.toLLMConfig(routeResult)
      }
    }

    if (!userCfg) {
      return reply.status(400).send({ success: false, error: '请先在大模型设置中配置 LLM' })
    }

    // 构建生成提示
    const prompt = `${MASTER_PLAN_PROMPT}

用户输入：
${userInput || '无具体输入'}

参数：
- 目标章节数：${totalChapter || 1000}
- 卷数：${volumeCount || 5}
- 类型：${genre || '玄幻'}

请输出 JSON 格式总规划：`

    // 质量检查函数
    const qualityCheck = (plan: any): { ok: boolean; issues: string[] } => {
      const issues: string[] = []
      const planStr = JSON.stringify(plan)
      if (planStr.length < 3000) issues.push(`总长度仅 ${planStr.length} 字符，需 ≥3000`)
      if (!plan.worldDirection || plan.worldDirection.length < 100) issues.push('世界观描述不足 100 字')
      if (!plan.endingDirection || plan.endingDirection.length < 100) issues.push('结局方向不足 100 字')
      if (!Array.isArray(plan.volumes) || plan.volumes.length < 3) issues.push('卷结构不完整')
      if (!Array.isArray(plan.forbiddenRules) || plan.forbiddenRules.length < 3) issues.push('禁条规则不足 3 条')
      if (!Array.isArray(plan.foreshadowing) || plan.foreshadowing.length < 3) issues.push('伏笔不足 3 条')
      return { ok: issues.length === 0, issues }
    }

    try {
      let attempt = 0
      const maxAttempts = 3
      let masterPlan: any = null

      while (attempt < maxAttempts) {
        attempt++
        const attemptPrompt = attempt === 1 ? prompt :
          `${prompt}\n\n⚠️ 上次生成不满足质量要求，请重新生成。要求：每段描述充分展开，总长度≥3000字。`

        const result = await callLLM(userCfg, '你是一位网文总规划师', attemptPrompt, { maxTokens: 12000 })
        const jsonMatch = result.match(/\{[\s\S]*\}/)
        if (!jsonMatch) continue

        try {
          const parsed = JSON.parse(jsonMatch[0])
          const check = qualityCheck(parsed)
          if (check.ok) {
            masterPlan = parsed
            break
          }
          if (!masterPlan) masterPlan = parsed
        } catch {
          continue
        }
      }

      if (!masterPlan) {
        return reply.status(500).send({ success: false, error: 'AI 生成失败，无法解析 JSON 格式' })
      }

      // 保存
      const newVersion = (project.masterPlanVersion || 0) + 1
      await prisma.hdzProject.update({
        where: { id: projectId },
        data: { masterPlan: masterPlan as any, masterPlanVersion: newVersion },
      })

      const finalCheck = qualityCheck(masterPlan)
      return {
        success: true,
        data: {
          masterPlan,
          version: newVersion,
          quality: {
            passed: finalCheck.ok,
            planLength: JSON.stringify(masterPlan).length,
            issues: finalCheck.issues,
            attempts: attempt,
          },
        },
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: `生成失败: ${err.message}` })
    }
  })
}
