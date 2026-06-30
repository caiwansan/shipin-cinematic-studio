/**
 * services/narrative/normalize-narrative-spec.ts — Canonical Normalize v2
 *
 * Runtime Constitution Phase 2: 将 AI 原始输出规范化为 Canonical Runtime。
 *
 * 宪法规定：
 *   1. normalize 后下游永远不接触 raw AI output
 *   2. 所有字段必须规范化为统一命名/类型/nullable
 *   3. id 全部 string 化（禁止 number）
 *   4. 禁止 raw.xxx || [] 透传（每个字段都要经过映射）
 *   5. 输出格式 = NarrativeProjectSnapshot
 */

import type {
  NarrativeProjectSnapshot,
  NarrativeCharacter,
  NarrativeScene,
  NarrativeDialogue,
  NarrativeAction,
  NarrativeVoice,
  NarrativeProp,
  NarrativeVideoSegment,
  NarrativeStoryboardBeat,
  NarrativeEmotionPoint,
} from '../../../../shared/runtime/narrative-schema'

let _narrativeSchema: any
async function getNarrativeSchema() {
  if (!_narrativeSchema) {
    _narrativeSchema = await import('../../../../shared/runtime/narrative-schema.mjs')
  }
  return _narrativeSchema
}

// ⭐ Dinamik import from shared module (CommonJS wrapper via .mjs)
//

export interface NormalizeResult {
  normalized: NarrativeProjectSnapshot
  repaired: boolean
  heuristicFallbackUsed: boolean
}

/**
 * 从剧本文本中启发式提取角色名（AI 返回空角色时的保底）
 */
export function extractCharacterNamesHeuristic(script: string): string[] {
  if (!script) return []
  const verbPattern = /([\u4e00-\u9fa5]{2,4})(?:说|道|问|答|喊|叫)/g
  const names = new Set<string>()
  let match
  while ((match = verbPattern.exec(script)) !== null) {
    names.add(match[1])
  }
  return Array.from(names)
}

/**
 * Canonical Normalize — 将任意格式的 AI 输出规范化为 NarrativeProjectSnapshot
 *
 * 兼容所有历史字段命名（character/characterName, style/voiceType 等），
 * 但输出统一为 canonical 字段名。
 *
 * @param raw AI 原始输出（可能嵌套 data 结构）
 * @param scriptText 原始剧本文本（用于启发式 fallback）
 */
