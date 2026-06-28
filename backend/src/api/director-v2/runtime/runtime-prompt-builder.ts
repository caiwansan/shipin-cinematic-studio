/**
 * RuntimePromptBuilder — Agent Prompt Compiler
 *
 * FACTS COME FROM RUNTIME.
 * Generators may enhance facts.
 * Generators must never reinterpret facts.
 *
 * Every Agent prompt in this system must go through buildRuntimePrompt().
 * The legacy `storyText` input is demoted to Fallback Only — if Runtime is
 * available, it is always preferred.
 *
 * Usage:
 *   const prompt = buildRuntimePrompt(runtime, 'scene')
 *   await callAgentLLM(systemPrompt, prompt, ...)    // no more storyText
 *
 * Runtime Field Reference:
 *   Scene:    visualDescription, environment, lighting, mood, weather, timeOfDay, colorTone
 *   Char:     name, physicalDescription, clothing, voiceProfileId
 *   Story:    dialogue, action, emotion, shotType (camera)
 *   Voice:    voiceId, voiceName, pitch, speed
 */

export interface RuntimeContext {
  story?: string                          // Fallback only — raw script text
  scenes?: SceneContext[]
  characters?: CharacterContext[]
  segments?: SegmentContext[]
  voices?: VoiceContext[]
  assets?: AssetContext[]
}

export interface SceneContext {
  id: string
  name: string
  visualDescription: string               // SSOT: primary visual source
  environment?: string
  lighting?: string
  mood?: string
  weather?: string
  timeOfDay?: string
  colorTone?: string
  cameraAngle?: string
  imageUrl?: string
  referenceImageUrl?: string
}

export interface CharacterContext {
  id: string
  name: string
  physicalDescription?: string
  clothing?: string
  voiceProfileId?: string                 // SSOT: voice reference
  voiceType?: string
  imageUrl?: string
  referenceImageUrl?: string
}

export interface SegmentContext {
  id: string
  title?: string
  sceneId?: string
  characters?: string[]                   // character IDs
  fullText?: string
  narrativePurpose?: string
  dialogue?: string
  action?: string
  emotion?: string
  shotPattern?: string                    // CameraRuntime
  duration?: number
}

export interface VoiceContext {
  characterId: string
  voiceProfileId: string
  voiceName: string
  pitch: number
  speed: number
}

export interface AssetContext {
  id: string
  type: 'character' | 'scene' | 'storyboard' | 'prop'
  url: string
  name?: string
}

export type AgentType = 'scene' | 'storyboard' | 'voice' | 'props' | 'character' | 'supervisor' | 'makeup' | 'frame'

interface BuildOptions {
  enhance?: string       // AI enhancement instruction (appended, never replaces)
  maxLength?: number     // Max prompt character length
  trace?: boolean        // Output Runtime Consumption Audit
}

// ─── Prompt Compiler ──────────────────────────────────────────

const AGENT_RULES: Record<AgentType, {
  require: string[]      // Fields that MUST be consumed
  enhance: string        // Default enhancement instructions
  consume: string[]      // Fields needed from Runtime
  fallbackOk: boolean    // Allow storyText fallback?
}> = {
  scene: {
    require: ['visualDescription'],
    enhance: '请以场景图概念设计为目标，优化场景视觉提示词。输出纯视觉场景图描述，不包含人物、角色。重点描述场景的环境、光线、构图、色调、氛围。你可以增强细节，但不能改变场景的核心视觉设定。',
    consume: ['visualDescription', 'environment', 'lighting', 'mood', 'weather', 'timeOfDay', 'colorTone'],
    fallbackOk: false,
  },
  storyboard: {
    require: ['visualDescription', 'characterDescription', 'dialogue'],
    enhance: '请以分镜图提示词工程师身份优化提示词。保留原始画面描述中的人物、场景、运镜设定，增强光影细节和构图表现。输出包含正向和负向提示词。',
    consume: ['visualDescription', 'characterDescription', 'shotPattern', 'action', 'dialogue', 'emotion'],
    fallbackOk: false,
  },
  voice: {
    require: ['voiceProfileId'],
    enhance: '',
    consume: ['voiceProfileId', 'voiceName', 'pitch', 'speed'],
    fallbackOk: false,          // No voiceProfileId → error, never guess
  },
  props: {
    require: [],
    enhance: '',
    consume: ['story'],
    fallbackOk: true,
  },
  character: {
    require: [],
    enhance: '',
    consume: ['story'],
    fallbackOk: true,
  },
  supervisor: {
    require: [],
    enhance: '',
    consume: ['story'],
    fallbackOk: true,
  },
  makeup: {
    require: [],
    enhance: '',
    consume: ['characterDescription'],
    fallbackOk: true,
  },
  frame: {
    require: [],
    enhance: '',
    consume: ['visualDescription', 'characterDescription'],
    fallbackOk: true,
  },
}

// ─── Build Runtime Prompt ─────────────────────────────────────

