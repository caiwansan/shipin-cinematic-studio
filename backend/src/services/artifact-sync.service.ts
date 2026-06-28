/**
 * artifact-sync.service.ts — Artifact Layer v2
 *
 * Runtime Constitution Phase 3: 独立表只从 canonical normalized narrative 写入。
 *
 * 宪法规定：
 *   1. 所有独立表（ai_*_specs）的唯一数据源 = normalized narrative
 *   2. 禁止从 raw executionResults 直接写表
 *   3. 禁止前端从 executionResults 回补字段
 *   4. 幂等：同一 projectId 重复同步仅覆盖
 *   5. executionResults 降级为 debug/audit 用途
 */

import { prisma } from '../utils/index.js'
import type { NarrativeProjectSnapshot } from '../../../shared/runtime/narrative-schema'

export interface SyncResult {
  characters: number
  scenes: number
  voices: number
  frames: number
  segments: number
  props: number
  production: boolean
}

/**
 * 从 canonical NarrativeProjectSnapshot 同步写入 DB 独立表
 *
 * @param projectId 项目 ID
 * @param snapshot 规范化的 narrative snapshot（从 normalize 层输出）
 */
export async function syncArtifactsFromSnapshot(
  projectId: string,
  snapshot: NarrativeProjectSnapshot,
): Promise<SyncResult> {
  const result: SyncResult = { characters: 0, scenes: 0, voices: 0, frames: 0, segments: 0, props: 0, production: false }

  if (!snapshot) return result

  // ==================== 1. Characters ====================
  // 唯一来源：snapshot.characters（normalized）
  if (snapshot.characters && snapshot.characters.length > 0) {
    await prisma.aiCharacterSpec.deleteMany({ where: { projectId } })
    await prisma.aiCharacterSpec.createMany({
      data: snapshot.characters.map((c, i) => ({
        projectId,
        characterName: c.name,
        variant: '',
        gender: c.gender || '',
        age: c.age || '青年',
        role: c.role || '',
        voiceType: c.voiceType || '',
        physicalDescription: c.description || c.appearance || '',
        clothing: c.clothingVariants?.join('；') || c.appearance || '',
        imagePrompt: c.imagePrompt || '',
        negativePrompt: c.negativePrompt || '',
        sortOrder: i,
      })),
    })
    result.characters = snapshot.characters.length
    console.log(`[ArtifactSync v2] 写入 ${snapshot.characters.length} 个角色到 ai_character_specs`)
  }

  // ==================== 2. Scenes ====================
  if (snapshot.scenes && snapshot.scenes.length > 0) {
    await prisma.aiSceneSpec.deleteMany({ where: { projectId } })
    // ⚠️ 逐条 create（防止 Prisma createMany 序列化丢失 imagePrompt 等字段）
    for (let i = 0; i < snapshot.scenes.length; i++) {
      const s = snapshot.scenes[i]
      await prisma.aiSceneSpec.create({
        data: {
          projectId,
          sceneId: s.id || `scene_${i}`,
          sceneName: s.name || `场景 ${i + 1}`,
          description: s.description || '',
          type: s.type || null,
          timeOfDay: s.timeOfDay || null,
          lighting: s.lighting || null,
          mood: s.mood || null,
          colorTone: s.colorTone || null,
          environment: s.environment || null,
          imagePrompt: s.imagePrompt || '',
          negativePrompt: s.negativePrompt || null,
          aspectRatio: '9:16',
          sortOrder: i,
        },
      })
    }
    result.scenes = snapshot.scenes.length
    console.log(`[ArtifactSync v2] 写入 ${snapshot.scenes.length} 个场景到 ai_scene_specs`)
  }

  // ==================== 3. Voices ====================
  // 唯一来源：snapshot.voices（normalized）
  if (snapshot.voices && snapshot.voices.length > 0) {
    await prisma.aiVoiceConfig.deleteMany({ where: { projectId } })
    await prisma.aiVoiceConfig.createMany({
      data: snapshot.voices.map((v, i) => ({
        projectId,
        characterName: v.characterName,
        voiceType: v.voiceType,
        speakingStyle: v.speakingStyle || v.tone || '默认',
        pitch: v.pitch ?? 1.0,
        speed: v.speed ?? 1.0,
        ttsPrompt: v.ttsPrompt || '',
        sortOrder: i,
      })),
    })
    result.voices = snapshot.voices.length
    console.log(`[ArtifactSync v2] 写入 ${snapshot.voices.length} 个音色到 ai_voice_configs`)
  }

  // ==================== 4. Frames (from videoSegments) ====================
  if (snapshot.videoSegments && snapshot.videoSegments.length > 0) {
    // frame design 数据需要从视频分段的首尾 beat 推断
    // 当前暂不写入 frames（保留原逻辑）
  }

  // ==================== 5. Video Segments ====================
  if (snapshot.videoSegments && snapshot.videoSegments.length > 0) {
    await prisma.aiVideoSegment.deleteMany({ where: { projectId } })
    // ⚠️ 逐条 create（防止 Prisma createMany 序列化丢失 fullText 等）
    for (let i = 0; i < snapshot.videoSegments.length; i++) {
      const s = snapshot.videoSegments[i]
      await prisma.aiVideoSegment.create({
        data: {
          projectId,
          segmentId: s.id,
          title: s.title || `段落 ${i + 1}`,
          associatedScenes: JSON.stringify(s.scene ? [s.scene] : []),
          duration: s.duration || 8,
          narrativePurpose: s.beats?.[0]?.visual || s.narrativePurpose || s.fullText || s.narrative || '',
          narrative: s.narrative || '',
          fullText: s.fullText || s.narrative || '',
          shotPattern: s.beats?.[0]?.camera || 'medium_medium',
          emotionArc: s.beats?.[0]?.emotion || 'neutral',
          backgroundMusic: '',
          sortOrder: i,
        },
      })
    }
    result.segments = snapshot.videoSegments.length
    console.log(`[ArtifactSync v2] 写入 ${snapshot.videoSegments.length} 个 video segments 到 ai_video_segments`)
  }

  // ==================== 6. Props ====================
  // ⭐ 新增独立表写入（前提：aiPropSpecs 表已创建）
  if (snapshot.props && snapshot.props.length > 0) {
    try {
      // aiPropSpecs 表可能未创建，try-catch 不做阻塞
      // 需先通过 Prisma migration 或 raw SQL 创建 ai_prop_specs 表
      const propData = snapshot.props.map((p, i) => ({
        projectId,
        name: p.name,
        category: p.category || '通用',
        description: p.description || '',
        sceneIds: p.sceneIds ? JSON.stringify(p.sceneIds) : null,
        characterNames: p.characterNames ? JSON.stringify(p.characterNames) : null,
        imagePrompt: p.imagePrompt || '',
        sortOrder: i,
      }))
      // Runtime Constitution v1: ai_prop_specs 表已创建
      await prisma.$executeRawUnsafe(`DELETE FROM ai_prop_specs WHERE project_id = $1`, projectId)
      await Promise.all(propData.map((pd) =>
        prisma.$executeRawUnsafe(
          `INSERT INTO ai_prop_specs (project_id, name, category, description, scene_ids, character_names, image_prompt, sort_order) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
          projectId, pd.name, pd.category, pd.description, pd.sceneIds, pd.characterNames, pd.imagePrompt, pd.sortOrder
        )
      ))
      result.props = snapshot.props.length
      console.log(`[ArtifactSync v2] 写入 ${snapshot.props.length} 个道具到 ai_prop_specs`)
    } catch (e: any) {
      console.warn(`[ArtifactSync v2] Prop 表写入失败（不影响主流程）: ${e.message}`)
    }
  }

  // ==================== 7b. Effects（特效画面） ====================
  if (snapshot.effectSpecs && snapshot.effectSpecs.length > 0) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM ai_effect_specs WHERE "projectId" = $1::uuid`, projectId)
      await Promise.all((snapshot.effectSpecs as any[]).map((e, i) =>
        prisma.$executeRawUnsafe(
          `INSERT INTO ai_effect_specs (id, "projectId", "effectName", "effectType", "triggerScene", "triggerEvent", "visualDescription", "colorPalette", "duration", "intensity", "notes", "sortOrder", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
          projectId,
          e.effectName || `特效${i + 1}`,
          e.effectType || null,
          e.triggerScene || null,
          e.triggerEvent || null,
          e.visualDescription || null,
          e.colorPalette || null,
          e.duration ?? null,
          e.intensity || null,
          e.notes || null,
          i
        )
      ))
      result.props = (result.props || 0) + snapshot.effectSpecs.length
      console.log(`[ArtifactSync v2] 写入 ${snapshot.effectSpecs.length} 个特效到 ai_effect_specs`)
    } catch (e: any) {
      console.warn(`[ArtifactSync v2] Effect 表写入失败（不影响主流程）: ${e.message}`)
    }
  }

  // ==================== 7c. Props fallback（从 executionResults 取） ====================

  // ==================== 7. Video Production ====================
  if (snapshot.productionMetadata) {
    const vp = snapshot.productionMetadata
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
    console.log(`[ArtifactSync v2] video production 配置写入完成`)
  }

  return result
}

/**
 * 兼容旧版 API：从 executionResults 提取 snapshot 后同步
 * 最终应当全部迁移到 syncArtifactsFromSnapshot
 */
export async function syncArtifactsFromExecution(
  projectId: string,
  executionResults: any,
): Promise<SyncResult> {
  if (!executionResults) return { characters: 0, scenes: 0, voices: 0, frames: 0, segments: 0, props: 0, production: false }

  // 尝试从 executionResults 中提取 canonical snapshot
  // 优先路径：analyzeV2Data.normalized
  const snapshot: NarrativeProjectSnapshot | null = executionResults.analyzeV2Data?.normalized || null

  if (snapshot) {
    return syncArtifactsFromSnapshot(projectId, snapshot)
  }

  // 降级路径：从老格式 executionResults 中提取（兼容旧数据）
  // 仅用于已存在的数据，新数据走 canonical path
  console.warn(`[ArtifactSync] ⚠️ 降级路径：executionResults 无analyzeV2Data，尝试从 raw 字段提取`)
  return downgradeSync(projectId, executionResults)
}

/**
 * 降级同步 — 从旧的 executionResults 格式提取数据
 * 新数据不应走此路径
 */
async function downgradeSync(projectId: string, er: any): Promise<SyncResult> {
  const result: SyncResult = { characters: 0, scenes: 0, voices: 0, frames: 0, segments: 0, props: 0, production: false }

  const plotBP = er.plotBlueprint || er
  const v2Norm = er.analyzeV2Data?.normalized

  // Characters — prefer rich data (characterSpecs has description/appearance) over plotBlueprint (name only)
  const charSource = v2Norm?.characters?.length ? v2Norm.characters : (er.characterSpecs?.length ? er.characterSpecs : (plotBP?.characters || []))
  if (charSource.length > 0) {
    await prisma.aiCharacterSpec.deleteMany({ where: { projectId } })
    await prisma.aiCharacterSpec.createMany({
      data: charSource.map((c: any, i: number) => ({
        projectId,
        characterName: c.name || c.characterName || `角色 ${i + 1}`,
        variant: '',
        gender: c.gender || '',
        age: c.age || '青年',
        role: c.role || '',
        voiceType: c.voiceType || '',
        physicalDescription: c.description || c.physicalDescription || c.appearance || '',
        clothing: c.clothing || '',
        imagePrompt: c.imagePrompt || '',
        negativePrompt: c.negativePrompt || null,
        sortOrder: i,
      })),
    })
    result.characters = charSource.length
  }

  // Scenes — 优先从 er.sceneSpecs 读，再 fallback 到 plotBlueprint
  const sceneSource = er.sceneSpecs?.length
    ? er.sceneSpecs
    : (v2Norm?.scenes?.length ? v2Norm.scenes : (plotBP?.scenes || []))
  if (sceneSource.length > 0) {
    console.log(`[ArtifactSync downgrade] 场景写入: ${sceneSource.length}个, 首个 imagePrompt len=${(sceneSource[0]?.imagePrompt||'').length}`)
    // ⚠️ 用 upsert on sceneId 替代 deleteMany+create（防止偶发性写入丢失）
    for (let i = 0; i < sceneSource.length; i++) {
      const s = sceneSource[i]
      const imgPromptRaw = s.imagePrompt
      console.log(`[ArtifactSync DEBUG] scene ${i} name=${s.sceneName||s.name} imagePrompt type=${typeof imgPromptRaw} len=${typeof imgPromptRaw === 'string' ? imgPromptRaw.length : (imgPromptRaw ? 'obj' : 'null/undef')}`)
      const imgPromptFinal = typeof imgPromptRaw === 'string' && imgPromptRaw.length > 0 ? imgPromptRaw : null
      if (typeof imgPromptRaw === 'object') {
        console.log(`[ArtifactSync DEBUG] imagePrompt is object! keys=${Object.keys(imgPromptRaw||{}).join(',')} value=${JSON.stringify(imgPromptRaw).substring(0,100)}`)
      }
      const sceneId = s.sceneId || `scene_${i}`
      const existing = await prisma.aiSceneSpec.findFirst({ where: { projectId, sceneId } })
      if (existing) {
        await prisma.aiSceneSpec.update({
          where: { id: existing.id },
          data: {
            sceneName: s.name || s.sceneName || `场景 ${i + 1}`,
            description: s.summary || s.description || existing.description || '',
            type: s.type || s.sceneType || existing.type || null,
            timeOfDay: s.timeOfDay || s.time || existing.timeOfDay || null,
            lighting: s.lighting || existing.lighting || null,
            mood: s.mood || s.atmosphere || existing.mood || null,
            colorTone: s.colorTone || s.colorPalette || existing.colorTone || null,
            environment: s.environment || s.envDescription || s.envDesc || s.scenery || existing.environment || null,
            imagePrompt: imgPromptFinal ?? existing.imagePrompt,
            negativePrompt: s.negativePrompt || existing.negativePrompt || null,
            sortOrder: i,
          },
        })
      } else {
        await prisma.aiSceneSpec.create({
          data: {
            projectId,
            sceneId,
            sceneName: s.name || s.sceneName || `场景 ${i + 1}`,
            description: s.summary || s.description || '',
            type: s.type || s.sceneType || null,
            timeOfDay: s.timeOfDay || s.time || null,
            lighting: s.lighting || null,
            mood: s.mood || s.atmosphere || null,
            colorTone: s.colorTone || s.colorPalette || null,
            environment: s.environment || s.envDescription || s.envDesc || s.scenery || null,
            imagePrompt: imgPromptFinal || '',
            negativePrompt: s.negativePrompt || null,
            aspectRatio: '9:16',
            sortOrder: i,
          },
        })
      }
    }
    result.scenes = sceneSource.length
  }

  // Voices — 优先从 er.voiceConfigs 读
  const voiceSource = er.voiceConfigs?.length ? er.voiceConfigs : (er.voiceSpecs || er.soundDesigner || [])
  if (voiceSource.length > 0) {
    await prisma.aiVoiceConfig.deleteMany({ where: { projectId } })
    await prisma.aiVoiceConfig.createMany({
      data: voiceSource.map((v: any, i: number) => ({
        projectId,
        characterName: v.characterName || v.name || v.character || `角色 ${i + 1}`,
        voiceType: v.voiceType || v.type || v.engine || 'cosyvoice',
        speakingStyle: v.speakingStyle || v.style || v.description || '默认',
        pitch: v.pitch ?? 1.0,
        speed: v.speed ?? 1.0,
        ttsPrompt: v.ttsPrompt || v.prompt || '',
        sortOrder: i,
      })),
    })
    result.voices = voiceSource.length
  }

  // Video Segments — 优先从 er.videoSegments 读
  const segmentSource = er.videoSegments?.length ? er.videoSegments : (er.videoSpecs || er.frameDesigner?.videoSegments || v2Norm?.videoSegments || [])
  if (segmentSource.length > 0) {
    await prisma.aiVideoSegment.deleteMany({ where: { projectId } })
    // ⚠️ 逐条 create（防止 Prisma createMany 序列化丢失字段如 fullText）
    for (let i = 0; i < segmentSource.length; i++) {
      const s = segmentSource[i]
      const ftRaw = s.fullText
      console.log(`[ArtifactSync DEBUG] seg ${i} id=${s.segmentId} fullText type=${typeof ftRaw} len=${typeof ftRaw === 'string' ? ftRaw.length : (ftRaw ? 'obj' : 'null/undef')}`)
      const ftFinal = typeof ftRaw === 'string' && ftRaw.length > 0 ? ftRaw : null
      const segmentId = s.segmentId || `seg_${i}`
      const existing = await prisma.aiVideoSegment.findFirst({ where: { projectId, segmentId } })
      if (existing) {
        await prisma.aiVideoSegment.update({
          where: { id: existing.id },
          data: {
            title: s.title || `段落 ${i + 1}`,
            associatedScenes: JSON.stringify(s.associatedScenes || [s.sceneName || `scene_${i}`]),
            duration: s.duration || 8,
            narrativePurpose: s.narrativePurpose || '',
            narrative: ftFinal ?? existing.narrative ?? '',
            fullText: ftFinal ?? existing.fullText,
            shotPattern: s.shotPattern || 'medium_medium',
            emotionArc: s.emotionArc || 'neutral',
            backgroundMusic: s.backgroundMusic || '',
            sortOrder: i,
          },
        })
      } else {
        await prisma.aiVideoSegment.create({
          data: {
            projectId,
            segmentId,
            title: s.title || `段落 ${i + 1}`,
            associatedScenes: JSON.stringify(s.associatedScenes || [s.sceneName || `scene_${i}`]),
            duration: s.duration || 8,
            narrativePurpose: s.narrativePurpose || '',
            fullText: ftFinal,
            shotPattern: s.shotPattern || 'medium_medium',
            emotionArc: s.emotionArc || 'neutral',
            backgroundMusic: s.backgroundMusic || '',
            sortOrder: i,
          },
        })
      }
    }
    result.segments = segmentSource.length
  }

  // Production
  const vp = er.videoProduction || er.videoSpecs?.videoProduction || null
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
      update: { overallStyle: vp.overallStyle || null, fps: vp.fps || 24, resolution: vp.resolution || null, colorPalette: vp.colorPalette || null, transitionStyle: vp.transitionStyle || null },
    })
    result.production = true
  }

  // Props — 从 er.propSpecs 或 er.props 读
  const propSource = er.propSpecs?.length ? er.propSpecs : (er.props || [])
  if (propSource.length > 0) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM ai_prop_specs WHERE project_id = $1::uuid`, projectId)
      await Promise.all(propSource.map((p: any, i: number) =>
        prisma.$executeRawUnsafe(
          `INSERT INTO ai_prop_specs (id, project_id, name, category, description, image_prompt, sort_order, created_at, updated_at)
           VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5, $6, NOW(), NOW())`,
          projectId,
          p.name || `道具${i + 1}`,
          p.category || null,
          p.description || null,
          typeof p.imagePrompt === 'string' ? p.imagePrompt : (p.imagePrompt ? JSON.stringify(p.imagePrompt) : null),
          i
        )
      ))
      result.props = propSource.length
      console.log(`[ArtifactSync downgrade] 写入 ${propSource.length} 个道具到 ai_prop_specs`)
    } catch (e: any) {
      console.warn(`[ArtifactSync downgrade] 道具写入失败: ${e.message}`)
    }
  }

  // Effects — 从 er.effectSpecs 读
  const effectSource = er.effectSpecs?.length ? er.effectSpecs : []
  if (effectSource.length > 0) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM ai_effect_specs WHERE "projectId" = $1::uuid`, projectId)
      await Promise.all(effectSource.map((e: any, i: number) =>
        prisma.$executeRawUnsafe(
          `INSERT INTO ai_effect_specs (id, "projectId", "effectName", "effectType", "triggerScene", "triggerEvent", "visualDescription", "colorPalette", "duration", "intensity", "notes", "sortOrder", "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
          projectId,
          String(e.effectName || `特效${i + 1}`),
          e.effectType || null,
          e.triggerScene || null,
          e.triggerEvent || null,
          e.visualDescription || null,
          e.colorPalette || null,
          e.duration ?? null,
          e.intensity || null,
          e.notes || null,
          i
        )
      ))
      console.log(`[ArtifactSync downgrade] 写入 ${effectSource.length} 个特效到 ai_effect_specs`)
    } catch (e: any) {
      console.warn(`[ArtifactSync downgrade] 特效写入失败: ${e.message}`)
    }
  }

  return result
}

