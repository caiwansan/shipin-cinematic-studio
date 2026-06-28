/**
 * artifact-sync.service.ts — Artifact Layer v1 同步服务
 *
 * 在 AI Agent 完成输出后，将 executionResults 中的结构化数据
 * 同步写入 DB 独立表（ai_scene_specs / ai_voice_configs 等）。
 *
 * 这是整个 Artifact Layer 的"播种点"——只在生成时触发一次。
 *
 * 设计原则：
 * - 零侵入：不修改 AI Agent 输出流程
 * - 幂等：同一 projectId 重复同步仅覆盖
 * - 可回滚：旧版 JSON 路径完整保留
 */

import { prisma } from '../utils/index.js'

export interface SyncResult {
  characters: number
  scenes: number
  voices: number
  frames: number
  segments: number
  production: boolean
}

/**
 * 将 executionResults 中的结构化数据同步写入 DB 独立表
 * 应当只在 AI 生成完成后调用一次（script-submit / script-parse routes）
 */
export async function syncArtifactsFromExecution(
  projectId: string,
  executionResults: any,
): Promise<SyncResult> {
  const result: SyncResult = { characters: 0, scenes: 0, voices: 0, frames: 0, segments: 0, production: false }

  if (!executionResults) return result

  // 尝试从多种可能的 key 路径中提取数据
  const plotBP = executionResults.plotBlueprint || executionResults

  // ==================== 1. Scene Artifact ====================
  const scenes = plotBP?.scenes || []
  if (scenes.length > 0) {
    await prisma.aiSceneSpec.deleteMany({ where: { projectId } })
    await prisma.aiSceneSpec.createMany({
      data: scenes.map((s: any, i: number) => ({
        projectId,
        sceneId: s.sceneId || `scene_${i}`,
        sceneName: s.name || `场景 ${i + 1}`,
        description: s.summary || s.description || '',
        imagePrompt: s.imagePrompt || '',
        negativePrompt: s.negativePrompt || null,
        aspectRatio: s.aspectRatio || '16:9',
        sortOrder: i,
      })),
    })
    result.scenes = scenes.length
    console.log(`[ArtifactSync] 写入 ${scenes.length} 个场景到 ai_scene_specs`)
  }

  // ==================== 1b. Character Artifact ====================
  // characters 可能在 plotBP.characters 或 executionResults 顶层 (characterSpecs)
  const characters = plotBP?.characters || executionResults?.characterSpecs || []
  if (characters.length > 0) {
    await prisma.aiCharacterSpec.deleteMany({ where: { projectId } })
    await prisma.aiCharacterSpec.createMany({
      data: characters.map((c: any, i: number) => ({
        projectId,
        characterName: c.name || c.characterName || `角色 ${i + 1}`,
        variant: c.variant || '',
        gender: c.gender || '',
        age: c.age || '青年',
        physicalDescription: c.appearance || c.physicalDescription || c.description || '',
        clothing: c.clothing || '',
        imagePrompt: c.imagePrompt || '',
        negativePrompt: c.negativePrompt || null,
        sortOrder: i,
      })),
    })
    result.characters = characters.length
    console.log(`[ArtifactSync] 写入 ${characters.length} 个角色到 ai_character_specs`)
  }

  // ==================== 2. Voice Artifact ====================
  // 可能来自多种 key：voiceConfigs / voiceSpecs / soundDesigner
  const voices = executionResults.voiceConfigs
    || executionResults.voiceSpecs
    || executionResults.soundDesigner
    || []
  if (voices.length > 0) {
    await prisma.aiVoiceConfig.deleteMany({ where: { projectId } })
    const voiceData = voices.map((v: any, i: number) => {
      // 兼容两种输入格式：{characterName, voiceType, ...} 或 {name, style, ...}
      const name = v.characterName || v.name || v.character || `角色 ${i + 1}`
      return {
        projectId,
        characterName: name,
        voiceType: v.voiceType || v.type || v.engine || 'cosyvoice',
        speakingStyle: v.speakingStyle || v.style || v.description || '默认',
        pitch: v.pitch ?? 1.0,
        speed: v.speed ?? 1.0,
        ttsPrompt: v.ttsPrompt || v.prompt || '',
        sortOrder: i,
      }
    })
    await prisma.aiVoiceConfig.createMany({ data: voiceData })
    result.voices = voiceData.length
    console.log(`[ArtifactSync] 写入 ${voiceData.length} 个音色到 ai_voice_configs`)
  }

  // ==================== 3. Frame Artifact ====================
  const frames = executionResults.frameDesign
    || executionResults.frameSpecs
    || executionResults.frameDesigner
    || []
  if (frames.length > 0) {
    await prisma.aiFrameDesign.deleteMany({ where: { projectId } })
    const frameData = frames.map((f: any, i: number) => ({
      projectId,
      segmentId: f.segmentId || f.segment_id || `seg_${i}`,
      firstFrameDesc: f.firstFrame?.description || f.firstFrameDesc || '',
      firstFramePrompt: f.firstFrame?.imagePrompt || f.firstFramePrompt || '',
      firstFrameAngle: f.firstFrame?.cameraAngle || f.firstFrameAngle || null,
      lastFrameDesc: f.lastFrame?.description || f.lastFrameDesc || '',
      lastFramePrompt: f.lastFrame?.imagePrompt || f.lastFramePrompt || '',
      lastFrameAngle: f.lastFrame?.cameraAngle || f.lastFrameAngle || null,
      sortOrder: i,
    }))
    await prisma.aiFrameDesign.createMany({ data: frameData })
    result.frames = frameData.length
    console.log(`[ArtifactSync] 写入 ${frameData.length} 个首尾帧到 ai_frame_designs`)
  }

  // ==================== 4. Video Segment Artifact ====================
  const segments = executionResults.videoSegments
    || executionResults.videoSpecs
    || executionResults.frameDesigner?.videoSegments
    || []
  if (segments.length === 0 && scenes.length > 0) {
    // 降级：从场景推断 videoSegments（前端 buildDesignSpec 已有此逻辑）
    const derived = scenes.map((s: any, i: number) => ({
      segmentId: `seg_${i}`,
      title: s.name || `段落 ${i + 1}`,
      associatedScenes: [s.name || `scene_${i}`],
      duration: 8,
      narrativePurpose: s.summary || '',
      shotPattern: 'medium_medium',
      emotionArc: s.mood?.includes('紧张') || s.mood?.includes('冲突') || s.mood?.includes('惨烈')
        ? 'tension' : s.mood?.includes('静') || s.mood?.includes('神圣')
          ? 'calm' : 'neutral',
      backgroundMusic: '',
    }))
    if (derived.length > 0) {
      await prisma.aiVideoSegment.deleteMany({ where: { projectId } })
      await prisma.aiVideoSegment.createMany({
        data: derived.map((d: any) => ({
          projectId,
          segmentId: d.segmentId,
          title: d.title,
          associatedScenes: JSON.stringify(d.associatedScenes),
          duration: d.duration,
          narrativePurpose: d.narrativePurpose,
          shotPattern: d.shotPattern,
          emotionArc: d.emotionArc,
          backgroundMusic: d.backgroundMusic,
          sortOrder: segments.length,
        })),
      })
      result.segments = derived.length
      console.log(`[ArtifactSync] 降级生成 ${derived.length} 个 video segments（从 scenes 推断）`)
    }
  } else if (segments.length > 0) {
    await prisma.aiVideoSegment.deleteMany({ where: { projectId } })
    await prisma.aiVideoSegment.createMany({
      data: segments.map((s: any, i: number) => ({
        projectId,
        segmentId: s.segmentId || `seg_${i}`,
        title: s.title || `段落 ${i + 1}`,
        associatedScenes: JSON.stringify(s.associatedScenes || [s.sceneName || `scene_${i}`]),
        duration: s.duration || 8,
        narrativePurpose: s.narrativePurpose || '',
        shotPattern: s.shotPattern || 'medium_medium',
        emotionArc: s.emotionArc || 'neutral',
        backgroundMusic: s.backgroundMusic || '',
        sortOrder: i,
      })),
    })
    result.segments = segments.length
    console.log(`[ArtifactSync] 写入 ${segments.length} 个 video segments 到 ai_video_segments`)
  }

  // ==================== 5. Video Production ====================
  const vp = executionResults.videoProduction || executionResults.videoSpecs?.videoProduction || null
  if (vp) {
    await prisma.aiVideoProduction.upsert({
      where: { projectId },
      create: {
        projectId,
        overallStyle: vp.overallStyle || null,
        fps: vp.fps || 24,
        resolution: vp.resolution || null,
        colorPalette: vp.colorPalette || null,
        transitionStyle: vp.transitionStyle || null,
      },
      update: {
        overallStyle: vp.overallStyle || null,
        fps: vp.fps || 24,
        resolution: vp.resolution || null,
        colorPalette: vp.colorPalette || null,
        transitionStyle: vp.transitionStyle || null,
      },
    })
    result.production = true
    console.log(`[ArtifactSync] video production 配置写入完成`)
  }

  return result
}



