/**
 * routes/director-execution.route.ts
 *
 * 昆仑镜 → 火麒麟 执行路由。
 *
 * POST /api/director/execution/start
 *   接受 DirectorExecutionPlan（或从中推导的可执行计划）
 *   提交到 /api/tasks/ai-generate → BullMQ
 *
 * 设计：
 *   - 不直接调 AI Provider
 *   - 不绕过现有 Task Runtime
 *   - 只负责将"计划"转为"任务提交"
 *
 * ⚠️ QualityGate:
 *   所有进入此路由的 ExecutionPlan 必须满足：
 *   1. 所有 imagePrompt 非空（≥ 20 字符）
 *   2. metadata 包含 promptSource（表明来源经过 QualityGate）
 *      - 来自 plan-from-specs → promptSource = 'production-preparation'
 *      - 缺少 promptSource → 拒绝（告知使用 plan-from-specs 路由）
 */

import { FastifyInstance } from 'fastify'
import type { DirectorExecutionPlan } from '../types/director-execution-plan.js'
import { executePlan, executeScene, createHttpSubmitter } from '../services/director-execution-adapter.js'

// ── Quality Gate: 检查计划质量与来源 —─

function checkPlanQuality(plan: DirectorExecutionPlan): string[] {
  const issues: string[] = []

  // 1. 验证来源：所有执行计划必须标注来源
  if (!plan.metadata?.promptSource) {
    issues.push('缺少 promptSource（计划来源未经确认）。请通过 /api/director/execution/plan-from-specs 路由构建执行计划')
  }

  // 2. 验证 prompt 完整性
  for (const scene of plan.scenes) {
    for (const imgTask of scene.tasks.imageTasks) {
      if (!imgTask.prompt || imgTask.prompt.length < 20) {
        issues.push(`scene「${scene.sceneName || scene.sceneId}」.imagePrompt 为空或过短（${imgTask.prompt?.length || 0} 字符）`)
      }
    }
  }

  return issues
}

export default async function directorExecutionRoutes(app: FastifyInstance) {
  // ── POST /api/director/execution/start ──
  // 接收完整的 DirectorExecutionPlan，提交所有场景任务
  app.post('/api/director/execution/start', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    const { plan } = req.body as { plan: DirectorExecutionPlan }

    if (!plan || !plan.projectId || !plan.scenes?.length) {
      return reply.status(400).send({
        success: false,
        error: '缺少有效的 DirectorExecutionPlan（需要 projectId 和至少一个 scene）',
      })
    }

    // ⚠️ 生产质量门控 — 验证来源 + 空 prompt
    const qualityIssues = checkPlanQuality(plan)
    if (qualityIssues.length > 0) {
      req.log.warn(`[director-execution] 🚫 QualityGate FAIL: ${qualityIssues.join('; ')}`)
      return reply.status(422).send({
        success: false,
        error: `🚫 STORYBOARD_PROMPT_INCOMPLETE: ${qualityIssues.join('; ')}`,
        reason: 'STORYBOARD_PROMPT_INCOMPLETE',
        report: { issues: qualityIssues },
      })
    }

    // 提取 token + base URL 供内部 adapter 调用 /api/tasks/ai-generate 使用
    const authHeader = req.headers.authorization
    const serverPort = process.env.PORT || 4002
    const apiBase = `http://localhost:${serverPort}`
    const submitter = createHttpSubmitter(apiBase, authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined)
    const result = await executePlan(plan, submitter, user.id)

    req.log.info(`[director-execution] plan executed: ${result.summary.queued} queued, ${result.summary.failed} failed`)

    return {
      success: result.success,
      data: {
        projectId: result.projectId,
        summary: result.summary,
        tasks: result.tasks.map(t => ({
          sceneId: t.sceneId,
          taskType: t.taskType,
          taskId: t.taskId,
          status: t.status,
        })),
      },
    }
  })

  // ── POST /api/director/execution/scene ──
  // 只提交单个场景（用于单场景验证 / 用户逐场景制作）
  app.post('/api/director/execution/scene', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = (req as any).user
    const { scene, projectId } = req.body as { scene: any; projectId: string }

    if (!scene || !projectId) {
      return reply.status(400).send({
        success: false,
        error: '缺少 scene 或 projectId',
      })
    }

    // 组装最小 scene 结构
    const execScene = {
      sceneId: scene.sceneId || `scene-${Date.now()}`,
      sceneName: scene.sceneName,
      tasks: {
        imageTasks: (scene.imageTasks || scene.imagePrompt
          ? [{ prompt: scene.imagePrompt || '', order: 0 }]
          : []),
        videoTasks: (scene.videoTasks || []),
        audioTasks: (scene.audioTasks || []),
      },
    }

    const authHeader = req.headers.authorization
    const serverPort = process.env.PORT || 4002
    const apiBase = `http://localhost:${serverPort}`
    const submitter = createHttpSubmitter(apiBase, authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined)
    const result = await executeScene(execScene, projectId, submitter, user.id)

    req.log.info(`[director-execution] scene executed: ${result.summary.queued} queued, ${result.summary.failed} failed`)

    return {
      success: result.success,
      data: {
        projectId: result.projectId,
        summary: result.summary,
        tasks: result.tasks.map(t => ({
          sceneId: t.sceneId,
          taskType: t.taskType,
          taskId: t.taskId,
          status: t.status,
        })),
      },
    }
  })
}
