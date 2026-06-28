/**
 * services/project-hydrate.service.ts — 项目全量创建 & 全量加载
 *
 * 统一入口，事务级写入/读取项目的所有关联数据。
 * 目标：Single Source of Truth = Database
 */

import { prisma } from '../utils/index.js'

export interface FullCreateInput {
  name: string
  description?: string
  script?: string
  userId: string
  status?: string
  // 设计规格
  characterSpecs?: any[]
  sceneSpecs?: any[]
  voiceConfigs?: any[]
  videoSegments?: any[]
  frameDesign?: any[]
  videoProduction?: any
  effectSpecs?: any[]
  actionSpecs?: any[]
  cameraSpecs?: any[]
  emotionSpecs?: any[]
  propSpecs?: any[]
  plotBlueprint?: any
  // 世界初始状态
  worldMemory?: any
  storyGraph?: any
  renderConfig?: any
}

export const projectHydrateService = {
  /**
   * 全量创建项目（事务）
   */
  async fullCreate(input: FullCreateInput) {
    const {
      name, description, script, userId, status,
      characterSpecs, sceneSpecs, voiceConfigs,
      videoSegments, frameDesign, videoProduction,
      effectSpecs, actionSpecs, cameraSpecs, emotionSpecs, propSpecs,
      worldMemory,
    } = input

    return await prisma.$transaction(async (tx) => {
      // 1. 创建项目
      const project = await tx.project.create({
        data: {
          name,
          description: script || description || '',
          userId,
          status: status || 'designing',
        },
      })

      // 2. 写入角色规格
      if (characterSpecs?.length) {
        await tx.aiCharacterSpec.createMany({
          data: characterSpecs.map((c: any, i: number) => ({
            projectId: project.id,
            characterName: c.characterName,
            gender: c.gender,
            age: c.age,
            physicalDescription: c.physicalDescription,
            clothing: c.clothing,
            imagePrompt: c.imagePrompt,
            negativePrompt: c.negativePrompt,
            referenceImageUrl: c.referenceImageUrl,
            sortOrder: i,
          })),
        })
      }

      // 3. 写入场景规格
      if (sceneSpecs?.length) {
        await tx.aiSceneSpec.createMany({
          data: sceneSpecs.map((s: any, i: number) => ({
            projectId: project.id,
            sceneId: s.sceneId,
            sceneName: s.sceneName,
            description: s.description,
            imagePrompt: s.imagePrompt,
            negativePrompt: s.negativePrompt,
            aspectRatio: s.aspectRatio || '9:16',
            sortOrder: i,
          })),
        })
      }

      // 4. 写入音色配置
      if (voiceConfigs?.length) {
        await tx.aiVoiceConfig.createMany({
          data: voiceConfigs.map((v: any, i: number) => ({
            projectId: project.id,
            characterName: v.characterName,
            voiceType: v.voiceType,
            speakingStyle: v.speakingStyle,
            pitch: v.pitch || 1.0,
            speed: v.speed || 1.0,
            ttsPrompt: v.ttsPrompt,
            sortOrder: i,
          })),
        })
      }

      // 5. 写入视频分段
      if (videoSegments?.length) {
        await tx.aiVideoSegment.createMany({
          data: videoSegments.map((vs: any, i: number) => ({
            projectId: project.id,
            segmentId: vs.segmentId,
            title: vs.title,
            associatedScenes: JSON.stringify(vs.associatedScenes || []),
            duration: vs.duration,
            narrativePurpose: vs.narrativePurpose,
            fullText: vs.fullText,
            shotPattern: vs.shotPattern,
            emotionArc: vs.emotionArc,
            backgroundMusic: vs.backgroundMusic,
            sortOrder: i,
          })),
        })
      }

      // 6. 写入帧设计
      if (frameDesign?.length) {
        await tx.aiFrameDesign.createMany({
          data: frameDesign.map((fd: any, i: number) => ({
            projectId: project.id,
            segmentId: fd.segmentId,
            firstFrameDesc: fd.firstFrame?.description,
            firstFramePrompt: fd.firstFrame?.imagePrompt,
            firstFrameAngle: fd.firstFrame?.cameraAngle,
            lastFrameDesc: fd.lastFrame?.description,
            lastFramePrompt: fd.lastFrame?.imagePrompt,
            lastFrameAngle: fd.lastFrame?.cameraAngle,
            sortOrder: i,
          })),
        })
      }
      // 7. 写入道具规格（先当做道具模板，有图片时由 save 接口补充到 prop_images）
      if (propSpecs?.length) {
        await tx.propImage.createMany({
          data: propSpecs.map((p: any, i: number) => ({
            projectId: project.id,
            propName: p.name || p.propName || `道具${i+1}`,
            category: p.category || '通用',
            description: p.description || p.detail || '',
            imagePrompt: p.imagePrompt || null,
            negativePrompt: p.negativePrompt || null,
            imageUrl: p.imageUrl || null,
            sortOrder: i,
          })),
        })
      }

      // 8. 写入视频制作配置
      if (videoProduction) {
        await tx.aiVideoProduction.create({
          data: {
            projectId: project.id,
            overallStyle: videoProduction.overallStyle,
            fps: videoProduction.fps || 24,
            resolution: videoProduction.resolution || '1920x1080',
            colorPalette: videoProduction.colorPalette,
            transitionStyle: videoProduction.transitionStyle,
            subtitleStyle: videoProduction.subtitleStyle,
            globalNegativePrompt: videoProduction.globalNegativePrompt,
          },
        })
      }

      // 8. 写入特效规范
      if (effectSpecs?.length) {
        await tx.aiEffectSpec.createMany({
          data: effectSpecs.map((e: any, i: number) => ({
            projectId: project.id,
            effectName: e.effectName,
            effectType: e.effectType,
            triggerScene: e.triggerScene,
            triggerEvent: e.triggerEvent,
            visualDescription: e.visualDescription,
            colorPalette: e.colorPalette,
            duration: e.duration,
            intensity: e.intensity,
            notes: e.notes,
            sortOrder: i,
          })),
        })
      }

      // 9. 写入动作规范
      if (actionSpecs?.length) {
        await tx.aiActionSpec.createMany({
          data: actionSpecs.map((a: any, i: number) => ({
            projectId: project.id,
            characterName: a.characterName,
            actionName: a.actionName,
            triggerCondition: a.triggerCondition,
            movementDesc: a.movementDesc,
            facialExpression: a.facialExpression,
            bodyLanguage: a.bodyLanguage,
            cameraFocus: a.cameraFocus,
            duration: a.duration,
            sortOrder: i,
          })),
        })
      }

      // 10. 写入运镜规范
      if (cameraSpecs?.length) {
        await tx.aiCameraSpec.createMany({
          data: cameraSpecs.map((cs: any, i: number) => ({
            projectId: project.id,
            segmentId: cs.segmentId,
            cameraMovement: cs.cameraMovement,
            shotSize: cs.shotSize,
            angle: cs.angle,
            duration: cs.duration,
            transition: cs.transition,
            purpose: cs.purpose,
            sortOrder: i,
          })),
        })
      }

      // 11. 写入情绪规范
      if (emotionSpecs?.length) {
        await tx.aiEmotionSpec.createMany({
          data: emotionSpecs.map((es: any, i: number) => ({
            projectId: project.id,
            characterName: es.characterName,
            emotionType: es.emotionType,
            intensity: es.intensity,
            facialDesc: es.facialDesc,
            bodyLanguage: es.bodyLanguage,
            voiceTone: es.voiceTone,
            triggerEvent: es.triggerEvent,
            timing: es.timing,
            cameraPreference: es.cameraPreference,
            sortOrder: i,
          })),
        })
      }

      // 12. 如果有世界记忆初始数据，写入 worldMemory 表（后续扩展）
      if (worldMemory) {
        await tx.project.update({
          where: { id: project.id },
          data: { description: JSON.stringify({ ...JSON.parse(project.description || '{}'), worldMemory }) },
        })
      }

      return project
    })
  },

  /**
   * 全量加载项目状态
   * 优先从独立表读取（fullCreate 写入的），
   * 如果独立表为空则从 project.description JSON 中 fallback（旧版 generateSeed 写入的）
   */
  async hydrate(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })
    if (!project) return null

    // 尝试从独立表读取
    let characters: any[] = []
    let scenes: any[] = []
    let voices: any[] = []
    let segments: any[] = []
    let frames: any[] = []
    let production: any = null
    let effects: any[] = []
    let actions: any[] = []
    let cameras: any[] = []
    let emotions: any[] = []
    let propImages: any[] = []
    let storyboardImages: any[] = []
    let characterImages: any[] = []
    let sceneImages: any[] = []
    try {
      const result = await Promise.all([
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
        prisma.storyboardImage.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
        prisma.characterImage.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
        prisma.sceneImage.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      ])
      characters = result[0]; scenes = result[1]; voices = result[2]
      segments = result[3]; frames = result[4]; production = result[5]
      effects = result[6]; actions = result[7]; cameras = result[8]; emotions = result[9]
      storyboardImages = result[10]
      characterImages = result[11]
      sceneImages = result[12]
    } catch (e) {
      console.warn('[Hydrate] 独立表查询失败，回退 JSON 解析:', (e as any)?.message)
    }
    try {
      propImages = await prisma.propImage.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } })
    } catch {}

    // 如果独立表有数据，走独立表模式
    console.log('[Hydrate] 独立表:', characters.length, 'characters,', scenes.length, 'scenes,', storyboardImages.length, 'storyboardImages,', frames.length, 'frames')
    if (characters.length > 0 || scenes.length > 0) {
      // 从 storyboard_images 表读取已生成的图片 URL，按 segmentId 分组
      const storyboardMap = new Map<string, string>()
      storyboardImages.forEach(si => {
        // 优先用 segmentId 作为 key，没有则用 sortOrder
        const key = si.segmentId || si.sortOrder?.toString() || ''
        storyboardMap.set(key, si.imageUrl)
      })

      let frameDesign: any[] = []
      if (frames.length > 0) {
        frameDesign = frames.map((f, i) => ({
          segmentId: f.segmentId,
          firstFrame: { description: f.firstFrameDesc, imagePrompt: f.firstFramePrompt, cameraAngle: f.firstFrameAngle },
          lastFrame: { description: f.lastFrameDesc, imagePrompt: f.lastFramePrompt, cameraAngle: f.lastFrameAngle },
          imageUrl: storyboardMap.get(f.segmentId || (i * 2).toString()) || storyboardMap.get((i * 2).toString()) || null,
          lastFrameImageUrl: storyboardMap.get((i * 2 + 1).toString()) || null,
        }))
      } else if (storyboardImages.length > 0) {
        // 没有 aiFrameDesign 记录但有已保存的分镜图，直接构建
        storyboardImages.forEach((si, i) => {
          frameDesign.push({
            segmentId: si.segmentId,
            sortOrder: i,
            imageUrl: si.imageUrl,
            lastFrameImageUrl: null,
          })
        })
      }

      // 场景图片合并到 sceneSpecs（aiSceneSpec 表没有 imageUrl 字段）
      const sceneImageMap = new Map<string, string>()
      sceneImages.forEach(si => {
        sceneImageMap.set(si.sceneName, si.imageUrl)
      })
      const enrichedScenes = scenes.map((s) => ({
        ...s,
        imageUrl: sceneImageMap.get(s.sceneName) || null,
      }))

      // 角色图片合并到 characterSpecs
      const charImageMap = new Map<string, string>()
      characterImages.forEach(ci => {
        charImageMap.set(ci.characterName, ci.imageUrl)
      })
      const enrichedCharacters = characters.map((c) => ({
        ...c,
        imageUrl: charImageMap.get(c.characterName || `char_${c.sortOrder || 0}`) || null,
      }))

      return {
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          executionResults: project.executionResults,
        },
        designSpec: {
          characterSpecs: enrichedCharacters,
          sceneSpecs: enrichedScenes,
          voiceConfigs: voices,
          videoSegments: segments.map(s => ({ ...s, associatedScenes: JSON.parse(s.associatedScenes || '[]') })),
          frameDesign,
          videoProduction: production || null,
          effectSpecs: effects,
          actionSpecs: actions,
          cameraSpecs: cameras,
          emotionSpecs: emotions,
          propSpecs: propImages,
          characterImages,
          sceneImages,
        },
      }
    }

    // 独立表为空 → 从 project.description JSON 解析（旧版兼容）
    let designSpec: any = {}
    try {
      const parsed = JSON.parse(project.description || '{}')
      designSpec = parsed.designSpec || parsed
    } catch {
      designSpec = {}
    }

    // 分镜图：优先 JSON 中的 frameDesign，否则从 storyboard_image 表单独查
    let frameDesignFromSb: any[] = designSpec.frameDesign || []
    if (frameDesignFromSb.length === 0) {
      try {
        const sbRows: any[] = await prisma.storyboardImage.findMany({
          where: { projectId },
          orderBy: { sortOrder: 'asc' },
        })
        console.log('[Hydrate] storyboard_image 查询结果:', sbRows.length, '行, projectId:', projectId)
        if (sbRows.length > 0) {
          frameDesignFromSb = sbRows.map((si: any) => {
            console.log('[Hydrate] 行:', si.id, si.segmentId, si.imageUrl?.substring(0, 40))
            return {
              segmentId: si.segmentId,
              imageUrl: si.imageUrl,
              sortOrder: si.sortOrder || 0,
            }
          })
        }
      } catch (e) {
        console.warn('[Hydrate] storyboard_image 查询失败:', (e as any)?.message)
      }
    }

    return {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        plotBlueprint: (project as any).plotBlueprint || designSpec.plotBlueprint || null,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        executionResults: project.executionResults,
      },
      designSpec: {
        characterSpecs: designSpec.characterSpecs || [],
        sceneSpecs: designSpec.sceneSpecs || [],
        voiceConfigs: designSpec.voiceConfigs || [],
        videoSegments: designSpec.videoSegments || [],
        frameDesign: frameDesignFromSb,
        videoProduction: designSpec.videoProduction || null,
        characterImages: designSpec.characterImages || [],
        sceneImages: designSpec.sceneImages || [],
        effectSpecs: designSpec.effectSpecs || [],
        actionSpecs: designSpec.actionSpecs || [],
        cameraSpecs: designSpec.cameraSpecs || [],
        emotionSpecs: designSpec.emotionSpecs || [],
      },
    }
  },
}