// ==================== Director Layer v3 Sync ====================

/**
 * 同步 DirectorEngine 生成的 shot graph / pacing / videoProduction
 * 写入 executionResults.videoProduction（VP 无独立表，直接用 executionResults 作为 truth）
 */
export async function syncDirectorPlan(projectId: string, directorPlan: {
  timeline: any
  shotGraph: any
  transitions: any[]
  pacingModel: any
  videoProduction: any
}) {
  // ⭐ 通过唯一写入口写入 shotGraph
  const { writeShotGraph } = await import('../engine/director/shotgraph-writer.js')
  await writeShotGraph(projectId, {
    mode: 'abstract',
    abstractShots: directorPlan.shotGraph?.abstractShots,
    transitions: directorPlan.shotGraph?.transitions,
    sceneGraph: directorPlan.shotGraph?.sceneGraph,
    pacing: directorPlan.pacingModel,
    version: 'v3',
    renderStrategy: 'director-driven',
    lineage: {
      projectId,
      directorRunId: directorPlan.shotGraph?.lineage?.directorRunId || '',
    },
  })

  console.log('[ArtifactSync] Director Plan 同步完成:', {
    shots: directorPlan.shotGraph?.abstractShots?.length || 0,
    transitions: directorPlan.transitions?.length || 0,
    totalDuration: directorPlan.pacingModel?.totalDuration || 0,
  })

  return { success: true, shots: directorPlan.shotGraph?.abstractShots?.length || 0 }
}

/**
 * 检查某个 project 的独立表是否已有数据
 */
export async function hasArtifactData(projectId: string): Promise<boolean> {
  const [scenes, voices, frames, segments] = await Promise.all([
    prisma.aiSceneSpec.count({ where: { projectId } }),
    prisma.aiVoiceConfig.count({ where: { projectId } }),
    prisma.aiFrameDesign.count({ where: { projectId } }),
    prisma.aiVideoSegment.count({ where: { projectId } }),
  ])
  return scenes > 0 || voices > 0 || frames > 0 || segments > 0
}