export async function normalizeNarrativeSpec(raw: any, scriptText?: string): Promise<NormalizeResult> {
  const { generateNarrativeId, toNull, toNullStrict, toNullArray, safeArray } = await getNarrativeSchema()
  let repaired = false
  let heuristicFallbackUsed = false

  // 解包 fallback/AI 返回的 data 嵌套结构: { success: true, data: {...} }
  if (raw && raw.data && typeof raw.data === 'object' && !raw.characters && !raw.videoSegments) {
    raw = raw.data
    repaired = true
  }

  // ==================== Characters ====================
  const rawChars = safeArray(raw.characters)
  const characters: NarrativeCharacter[] = rawChars.map((c: any, i: number) => {
    if (!c.id && !c.name) repaired = true
    return {
      id: c.id && typeof c.id === 'string'
        ? c.id
        : generateNarrativeId('character', `${i}`),
      name: c.name || c.characterName || `角色 ${i + 1}`,
      description: toNull(c.description || c.physicalDescription || c.personality),
      personality: toNull(c.personality),
      appearance: toNull(c.clothing || c.appearance),
      gender: toNull(c.gender),
      age: toNull(c.age),
      role: toNull(c.role),
      voiceType: toNull(c.voiceType),
      imagePrompt: toNull(c.imagePrompt),
      negativePrompt: toNull(c.negativePrompt),
      clothingVariants: toNullArray(c.clothingVariants),
    }
  })

  // Heuristic fallback: 如果 AI 返回的角色太少而有对话角色没被提取，补充
  // 从 dialogues 提取所有出现过的角色名，补充到 characters
  const dialogueCharNames = new Set<string>()
  for (const d of safeArray(raw.dialogues)) {
    const name = d.characterName || d.character || d.speaker
    if (name) dialogueCharNames.add(name)
  }
  const existingCharNames = new Set(characters.map(c => c.name))
  const missingChars = [...dialogueCharNames].filter(n => !existingCharNames.has(n))
  if (missingChars.length > 0) {
    console.log(`[Normalize] ⚠️ 补充 ${missingChars.length} 个对话角色: ${missingChars.join(', ')}`)
    for (const name of missingChars) {
      characters.push({
        id: generateNarrativeId('character', `heur_${characters.length}`),
        name,
        description: `${name}（从对话中启发式提取）`,
        gender: null,
        age: null,
        role: '配角',
        personality: null,
        appearance: null,
        voiceType: null,
        imagePrompt: null,
        negativePrompt: null,
        clothingVariants: [],
      })
    }
    repaired = true
  }

  // 从 script text 中按"角色名：台词"格式补充更多角色
  // 要求最少有 2 个角色才触发（避免单角色短剧被误补充），
  // 且补充后 total ≤ 20（防止过度提取）
  if (scriptText && characters.length < 3) {
    const heurNames = extractCharacterNamesHeuristic(scriptText)
    for (const hn of heurNames) {
      if (!characters.some(c => c.name === hn) && characters.length < 20) {
        characters.push({
          id: generateNarrativeId('character', `heur_script_${characters.length}`),
          name: hn,
          description: `${hn}（从剧本动作描述中启发式提取）`,
          gender: null,
          age: null,
          role: '配角',
          personality: null,
          appearance: null,
          voiceType: null,
          imagePrompt: null,
          negativePrompt: null,
          clothingVariants: [],
        })
        repaired = true
      }
    }
  }

  // ==================== Scenes ====================
  const rawScenes = safeArray(raw.scenes)
  const scenes: NarrativeScene[] = rawScenes.map((s: any, i: number) => {
    if (!s.id && !s.name) repaired = true
    return {
      id: s.id && typeof s.id === 'string'
        ? s.id
        : generateNarrativeId('scene', `${i}`),
      name: s.name || s.sceneName || `场景 ${i + 1}`,
      description: toNull(s.description),
      type: toNull(s.type || s.sceneType),
      timeOfDay: toNull(s.timeOfDay || s.timePeriod || s.time),
      lighting: toNull(s.lighting),
      mood: toNull(s.mood || s.atmosphere),
      colorTone: toNull(s.colorTone || s.colorPalette),
      keyProps: toNullArray(s.keyProps),
      environment: toNull(s.environment || s.envDescription || s.scenery || s.envDesc),
      imagePrompt: toNull(s.imagePrompt),
      negativePrompt: toNull(s.negativePrompt),
    }
  })

  // ==================== Dialogues ====================
  const rawDialogues = safeArray(raw.dialogues)
  const dialogues: NarrativeDialogue[] = rawDialogues.map((d: any, i: number) => ({
    id: d.id && typeof d.id === 'string'
      ? d.id
      : generateNarrativeId('dialogue', `${i}`),
    sceneName: toNull(d.sceneName || d.scene),
    segmentId: toNull(d.segmentId || (typeof d.segmentId === 'string' ? d.segmentId : null)),
    characterName: d.characterName || d.character || d.speaker || '未知角色',
    dialogue: d.dialogue || d.content || '',
    tone: toNull(d.tone),
  }))

  // ⭐ 如果顶层 dialogues 的 dialogue 字段全是空的，尝试从 videoSegments[].beats[].dialogue 提取
  const hasAnyDialogueText = dialogues.some(d => d.dialogue && d.dialogue.trim().length > 0)
  if (!hasAnyDialogueText && raw.videoSegments) {
    const rawSegs = safeArray(raw.videoSegments)
    for (const seg of rawSegs) {
      const segBeats = safeArray(seg.beats)
      for (const beat of segBeats) {
        const beatDialogue = beat.dialogue || ''
        if (beatDialogue.trim()) {
          dialogues.push({
            id: generateNarrativeId('dialogue', `beat_${dialogues.length}`),
            sceneName: toNull(seg.scene || seg.name),
            segmentId: toNull(seg.segmentId || seg.id),
            characterName: beat.character || beat.speaker || '角色',
            dialogue: beatDialogue.trim(),
            tone: toNull(beat.tone),
          })
        }
      }
    }
  }

  // ==================== Actions ====================
  const rawActions = safeArray(raw.actions)
  const actions: NarrativeAction[] = rawActions.map((a: any, i: number) => ({
    id: a.id && typeof a.id === 'string'
      ? a.id
      : generateNarrativeId('action', `${i}`),
    sceneName: toNull(a.sceneName || a.scene),
    segmentId: toNull(a.segmentId || (typeof a.segmentId === 'string' ? a.segmentId : null)),
    characterName: a.characterName || a.character || '未知角色',
    action: a.action || a.description || '',
    expression: toNull(a.expression),
  }))

  // ==================== Voices ====================
  // ⭐ 兼容全部历史字段命名
  const rawVoices =
    safeArray(raw.voices)
  const voices: NarrativeVoice[] = rawVoices.map((v: any, i: number) => ({
    id: v.id && typeof v.id === 'string'
      ? v.id
      : generateNarrativeId('voice', `${i}`),
    characterName: v.characterName || v.character || v.speaker || `角色 ${i + 1}`,
    voiceType: v.voiceType || v.type || v.style || v.engine || 'cosyvoice',
    pitch: v.pitch ?? v.pitch ?? 1.0,
    speed: v.speed ?? v.speed ?? 1.0,
    tone: toNull(v.tone || v.toneDescription),
    speakingStyle: toNull(v.speakingStyle || v.style || v.description),
    description: toNull(v.description),
    ttsPrompt: toNull(v.ttsPrompt || v.prompt),
  }))

  // ==================== Props ====================
  const rawProps = safeArray(raw.props || raw.propSpecs)
  const props: NarrativeProp[] = rawProps.map((p: any, i: number) => {
    // 兼容多种相关场景/角色的格式
    const sceneIds: string[] = []
    if (p.relatedSceneIds) sceneIds.push(...p.relatedSceneIds)
    if (p.associatedScene) sceneIds.push(p.associatedScene)
    if (p.scenes && Array.isArray(p.scenes)) sceneIds.push(...p.scenes)
    if (p.sceneIds && Array.isArray(p.sceneIds)) sceneIds.push(...p.sceneIds)

    const characterNames: string[] = []
    if (p.character) characterNames.push(p.character)
    if (p.characterName) characterNames.push(p.characterName)
    if (p.characters && Array.isArray(p.characters)) characterNames.push(...p.characters)
    if (p.characterNames && Array.isArray(p.characterNames)) characterNames.push(...p.characterNames)

    return {
      id: p.id && typeof p.id === 'string'
        ? p.id
        : generateNarrativeId('prop', `${i}`),
      name: p.name || p.propName || `道具 ${i + 1}`,
      category: toNull(p.category || '通用'),
      description: toNull(p.description),
      sceneIds: toNullArray(sceneIds.length > 0 ? [...new Set(sceneIds)] : undefined),
      characterNames: toNullArray(characterNames.length > 0 ? [...new Set(characterNames)] : undefined),
      imagePrompt: toNull(p.imagePrompt),
      metadata: p.metadata ? { ...p.metadata, source: 'normalized', confidence: p.metadata?.confidence } : null,
    }
  })

  // ==================== Video Segments + Beats ====================
  const rawSegments = safeArray(raw.videoSegments)
  const videoSegments: NarrativeVideoSegment[] = rawSegments.map((seg: any, si: number) => {
    const segId = seg.id !== undefined && seg.id !== null
      ? String(seg.id)
      : seg.segmentId || generateNarrativeId('segment', `${si}`)

    // Normalize beats
    const rawBeats = safeArray(seg.beats)
    const beats: NarrativeStoryboardBeat[] = rawBeats.map((b: any, bi: number) => ({
      start: b.start ?? b.startSecond ?? 0,
      end: b.end ?? b.endSecond ?? 10,
      camera: toNull(b.camera),
      visual: toNull(b.visual),
      dialogue: toNull(b.dialogue),
      effect: toNull(b.effect),
      sound: toNull(b.sound),
      emotion: toNull(b.emotion || b.label),
      label: toNull(b.label),
    }))

    // Segment-level dialogues / actions
    const segDialogues = safeArray(seg.dialogues).map((d: any, di: number) => ({
      id: d.id && typeof d.id === 'string'
        ? d.id
        : generateNarrativeId('dialogue', `${si}_${di}`),
      sceneName: toNull(d.sceneName || d.scene),
      segmentId: segId,
      characterName: d.characterName || d.character || d.speaker || '未知角色',
      dialogue: d.dialogue || d.content || '',
      tone: toNull(d.tone),
    }))

    const segActions = safeArray(seg.actions).map((a: any, ai: number) => ({
      id: a.id && typeof a.id === 'string'
        ? a.id
        : generateNarrativeId('action', `${si}_${ai}`),
      sceneName: toNull(a.sceneName || a.scene),
      segmentId: segId,
      characterName: a.characterName || a.character || '未知角色',
      action: a.action || a.description || '',
      expression: toNull(a.expression),
    }))

    return {
      id: segId,
      title: toNull(seg.title || seg.name),
      scene: toNull(seg.scene),
      duration: toNull(seg.duration ?? null),
      beats: toNullArray(beats.length > 0 ? beats : undefined),
      characters: toNullArray(seg.characters),
      transition: toNull(seg.transition),
      dialogues: toNullArray(segDialogues.length > 0 ? segDialogues : undefined),
      actions: toNullArray(segActions.length > 0 ? segActions : undefined),
      // ⭐ 透传段落画面描述字段（供前端卡片展示）
      narrativePurpose: toNull(seg.narrativePurpose || seg.narrative || seg.description),
      fullText: toNull(seg.fullText || seg.narrative || seg.description),
      shotPattern: toNull(seg.shotPattern),
      emotionArc: toNull(seg.emotionArc || seg.emotionalTone || seg.emotion),
      imagePrompt: toNull(seg.imagePrompt),
      negativePrompt: toNull(seg.negativePrompt),
    }
  })

  // ==================== Emotion Curve ====================
  const rawEmotions = safeArray(raw.emotionCurve || raw.emotionPoints)
  const emotionPoints: NarrativeEmotionPoint[] = rawEmotions.map((e: any) => ({
    second: e.second !== undefined ? Number(e.second) : (e.timeIndex !== undefined ? Number(e.timeIndex) : 0),
    emotion: e.emotion || '平静',
    intensity: e.intensity !== undefined ? Number(e.intensity) : 0.5,
  }))

  // ==================== Production Metadata ====================
  const productionMeta = raw.productionMetadata || raw.videoProduction || null

  // ==================== 构建 Canonical Snapshot ====================
  const normalized: NarrativeProjectSnapshot = {
    version: 'v2',
    title: toNull(raw.title || raw.projectName),
    synopsis: toNull(raw.synopsis),
    characters,
    scenes,
    dialogues,
    actions,
    voices,
    props,
    effectSpecs: safeArray(raw.effectSpecs || raw.effects),
    videoSegments,
    emotionCurve: emotionPoints.length > 0
      ? { points: emotionPoints }
      : null,
    productionMetadata: productionMeta
      ? {
          overallStyle: toNull(productionMeta.overallStyle),
          fps: toNull(productionMeta.fps ?? null),
          resolution: toNull(productionMeta.resolution),
          colorPalette: toNull(productionMeta.colorPalette),
          transitionStyle: toNull(productionMeta.transitionStyle),
        }
      : null,
    rawAiResponse: null, // 禁止下游消费，仅 debug 用
  }

  return {
    normalized,
    repaired,
    heuristicFallbackUsed,
  }
}
