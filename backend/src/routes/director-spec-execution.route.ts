/**
 * routes/director-spec-execution.route.ts
 *
 * Production Preparation Layer — 导演资产 → 生产订单
 *
 * 数据流（收敛后）：
 *   AiSceneSpec/AiCharacterSpec (DB)
 *     ↓
 *   🟢 ProductionPreparationService.prepare()
 *     ↓
 *   🟢 DirectorProductionQualityGate.validate()
 *     ↓
 *   PreparedProductionAsset (保证字段完整)
 *     ↓
 *   buildPlanFromDbData() → DirectorExecutionPlan
 *     ↓
 *   executePlan() → /api/tasks/ai-generate → Worker → Provider → Asset
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { buildPlanFromDbData } from '../types/director-execution-plan.js'
import { ProductionPreparationService } from '../services/director/production-preparation.service.js'
import { DirectorProductionQualityGate } from '../services/director/director-production-quality-gate.js'
import { executePlan, createHttpSubmitter } from '../services/director-execution-adapter.js'

export default async function directorSpecExecutionRoutes(app: FastifyInstance) {
  // ── POST /api/director/execution/plan-from-specs ──
  // ProductionPreparationLayer 完整链路：Preparation → Gate → ExecutionPlan → Tasks
  app.post(
    '/api/director/execution/plan-from-specs',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const user = (req as any).user
      const { projectId, autoFix } = req.body as { projectId: string; autoFix?: boolean }

      if (!projectId) {
        return reply.status(400).send({ success: false, error: '缺少 projectId' })
      }

      const shouldFix = autoFix !== false

      // 1. 从 DB 读取场景和角色数据
      const rawScenes = await prisma.aiSceneSpec.findMany({
        where: { projectId },
        orderBy: { sortOrder: 'asc' },
      })

      const rawCharacters = await prisma.aiCharacterSpec.findMany({
        where: { projectId },
        orderBy: { sortOrder: 'asc' },
      })

      if (rawScenes.length === 0) {
        return reply.status(400).send({
          success: false,
          error: `项目 ${projectId} 没有场景数据（AiSceneSpec 为空）`,
        })
      }

      req.log.info(
        `[production-preparation] 读取到 ${rawScenes.length} 个场景, ${rawCharacters.length} 个角色, autoFix=${shouldFix}`,
      )

      // 2. Production Preparation Layer
      // ⭐ 动态导入 NarrativeGateway（避免模块循环依赖）
      const { narrativeGateway } = (await import('../runtime/narrative-gateway.js')) as any

      const preparationService = new ProductionPreparationService(
        shouldFix ? narrativeGateway : undefined,
      )

      const { asset, report, fixedScenes, fixedCharacters } =
        await preparationService.prepare(
          projectId,
          rawScenes.map((s) => ({
            sceneId: s.sceneId,
            sceneName: s.sceneName,
            description: s.description || '',
            imagePrompt: s.imagePrompt || '',
            mood: s.mood || '',
            timeOfDay: s.timeOfDay || '',
            lighting: s.lighting || '',
            environment: s.environment || '',
            sortOrder: s.sortOrder ?? 0,
          })),
          rawCharacters.map((c) => ({
            characterName: c.characterName,
            physicalDescription: c.physicalDescription || '',
            clothing: c.clothing || '',
            imagePrompt: c.imagePrompt || '',
            voiceType: undefined,
          })),
          shouldFix,
        )

      // 3. Quality Gate
      const gate = new DirectorProductionQualityGate()
      const gateResult = await gate.validate(asset, true)

      if (!gateResult.passed) {
        // BLOCK — 不静默跳过
        req.log.warn(
          `[production-preparation] 🚫 QualityGate FAIL: ${gateResult.reason}`,
        )

        return reply.status(422).send({
          success: false,
          error: `🚫 ${gateResult.reason}`,
          reason: 'STORYBOARD_PROMPT_INCOMPLETE',
          report: {
            sceneMissing: report.sceneMissing,
            characterMissing: report.characterMissing,
            totalMissing: report.totalMissing,
            summary: report.summary,
          },
          data: {
            projectId,
            totalScenes: rawScenes.length,
            totalCharacters: rawCharacters.length,
            totalMissing: report.totalMissing,
          },
        })
      }

      // 4. LLM 补全结果写回 DB（如有变更）
      if (fixedScenes.length > 0 || fixedCharacters.length > 0) {
        for (const scene of asset.scenes) {
          const original = rawScenes.find((s) => s.sceneId === scene.sceneId)
          if (original) {
            const updates: Record<string, any> = {}
            if (scene.imagePrompt !== original.imagePrompt) updates.imagePrompt = scene.imagePrompt
            if (scene.sceneDescription !== original.description) updates.description = scene.sceneDescription
            if (scene.mood !== original.mood) updates.mood = scene.mood
            if (scene.timeOfDay !== original.timeOfDay) updates.timeOfDay = scene.timeOfDay
            if (Object.keys(updates).length > 0) {
              await prisma.aiSceneSpec.updateMany({
                where: { projectId, sceneId: scene.sceneId },
                data: updates,
              })
            }
          }
        }

        for (const char of asset.characters) {
          const original = rawCharacters.find(
            (c) => c.characterName === char.characterName,
          )
          if (original) {
            const updates: Record<string, any> = {}
            if (char.imagePrompt !== original.imagePrompt) updates.imagePrompt = char.imagePrompt
            if (Object.keys(updates).length > 0) {
              await prisma.aiCharacterSpec.updateMany({
                where: { projectId, characterName: char.characterName },
                data: updates,
              })
            }
          }
        }

        req.log.info(
          `[production-preparation] ✅ LLM 补全已写回 DB: ${fixedScenes.length} 场景, ${fixedCharacters.length} 角色`,
        )
      }

      // 5. 构建执行计划（只接受 Prepared 类型 → 保证非空 prompt）
      const plan = buildPlanFromDbData(asset.projectId, asset.scenes, asset.characters)

      // 6. 提交执行
      const authHeader = req.headers.authorization
      const serverPort = process.env.PORT || 4002
      const apiBase = `http://localhost:${serverPort}`
      const submitter = createHttpSubmitter(
        apiBase,
        authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined,
      )
      const execResult = await executePlan(plan, submitter, user.id)

      req.log.info(
        `[production-preparation] ✅ 执行完成: ${execResult.summary.queued} queued, ${execResult.summary.failed} failed`,
      )

      return {
        success: execResult.success,
        data: {
          projectId,
          totalScenes: asset.scenes.length,
          totalCharacters: asset.characters.length,
          gateResult: {
            passed: gateResult.passed,
            fixed: fixedScenes.length + fixedCharacters.length,
            action: 'ALLOW_EXECUTION',
            report: {
              sceneMissing: report.sceneMissing,
              characterMissing: report.characterMissing,
              totalMissing: report.totalMissing,
            },
          },
          summary: execResult.summary,
          tasks: execResult.tasks.map((t) => ({
            sceneId: t.sceneId,
            taskType: t.taskType,
            taskId: t.taskId,
            status: t.status,
            promptSource: 'production-preparation',
          })),
        },
      }
    },
  )

  // ── GET /api/director/execution/specs-status/:projectId ──
  // 预览当前项目的准备状态
  app.get(
    '/api/director/execution/specs-status/:projectId',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { projectId } = req.params as { projectId: string }

      const scenes = await prisma.aiSceneSpec.findMany({
        where: { projectId },
        orderBy: { sortOrder: 'asc' },
      })

      const characters = await prisma.aiCharacterSpec.findMany({
        where: { projectId },
        orderBy: { sortOrder: 'asc' },
      })

      // 使用 Preparation 逻辑检查完整度
      const { narrativeGateway } = (await import('../runtime/narrative-gateway.js')) as any
      const service = new ProductionPreparationService(narrativeGateway)
      const { asset, report } = await service.prepare(
        projectId,
        scenes.map((s) => ({
          sceneId: s.sceneId,
          sceneName: s.sceneName,
          description: s.description || '',
          imagePrompt: s.imagePrompt || '',
          mood: s.mood || '',
          timeOfDay: s.timeOfDay || '',
          lighting: s.lighting || '',
          environment: s.environment || '',
          sortOrder: s.sortOrder ?? 0,
        })),
        characters.map((c) => ({
          characterName: c.characterName,
          physicalDescription: c.physicalDescription || '',
          clothing: c.clothing || '',
          imagePrompt: c.imagePrompt || '',
          voiceType: undefined,
        })),
        false, // 不自动补全，仅检查
      )

      const shouldFix = report.totalMissing > 0

      return {
        success: true,
        data: {
          projectId,
          scenes: {
            total: asset.scenes.length,
            missingImagePrompt: asset.scenes.filter((s) => !s.imagePrompt || s.imagePrompt.length < 20).length,
            missingDescription: asset.scenes.filter((s) => !s.sceneDescription || s.sceneDescription.length < 10).length,
            sampleMissing: asset.scenes
              .filter((s) => !s.imagePrompt || s.imagePrompt.length < 20)
              .slice(0, 3)
              .map((s) => ({
                sceneId: s.sceneId,
                sceneName: s.sceneName,
                imagePrompt: !s.imagePrompt ? '(empty)' : s.imagePrompt.slice(0, 30) + '...',
              })),
          },
          characters: {
            total: asset.characters.length,
            missingImagePrompt: asset.characters.filter((c) => !c.imagePrompt || c.imagePrompt.length < 20).length,
            sampleMissing: asset.characters
              .filter((c) => !c.imagePrompt || c.imagePrompt.length < 20)
              .slice(0, 3)
              .map((c) => ({
                name: c.characterName,
                imagePrompt: !c.imagePrompt ? '(empty)' : c.imagePrompt.slice(0, 30) + '...',
              })),
          },
          executable: report.passed,
          quality: {
            passed: report.passed,
            totalMissing: report.totalMissing,
            sceneMissing: report.sceneMissing.length,
            characterMissing: report.characterMissing.length,
          },
          message: shouldFix
            ? `发现 ${report.totalMissing} 个字段缺失，需要先执行 ProductionPreparation`
            : '所有资产已就绪，可直接生产',
        },
      }
    },
  )
}