export function buildRuntimePrompt(
  runtime: RuntimeContext | null | undefined,
  agentType: AgentType,
  options: BuildOptions = {},
): string {
  const rule = AGENT_RULES[agentType]
  const parts: string[] = ['# Runtime Context']
  const audit: string[] = []
  const missing: string[] = []

  // Helper: add field if present, audit consumption
  function addField(label: string, value: string | undefined | null, fieldName: string) {
    if (value && value.trim()) {
      parts.push(`\n## ${label}\n${value.trim()}`)
      audit.push(`  ${fieldName}: ✓ consumed`)
    } else {
      missing.push(fieldName)
      audit.push(`  ${fieldName}: ✗ missing`)
    }
  }

  // ── Scene Runtime ─────────────────────────────────────────
  if (rule.consume.includes('visualDescription') && runtime?.scenes?.length) {
    if (options.enhance) {
      // ⭐ 场景 AI 优化模式：遍历每个场景，全部传给 LLM
      for (let i = 0; i < runtime.scenes.length; i++) {
        const sc = runtime.scenes[i]
        parts.push(`\n## 场景${i + 1}: ${sc.name || '未命名'}`)
        addField('场景描述', sc.visualDescription, `SceneRuntime[${i}].visualDescription`)
        addField('环境', sc.environment, `SceneRuntime[${i}].environment`)
        addField('光影', sc.lighting, `SceneRuntime[${i}].lighting`)
        addField('情绪基调', sc.mood, `SceneRuntime[${i}].mood`)
        addField('天气', sc.weather, `SceneRuntime[${i}].weather`)
        addField('时间', sc.timeOfDay, `SceneRuntime[${i}].timeOfDay`)
        addField('色调', sc.colorTone, `SceneRuntime[${i}].colorTone`)
      }
    } else {
      // ⭐ 非优化模式（剧本拆解等）：只需上下文概览，取第一个场景
      const scene = runtime.scenes[0]
      addField('场景描述', scene.visualDescription, 'SceneRuntime.visualDescription')
      addField('环境', scene.environment, 'SceneRuntime.environment')
      addField('光影', scene.lighting, 'SceneRuntime.lighting')
      addField('情绪基调', scene.mood, 'SceneRuntime.mood')
      addField('天气', scene.weather, 'SceneRuntime.weather')
      addField('时间', scene.timeOfDay, 'SceneRuntime.timeOfDay')
      addField('色调', scene.colorTone, 'SceneRuntime.colorTone')
    }
  }

  // ── Character Runtime ──────────────────────────────────────
  if (rule.consume.includes('characterDescription') && runtime?.characters?.length) {
    for (let i = 0; i < runtime.characters.length; i++) {
      const ch = runtime.characters[i]
      addField(`角色${i + 1}: ${ch.name || '未命名'}`, ch.physicalDescription, `CharacterRuntime[${i}].physicalDescription`)
      addField(`角色${i + 1} 服装`, ch.clothing, `CharacterRuntime[${i}].clothing`)
      if (ch.voiceProfileId) {
        addField(`角色${i + 1} 音色ID`, ch.voiceProfileId, `CharacterRuntime[${i}].voiceProfileId`)
      }
    }
  }

  // ── Segment / Storyboard Runtime ───────────────────────────
  if (rule.consume.includes('shotPattern') && runtime?.segments?.length) {
    const seg = runtime.segments[0]
    addField('段落标题', seg.title, 'SegmentRuntime.title')
    addField('镜头类型', seg.shotPattern, 'CameraRuntime.shotPattern')
    addField('画面描述', seg.fullText || seg.narrativePurpose, 'SegmentRuntime.fullText')
    addField('动作', seg.action, 'ActionRuntime')
    addField('对白', seg.dialogue, 'DialogueRuntime')
    addField('情绪基调', seg.emotion, 'EmotionRuntime')
    addField('镜头时长', seg.duration ? `${seg.duration}秒` : undefined, 'SegmentRuntime.duration')
  }

  // ── Voice Runtime ──────────────────────────────────────────
  if (rule.consume.includes('voiceProfileId') && runtime?.voices?.length) {
    for (const v of runtime.voices) {
      addField(`角色音色 ${v.characterId}`, [
        `音色ID: ${v.voiceProfileId}`,
        v.voiceName ? `音色名: ${v.voiceName}` : '',
        `音高: ${v.pitch}`,
        `语速: ${v.speed}`,
      ].filter(Boolean).join(' | '), 'VoiceRuntime.voiceProfileId')
    }
  }

  // ── Story Text (Fallback Only) ─────────────────────────────
  if (rule.fallbackOk && parts.length <= 1 && runtime?.story?.trim()) {
    parts.push(`\n## 原始剧本 (Fallback)\n${runtime.story.trim()}`)
    audit.push('  StoryText: ⚠️ FALLBACK (no Runtime data available)')
  }

  // ── Enhancement (appended, never replaces) ─────────────────
  if (options.enhance || rule.enhance) {
    parts.push(`\n## AI Enhancement\n${options.enhance || rule.enhance}`)
  }

  // ── Missing required fields → throw instead of guessing ────
  for (const field of rule.require) {
    if (missing.includes(field)) {
      const msg = `[RuntimePromptBuilder] ${agentType}: REQUIRED field "${field}" missing. Facts come from Runtime. Cannot guess.`
      if (options.trace) console.error(msg)
      throw new Error(msg)
    }
  }

  const prompt = parts.join('\n')

  // ── Trace output ───────────────────────────────────────────
  if (options.trace) {
    console.log('\n========== Runtime Consumption ==========')
    console.log(`Agent: ${agentType}`)
    console.log(audit.join('\n'))
    console.log(`Prompt Length: ${prompt.length}`)
    console.log(`Legacy StoryText: ${rule.fallbackOk && !runtime?.scenes?.length ? 'YES' : 'NO'}`)
    console.log('========================================\n')
  }

  return prompt
}

