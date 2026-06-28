import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function aigcSpecDbRoutes(fastify: FastifyInstance) {
  // POST /api/aigc-spec/:projectId/save — 保存完整 AIGC 规格表（由灵感页调用）
  fastify.post('/api/aigc-spec/:projectId/save', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as any
    const { characterSpecs, sceneSpecs, voiceConfigs, videoSegments, frameDesign, videoProduction, effectSpecs, actionSpecs, cameraSpecs, emotionSpecs } = request.body as any

    // 先清理旧数据
    await prisma.$transaction([
      prisma.aiCharacterSpec.deleteMany({ where: { projectId } }),
      prisma.aiSceneSpec.deleteMany({ where: { projectId } }),
      prisma.aiVoiceConfig.deleteMany({ where: { projectId } }),
      prisma.aiVideoSegment.deleteMany({ where: { projectId } }),
      prisma.aiFrameDesign.deleteMany({ where: { projectId } }),
      prisma.aiVideoProduction.deleteMany({ where: { projectId } }),
      prisma.aiEffectSpec.deleteMany({ where: { projectId } }),
      prisma.aiActionSpec.deleteMany({ where: { projectId } }),
      prisma.aiCameraSpec.deleteMany({ where: { projectId } }),
      prisma.aiEmotionSpec.deleteMany({ where: { projectId } }),
    ])

    // 批量插入新数据
    if (characterSpecs?.length) {
      await prisma.aiCharacterSpec.createMany({
        data: characterSpecs.map((c: any, i: number) => ({
          projectId, characterName: c.characterName, gender: c.gender, age: c.age,
          physicalDescription: c.physicalDescription, clothing: c.clothing,
          imagePrompt: c.imagePrompt, negativePrompt: c.negativePrompt,
          sortOrder: i,
        })),
      })
    }
    if (sceneSpecs?.length) {
      await prisma.aiSceneSpec.createMany({
        data: sceneSpecs.map((s: any, i: number) => ({
          projectId, sceneId: s.sceneId, sceneName: s.sceneName,
          description: s.description, imagePrompt: s.imagePrompt,
          negativePrompt: s.negativePrompt, aspectRatio: s.aspectRatio || '16:9',
          sortOrder: i,
        })),
      })
    }
    if (voiceConfigs?.length) {
      await prisma.aiVoiceConfig.createMany({
        data: voiceConfigs.map((v: any, i: number) => ({
          projectId, characterName: v.characterName, voiceType: v.voiceType,
          speakingStyle: v.speakingStyle, pitch: v.pitch || 1.0, speed: v.speed || 1.0,
          ttsPrompt: v.ttsPrompt, sortOrder: i,
        })),
      })
    }
    if (videoSegments?.length) {
      await prisma.aiVideoSegment.createMany({
        data: videoSegments.map((v: any, i: number) => ({
          projectId, segmentId: v.segmentId, title: v.title,
          associatedScenes: JSON.stringify(v.associatedScenes || []),
          duration: v.duration, narrativePurpose: v.narrativePurpose,
          shotPattern: v.shotPattern, emotionArc: v.emotionArc,
          backgroundMusic: v.backgroundMusic, sortOrder: i,
        })),
      })
    }
    if (frameDesign?.length) {
      await prisma.aiFrameDesign.createMany({
        data: frameDesign.map((f: any, i: number) => ({
          projectId, segmentId: f.segmentId,
          firstFrameDesc: f.firstFrame?.description, firstFramePrompt: f.firstFrame?.imagePrompt, firstFrameAngle: f.firstFrame?.cameraAngle,
          lastFrameDesc: f.lastFrame?.description, lastFramePrompt: f.lastFrame?.imagePrompt, lastFrameAngle: f.lastFrame?.cameraAngle,
          sortOrder: i,
        })),
      })
    }
    if (videoProduction) {
      await prisma.aiVideoProduction.create({
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
      await prisma.aiEffectSpec.createMany({
        data: effectSpecs.map((e: any, i: number) => ({
          projectId, effectName: e.effectName, effectType: e.effectType,
          triggerScene: e.triggerScene, triggerEvent: e.triggerEvent,
          visualDescription: e.visualDescription, colorPalette: e.colorPalette,
          duration: e.duration, intensity: e.intensity, notes: e.notes,
          sortOrder: i,
        })),
      })
    }

    // 人物动作规范
    if (actionSpecs?.length) {
      await prisma.aiActionSpec.createMany({
        data: actionSpecs.map((a: any, i: number) => ({
          projectId, characterName: a.characterName, actionName: a.actionName,
          triggerCondition: a.triggerCondition, movementDesc: a.movementDesc,
          facialExpression: a.facialExpression, bodyLanguage: a.bodyLanguage,
          cameraFocus: a.cameraFocus, duration: a.duration,
          sortOrder: i,
        })),
      })
    }

    // 运镜规范
    if (cameraSpecs?.length) {
      await prisma.aiCameraSpec.createMany({
        data: cameraSpecs.map((c: any, i: number) => ({
          projectId, segmentId: c.segmentId, cameraMovement: c.cameraMovement,
          shotSize: c.shotSize, angle: c.angle,
          duration: c.duration, transition: c.transition, purpose: c.purpose,
          sortOrder: i,
        })),
      })
    }

    // 情绪表达规范
    if (emotionSpecs?.length) {
      await prisma.aiEmotionSpec.createMany({
        data: emotionSpecs.map((e: any, i: number) => ({
          projectId, characterName: e.characterName, emotionType: e.emotionType,
          intensity: e.intensity, facialDesc: e.facialDesc,
          bodyLanguage: e.bodyLanguage, voiceTone: e.voiceTone,
          triggerEvent: e.triggerEvent, timing: e.timing,
          cameraPreference: e.cameraPreference,
          sortOrder: i,
        })),
      })
    }

    return { success: true }
  })

  // GET /api/aigc-spec/:projectId/load — 加载完整规格表
  fastify.get('/api/aigc-spec/:projectId/load', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as any

    const [characters, scenes, voices, segments, frames, production, effects, actions, cameras, emotions] = await Promise.all([
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
    }
  })
}
