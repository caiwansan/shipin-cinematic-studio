import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function aigcSpecDbRoutes(fastify: FastifyInstance) {
  // POST /api/aigc-spec/:projectId/save — 保存完整 AIGC 规格表（由灵感页调用）
  const saveHandler = async (request: any, reply: any) => {
    const { projectId } = request.params as any

    // 校验 projectId 合法性 — 防止前端传 [object Object]
    if (typeof projectId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
      console.error(`[aigc-spec/save] 无效 projectId: ${projectId} (typeof=${typeof projectId})`)
      return reply.status(400).send({ error: `无效的项目 ID: ${projectId}，请刷新页面重试` })
    }

    const { characterSpecs, sceneSpecs, voiceConfigs, videoSegments, frameDesign, videoProduction, effectSpecs, actionSpecs, cameraSpecs, emotionSpecs, props, propSpecs, propImages } = request.body as any

    // ⭐ 在 deleteMany 之前，读取当前 DB 状态作为 fallback
    // 防止前端未传递的字段（如 imagePrompt、fullText）被清空
    const [dbCharacters, dbScenes, dbSegments, dbEffects, dbActions, dbCameras, dbEmotions, dbProps] = await Promise.all([
      prisma.aiCharacterSpec.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.aiSceneSpec.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.aiVideoSegment.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.aiEffectSpec.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.aiActionSpec.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.aiCameraSpec.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.aiEmotionSpec.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.propImage.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
    ])

    // 构建 fallback 字典：按 sceneId/segmentId/characterName 索引
    const dbSceneMap = new Map(dbScenes.map(s => [s.sceneId, s]))
    const dbSegMap = new Map(dbSegments.map(s => [s.segmentId, s]))
    const dbCharMap = new Map(dbCharacters.map(c => [c.characterName, c]))
    const dbEffectMap = new Map(dbEffects.map(e => [e.effectName, e]))
    const dbActionMap = new Map(dbActions.map(a => [a.actionName, a]))
    const dbCameraMap = new Map(dbCameras.map(c => [c.segmentId, c]))
    const dbPropMap = new Map(dbProps.map(p => [p.propName, p]))

    // 将清理旧数据 + 批量插入新数据包裹在同一个 $transaction callback 中，确保原子性
    // 修复：原代码 deleteMany 在事务内但 createMany 在事务外，并发时可能丢失数据
    await prisma.$transaction(async (tx) => {
      // 先清理旧数据（包括道具表）
      await tx.aiCharacterSpec.deleteMany({ where: { projectId } })
      await tx.aiSceneSpec.deleteMany({ where: { projectId } })
      await tx.aiVoiceConfig.deleteMany({ where: { projectId } })
      await tx.aiVideoSegment.deleteMany({ where: { projectId } })
      await tx.aiFrameDesign.deleteMany({ where: { projectId } })
      await tx.aiVideoProduction.deleteMany({ where: { projectId } })
      await tx.aiEffectSpec.deleteMany({ where: { projectId } })
      await tx.aiActionSpec.deleteMany({ where: { projectId } })
      await tx.aiCameraSpec.deleteMany({ where: { projectId } })
      await tx.aiEmotionSpec.deleteMany({ where: { projectId } })
      await tx.propImage.deleteMany({ where: { projectId } })

      // 批量插入新数据
      if (characterSpecs?.length) {
        await tx.aiCharacterSpec.createMany({
          data: characterSpecs.map((c: any, i: number) => {
            const db = dbCharMap.get(c.characterName)
            return {
              projectId, characterName: c.characterName, gender: c.gender, age: c.age,
              physicalDescription: c.physicalDescription, clothing: c.clothing,
              imagePrompt: c.imagePrompt || db?.imagePrompt || '',
              negativePrompt: c.negativePrompt || db?.negativePrompt || '',
              sortOrder: i,
            }
          }),
        })
      }
      if (sceneSpecs?.length) {
        await tx.aiSceneSpec.createMany({
          data: sceneSpecs.map((s: any, i: number) => {
            const db = dbSceneMap.get(s.sceneId)
            return {
              projectId, sceneId: s.sceneId, sceneName: s.sceneName,
              description: s.description || db?.description || '',
              imagePrompt: s.imagePrompt || db?.imagePrompt || '',
              negativePrompt: s.negativePrompt || db?.negativePrompt || null,
              aspectRatio: s.aspectRatio || db?.aspectRatio || '9:16',
              sortOrder: i,
            }
          }),
        })
      }
      if (voiceConfigs?.length) {
        await tx.aiVoiceConfig.createMany({
          data: voiceConfigs.map((v: any, i: number) => ({
            projectId, characterName: v.characterName, voiceType: v.voiceType,
            speakingStyle: v.speakingStyle, pitch: Number(v.pitch) || 1.0,
            speed: typeof v.speed === 'string' ? (v.speed.includes('快') ? 1.5 : v.speed.includes('慢') ? 0.7 : 1.0) : (Number(v.speed) || 1.0),
            ttsPrompt: v.ttsPrompt, sortOrder: i,
          })),
        })
      }
      if (videoSegments?.length) {
        await tx.aiVideoSegment.createMany({
          data: videoSegments.map((v: any, i: number) => {
            const db = dbSegMap.get(v.segmentId)
            return {
              projectId, segmentId: v.segmentId, title: v.title,
              associatedScenes: JSON.stringify(v.associatedScenes || []),
              fullText: v.fullText || db?.fullText || '',
              duration: v.duration, narrativePurpose: v.narrativePurpose,
              shotPattern: v.shotPattern, emotionArc: v.emotionArc,
              backgroundMusic: v.backgroundMusic, sortOrder: i,
            }
          }),
        })
      }
      if (frameDesign?.length) {
        await tx.aiFrameDesign.createMany({
          data: frameDesign.map((f: any, i: number) => ({
            projectId, segmentId: f.segmentId,
            firstFrameDesc: f.firstFrame?.description, firstFramePrompt: f.firstFrame?.imagePrompt, firstFrameAngle: f.firstFrame?.cameraAngle,
            lastFrameDesc: f.lastFrame?.description, lastFramePrompt: f.lastFrame?.imagePrompt, lastFrameAngle: f.lastFrame?.cameraAngle,
            sortOrder: i,
          })),
        })
      }
      if (videoProduction) {
        await tx.aiVideoProduction.create({
          data: {
            projectId, overallStyle: videoProduction.overallStyle, fps: videoProduction.fps || 24,
            resolution: videoProduction.resolution || '1920x1080', colorPalette: videoProduction.colorPalette,
            transitionStyle: videoProduction.transitionStyle, subtitleStyle: videoProduction.subtitleStyle,
            globalNegativePrompt: videoProduction.globalNegativePrompt,
          },
        })
      }

      // 特效规范
      if (effectSpecs?.length) {
        await tx.aiEffectSpec.createMany({
          data: effectSpecs.map((e: any, i: number) => {
            const db = dbEffectMap.get(e.effectName)
            return {
              projectId, effectName: e.effectName, effectType: e.effectType,
              triggerScene: e.triggerScene || db?.triggerScene || null,
              triggerEvent: e.triggerEvent || db?.triggerEvent || null,
              visualDescription: e.visualDescription || db?.visualDescription || '',
              colorPalette: e.colorPalette || db?.colorPalette || '',
              duration: e.duration || db?.duration || null,
              intensity: e.intensity || db?.intensity || null,
              notes: e.notes || db?.notes || '',
              sortOrder: i,
            }
          }),
        })
      }

      // 人物动作规范
      if (actionSpecs?.length) {
        await tx.aiActionSpec.createMany({
          data: actionSpecs.map((a: any, i: number) => {
            const db = dbActionMap.get(a.actionName)
            return {
              projectId, characterName: a.characterName, actionName: a.actionName,
              triggerCondition: a.triggerCondition || db?.triggerCondition || '',
              movementDesc: a.movementDesc || db?.movementDesc || '',
              facialExpression: a.facialExpression || db?.facialExpression || '',
              bodyLanguage: a.bodyLanguage || db?.bodyLanguage || '',
              cameraFocus: a.cameraFocus || db?.cameraFocus || '',
              duration: a.duration || db?.duration || null,
              sortOrder: i,
            }
          }),
        })
      }

      // 运镜规范
      if (cameraSpecs?.length) {
        await tx.aiCameraSpec.createMany({
          data: cameraSpecs.map((c: any, i: number) => {
            const db = dbCameraMap.get(c.segmentId)
            return {
              projectId, segmentId: c.segmentId, cameraMovement: c.cameraMovement || db?.cameraMovement || '',
              shotSize: c.shotSize || db?.shotSize || '',
              angle: c.angle || db?.angle || '',
              duration: c.duration || db?.duration || null,
              transition: c.transition || db?.transition || '',
              purpose: c.purpose || db?.purpose || '',
              sortOrder: i,
            }
          }),
        })
      }

      // 情绪表达规范
      if (emotionSpecs?.length) {
        await tx.aiEmotionSpec.createMany({
          data: emotionSpecs.map((e: any, i: number) => {
            const db = dbEmotionMap.get(e.characterName + ':' + e.emotionType)
            return {
              projectId, characterName: e.characterName, emotionType: e.emotionType,
              intensity: e.intensity || db?.intensity || '',
              facialDesc: e.facialDesc || db?.facialDesc || '',
              bodyLanguage: e.bodyLanguage || db?.bodyLanguage || '',
              voiceTone: e.voiceTone || db?.voiceTone || '',
              triggerEvent: e.triggerEvent || db?.triggerEvent || '',
              timing: e.timing || db?.timing || '',
              cameraPreference: e.cameraPreference || db?.cameraPreference || '',
              sortOrder: i,
            }
          }),
        })
      }

      // 道具数据保存（兼容 propSpecs / props / propImages 三种字段名）
      const saveProps = propSpecs || props || propImages || []
      if (saveProps.length) {
        // 如果已是 propImage 格式（含 imageUrl），直接保存
        const hasImageUrls = saveProps.some((p: any) => p.imageUrl)
        if (hasImageUrls) {
          await tx.propImage.createMany({
            data: saveProps.map((p: any, i: number) => {
              const db = dbPropMap.get(p.propName || p.name || '')
              return {
                projectId,
                propName: p.propName || p.name || '',
                category: p.category || db?.category || '通用',
                description: p.description || db?.description || '',
                imageUrl: p.imageUrl || db?.imageUrl || '',
                imagePrompt: p.imagePrompt || db?.imagePrompt || null,
                negativePrompt: p.negativePrompt || db?.negativePrompt || null,
                referenceUrl: p.referenceUrl || db?.referenceUrl || null,
                sortOrder: i,
              }
            }),
          })
        } else {
          // propSpecs 格式（无 imageUrl，是设计阶段的道具规格）
          await tx.propImage.createMany({
            data: saveProps.map((p: any, i: number) => {
              const db = dbPropMap.get(p.name || p.propName || '')
              return {
                projectId,
                propName: p.name || p.propName || '',
                category: p.category || db?.category || '通用',
                description: p.description || db?.description || '',
                imageUrl: db?.imageUrl || '',
                imagePrompt: db?.imagePrompt || null,
                negativePrompt: db?.negativePrompt || null,
                referenceUrl: db?.referenceUrl || null,
                sortOrder: i,
              }
            }),
          })
        }
      }

      // ⭐ 同步更新 pipeline_stages：script-analysis 完成
      const now = new Date()
      for (const stageKey of ['script-analysis']) {
        await tx.pipelineStage.upsert({
          where: { projectId_stageKey: { projectId, stageKey } },
          create: { projectId, stageKey, status: 'done', inputData: {}, outputData: {}, completedAt: now, startedAt: now },
          update: { status: 'done', outputData: {}, completedAt: now },
        })
      }
    })

    return { success: true }
  }

  // GET /api/aigc-spec/:projectId/load — 加载完整规格表
  const loadHandler = async (request: any, reply: any) => {
    const { projectId } = request.params as any

    const [characters, scenes, voices, segments, frames, production, effects, actions, cameras, emotions, props, propSpecs] = await Promise.all([
      prisma.aiCharacterSpec.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.aiSceneSpec.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.aiVoiceConfig.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.aiVideoSegment.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.aiFrameDesign.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.aiVideoProduction.findUnique({ where: { projectId } }),
      prisma.aiEffectSpec.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.aiActionSpec.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.aiCameraSpec.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.aiEmotionSpec.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.propImage.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.aiPropSpec.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
    ])

    // 转成前端期望的格式
    const frameDesign = frames.map(f => ({
      segmentId: f.segmentId,
      firstFrame: { description: f.firstFrameDesc, imagePrompt: f.firstFramePrompt, cameraAngle: f.firstFrameAngle },
      lastFrame: { description: f.lastFrameDesc, imagePrompt: f.lastFramePrompt, cameraAngle: f.lastFrameAngle },
    }))

    return {
      characterSpecs: characters,
      sceneSpecs: scenes,
      voiceConfigs: voices,
      videoSegments: segments.map(s => ({ ...s, associatedScenes: JSON.parse(s.associatedScenes || '[]') })),
      frameDesign,
      videoProduction: production || null,
      effectSpecs: effects,
      actionSpecs: actions,
      cameraSpecs: cameras,
      emotionSpecs: emotions,
      propImages: props,
      propSpecs: propSpecs,
    }
  }

  // 注册路由（兼容 /api/aigc-spec/ 和 /api/v1/aigc-spec/ 两个路径）
  fastify.post('/api/aigc-spec/:projectId/save', { preHandler: [fastify.authenticate] }, saveHandler)
  fastify.post('/api/v1/aigc-spec/:projectId/save', { preHandler: [fastify.authenticate] }, saveHandler)
  fastify.get('/api/aigc-spec/:projectId/load', { preHandler: [fastify.authenticate] }, loadHandler)
  fastify.get('/api/v1/aigc-spec/:projectId/load', { preHandler: [fastify.authenticate] }, loadHandler)
}