// ─── Build full RuntimeContext from AigcSpecOutput ────────────

export function buildRuntimeContext(params: {
  scriptText?: string
  sceneDescription?: string
  sceneDescriptions?: { sceneName: string; description: string }[]
  characterSpecs?: any[]
  sceneSpecs?: any[]
  videoSegments?: any[]
  voiceConfigs?: any[]
}): RuntimeContext {
  const ctx: RuntimeContext = {}

  if (params.scriptText) ctx.story = params.scriptText

  if (params.sceneSpecs?.length) {
    ctx.scenes = params.sceneSpecs.map((s: any, idx: number) => {
      // ⭐ 优先从 sceneDescriptions 数组按匹配场景名取描述
      let matchedDesc = ''
      if (params.sceneDescriptions?.length) {
        const matched = params.sceneDescriptions.find(d =>
          d.sceneName === s.name || s.name?.includes(d.sceneName) || d.sceneName?.includes(s.name)
        )
        if (matched?.description) matchedDesc = matched.description
      }
      // ⭐ fallback: 单值 sceneDescription（兼容旧版）
      if (!matchedDesc) matchedDesc = params.sceneDescription || ''
      return {
        id: s.id || '',
        name: s.name || '',
        // ⭐ P0: visualDescription 优先取匹配到的场景描述，否则从六维字段自动派生
        visualDescription: matchedDesc || s.description || s.visualDescription ||
          [s.environment, s.lighting, s.weather, s.timeOfDay, s.colorPalette || s.colorTone, s.mood]
            .filter(Boolean).join('，') || '',
        environment: s.environment || '',
        lighting: s.lighting || '',
        mood: s.mood || '',
        weather: s.weather || '',
        timeOfDay: s.timeOfDay || '',
        colorTone: s.colorTone || s.colorPalette || '',
        cameraAngle: s.cameraAngle || '',
        imageUrl: s.imageUrl || '',
      }
    })
    // ⭐ P2: Runtime Integrity Check — 六维字段完整性校验
    for (const scene of ctx.scenes) {
      const dimFields = ['environment', 'lighting', 'weather', 'timeOfDay', 'colorTone', 'mood']
      const missing = dimFields.filter(f => !(scene as any)[f])
      if (missing.length > 2) {
        console.warn(`[RuntimeIntegrity] ⚠️ Scene "${scene.name}" runtime incomplete: missing [${missing.join(', ')}]. visualDescription length=${scene.visualDescription.length}`)
      }
    }
  }

  if (params.characterSpecs?.length) {
    ctx.characters = params.characterSpecs.map((c: any) => ({
      id: c.id || '',
      name: c.name || '',
      physicalDescription: c.physicalDescription || c.description || '',
      clothing: c.clothing || '',
      voiceProfileId: c.voiceProfileId || '',
      voiceType: c.voiceType || '',
      imageUrl: c.imageUrl || '',
    }))
  }

  if (params.videoSegments?.length) {
    ctx.segments = params.videoSegments.map((s: any) => ({
      id: s.id || s.segmentId || '',
      title: s.title || '',
      sceneId: s.sceneId || '',
      characters: s.characters || s.characterNames || [],
      fullText: s.visualDesc || s.fullText || s.narrativePurpose || '',
      narrativePurpose: s.narrativePurpose || '',
      dialogue: s.dialogue || '',
      action: s.action || '',
      emotion: s.emotion || '',
      shotPattern: s.shotPattern || s.shotType || s.camera || '',
      duration: s.duration || 8,
    }))
  }

  if (params.voiceConfigs?.length) {
    ctx.voices = params.voiceConfigs.map((v: any) => ({
      characterId: v.characterId || v.characterName || '',
      voiceProfileId: v.voiceProfileId || '',
      voiceName: v.voiceName || '',
      pitch: v.pitch || 1.0,
      speed: v.speed || 1.0,
    }))
  }

  return ctx
}
