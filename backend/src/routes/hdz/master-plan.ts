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
import { computePlanDiff } from '../../services/hdz/plan-diff.service.js'

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
    const diff = computePlanDiff(project.masterPlan as any, masterPlan as any)

    // 记录修订历史
    await prisma.hdzPlanRevision.create({
      data: {
        projectId,
        version: newVersion,
        reason: reason || null,
        planBefore: project.masterPlan as any,
        planAfter: masterPlan as any,
        diffSummary: diff.diffSummary,
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

      // 保存（新生成总纲默认为 draft 状态）——记录修订历史（覆盖旧总纲，可回滚）
      const newVersion = (project.masterPlanVersion || 0) + 1
      const savedPlan = { ...masterPlan, status: masterPlan.status || 'draft', generatedAt: new Date().toISOString() }
      const diff = computePlanDiff(project.masterPlan as any, savedPlan as any)
      if ((project.masterPlan as any) && JSON.stringify(project.masterPlan) !== JSON.stringify(savedPlan)) {
        await prisma.hdzPlanRevision.create({
          data: {
            projectId,
            version: newVersion,
            reason: '重新生成总纲（覆盖旧版）',
            planBefore: project.masterPlan as any,
            planAfter: savedPlan as any,
            diffSummary: diff.diffSummary,
          },
        })
      }
      await prisma.hdzProject.update({
        where: { id: projectId },
        data: { masterPlan: savedPlan as any, masterPlanVersion: newVersion },
      })

      const finalCheck = qualityCheck(masterPlan)
      return {
        success: true,
        data: {
          masterPlan: savedPlan,
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

  // ─── 总纲状态机：draft → confirmed → locked ───

  // 确认总纲（draft → confirmed）：作者认可后 writer 严格遵循
  app.post('/api/hdz/projects/:projectId/master-plan/confirm', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const mp = (project.masterPlan as any) || {}
    if (mp.status === 'locked') {
      return reply.status(400).send({ success: false, error: '总纲已锁定，如需修改请先解锁' })
    }
    if (!mp.title && !mp.worldDirection && !mp.volumes) {
      return reply.status(400).send({ success: false, error: '请先生成总纲再确认' })
    }

    const newVersion = (project.masterPlanVersion || 0) + 1
    const updatedPlan = { ...mp, status: 'confirmed', confirmedAt: new Date().toISOString() }
    const diff = computePlanDiff(project.masterPlan as any, updatedPlan as any)

    await prisma.hdzPlanRevision.create({
      data: {
        projectId,
        version: newVersion,
        reason: '作者确认总纲（draft → confirmed）',
        planBefore: project.masterPlan as any,
        planAfter: updatedPlan as any,
        diffSummary: diff.diffSummary,
      },
    })

    await prisma.hdzProject.update({
      where: { id: projectId },
      data: { masterPlan: updatedPlan as any, masterPlanVersion: newVersion },
    })

    return { success: true, data: { masterPlan: updatedPlan, version: newVersion } }
  })

  // 锁定总纲（confirmed → locked）：锁定后 writer 强制遵循，不可修改
  app.post('/api/hdz/projects/:projectId/master-plan/lock', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const mp = (project.masterPlan as any) || {}
    if (mp.status !== 'confirmed') {
      return reply.status(400).send({ success: false, error: '只有已确认（confirmed）的总纲才能锁定' })
    }

    const newVersion = (project.masterPlanVersion || 0) + 1
    const updatedPlan = { ...mp, status: 'locked', lockedAt: new Date().toISOString() }
    const diff = computePlanDiff(project.masterPlan as any, updatedPlan as any)

    await prisma.hdzPlanRevision.create({
      data: {
        projectId,
        version: newVersion,
        reason: '作者锁定总纲（confirmed → locked），后续创作强制遵循',
        planBefore: project.masterPlan as any,
        planAfter: updatedPlan as any,
        diffSummary: diff.diffSummary,
      },
    })

    await prisma.hdzProject.update({
      where: { id: projectId },
      data: { masterPlan: updatedPlan as any, masterPlanVersion: newVersion },
    })

    return { success: true, data: { masterPlan: updatedPlan, version: newVersion } }
  })

  // 解锁总纲（locked → confirmed）：作者主动解锁后才能修改
  app.post('/api/hdz/projects/:projectId/master-plan/unlock', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const mp = (project.masterPlan as any) || {}
    if (mp.status !== 'locked') {
      return reply.status(400).send({ success: false, error: '总纲未锁定，无需解锁' })
    }

    const newVersion = (project.masterPlanVersion || 0) + 1
    const updatedPlan = { ...mp, status: 'confirmed', lockedAt: undefined }
    const diff = computePlanDiff(project.masterPlan as any, updatedPlan as any)

    await prisma.hdzPlanRevision.create({
      data: {
        projectId,
        version: newVersion,
        reason: '作者解锁总纲（locked → confirmed）',
        planBefore: project.masterPlan as any,
        planAfter: updatedPlan as any,
        diffSummary: diff.diffSummary,
      },
    })

    await prisma.hdzProject.update({
      where: { id: projectId },
      data: { masterPlan: updatedPlan as any, masterPlanVersion: newVersion },
    })

    return { success: true, data: { masterPlan: updatedPlan, version: newVersion } }
  })

  // ─── 版本治理：回滚 + 影响分析 ───

  // 影响分析：对比当前总纲与指定版本，估算受影响章节
  app.get('/api/hdz/projects/:projectId/master-plan/impact', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any
    const { version } = request.query as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }
    if (!version) {
      return reply.status(400).send({ success: false, error: '缺少 version 参数' })
    }

    const target = await prisma.hdzPlanRevision.findFirst({
      where: { projectId, version: Number(version) },
      orderBy: { createdAt: 'desc' },
    })
    if (!target) {
      return reply.status(404).send({ success: false, error: '版本不存在' })
    }

    const diff = computePlanDiff(target.planAfter as any, project.masterPlan as any)
    return {
      success: true,
      data: {
        fromVersion: Number(version),
        currentVersion: project.masterPlanVersion || 0,
        diff: diff.diffSummary,
        impact: diff.impact,
        changed: diff.changed,
      },
    }
  })

  // 回滚到指定版本：locked 状态禁止；回滚生成新修订记录（Git 式，可再回滚）
  app.post('/api/hdz/projects/:projectId/master-plan/rollback', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any
    const { version } = request.body as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }
    if (!version) {
      return reply.status(400).send({ success: false, error: '缺少 version 参数' })
    }

    const mp = (project.masterPlan as any) || {}
    if (mp.status === 'locked') {
      return reply.status(400).send({ success: false, error: '总纲已锁定，请先解锁再回滚' })
    }

    const target = await prisma.hdzPlanRevision.findFirst({
      where: { projectId, version: Number(version) },
      orderBy: { createdAt: 'desc' },
    })
    if (!target) {
      return reply.status(404).send({ success: false, error: '目标版本不存在' })
    }

    const targetPlan = target.planAfter as any
    const newVersion = (project.masterPlanVersion || 0) + 1
    const diff = computePlanDiff(project.masterPlan as any, targetPlan as any)

    // 回滚目标：还原到目标版本内容，状态保持当前（回滚不改变状态机）
    const restoredPlan = { ...(targetPlan || {}), status: mp.status || targetPlan?.status || 'draft' }

    await prisma.hdzPlanRevision.create({
      data: {
        projectId,
        version: newVersion,
        reason: `回滚到 V${Number(version)}（由用户发起）`,
        planBefore: project.masterPlan as any,
        planAfter: restoredPlan as any,
        diffSummary: diff.diffSummary,
      },
    })

    await prisma.hdzProject.update({
      where: { id: projectId },
      data: { masterPlan: restoredPlan as any, masterPlanVersion: newVersion },
    })

    // ★ 02-B Task 2：Rollback 影响自动治理——受影响章节标记 needs_rewrite（旧世界不残留）
    let markedChapterCount = 0
    try {
      const ranges: string[] = diff.impact?.affectedChapterRanges || []
      const chapterNos = new Set<number>()
      for (const r of ranges) {
        if (String(r).includes('全部章节')) {
          // 世界观/禁则变更 → 全部已生成章节受影响
          const all = await prisma.hdzChapter.findMany({ where: { projectId, content: { not: null } }, select: { chapterNo: true } })
          all.forEach(c => chapterNos.add(c.chapterNo))
          continue
        }
        const m = String(r).match(/(\d{1,5})\s*[-~至]\s*(\d{1,5})/)
        if (m) {
          const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)]
          for (let n = Math.min(a, b); n <= Math.max(a, b); n++) chapterNos.add(n)
        }
      }
      if (chapterNos.size > 0) {
        const affected = await prisma.hdzChapter.findMany({
          where: { projectId, chapterNo: { in: [...chapterNos] }, content: { not: null } },
          select: { id: true },
        })
        if (affected.length > 0) {
          await prisma.hdzChapter.updateMany({
            where: { id: { in: affected.map(c => c.id) } },
            data: { status: 'needs_rewrite' },
          })
          markedChapterCount = affected.length
        }
      }
      console.log(`[MasterPlan/Rollback] V${newVersion}: 标记 ${markedChapterCount} 章 needs_rewrite（受影响区间 ${ranges.join(', ') || '无'}）`)
    } catch (markErr: any) {
      console.warn(`[MasterPlan/Rollback] 章节标记失败（不影响回滚本身）: ${markErr.message}`)
    }

    return {
      success: true,
      data: {
        masterPlan: restoredPlan,
        version: newVersion,
        rolledBackTo: Number(version),
        diff: diff.diffSummary,
        impact: diff.impact,
        needsRewrite: markedChapterCount, // 02-B：受影响章节已标记待重写
      },
    }
  })
}