// ==================== Director Layer v3 Sync ====================

export async function syncDirectorPlan(projectId: string, directorPlan: any) {
  const { writeShotGraph } = await import('../engine/director/shotgraph-writer.js')
  await writeShotGraph(projectId, {
    mode: 'abstract',
    abstractShots: directorPlan.shotGraph?.abstractShots,
    transitions: directorPlan.shotGraph?.transitions,
    sceneGraph: directorPlan.shotGraph?.sceneGraph,
    pacing: directorPlan.pacingModel,
    version: 'v3',
    renderStrategy: 'director-driven',
    lineage: { projectId, directorRunId: directorPlan.shotGraph?.lineage?.directorRunId || '' },
  })
  console.log('[ArtifactSync] Director Plan 同步完成:', {
    shots: directorPlan.shotGraph?.abstractShots?.length || 0,
    transitions: directorPlan.transitions?.length || 0,
    totalDuration: directorPlan.pacingModel?.totalDuration || 0,
  })
  return { success: true, shots: directorPlan.shotGraph?.abstractShots?.length || 0 }
}

export async function hasArtifactData(projectId: string): Promise<boolean> {
  const [scenes, voices, frames, segments] = await Promise.all([
    prisma.aiSceneSpec.count({ where: { projectId } }),
    prisma.aiVoiceConfig.count({ where: { projectId } }),
    prisma.aiFrameDesign.count({ where: { projectId } }),
    prisma.aiVideoSegment.count({ where: { projectId } }),
  ])
  return scenes > 0 || voices > 0 || frames > 0 || segments > 0
}
