/**
 * prompt/director-ir.ts — Phase 0 导演语义解释器
 *
 * 职责（严格）: SEMANTIC INTERPRETER（唯一理解层）
 *   ✅ archetype 推断（rule-based 静态映射）
 *   ✅ emotion 推断（基于 action/context）
 *   ✅ camera intent 推断
 *   ✅ scene atmosphere 推断
 *   ✅ 每个推断来源记入 trace（可追溯）
 *   ❌ 不调 LLM
 *   ❌ 不包含 prompt 格式化
 *
 * 宪法：
 *   1. 所有推断函数是纯 deterministic（相同输入永远相同输出）
 *   2. trace 必须记录每个值的来源（固定规则名/默认值）
 *   3. 禁止调用外部 API 或 LLM
 */

import type { NormalizedShot, NormalizedSubject, NormalizedCamera } from './shot-normalizer.js'

// ─── 类型 ─────────────────────────────────────────────────────────

export interface DirectorIR {
  characters: CharacterIR[]
  action: ActionIR
  camera: CameraIR
  atmosphere: AtmosphereIR
  trace: IRTrace
}

export interface CharacterIR {
  id: string
  name: string
  archetype: string
  archetypeSource: string  // trace
  continuityKey: string
}

export interface ActionIR {
  description: string
  emotion: string
  emotionSource: string  // trace
}

export interface CameraIR {
  shotType: string
  movement: string
  lens: string
  intent: string
  intentSource: string  // trace
}

export interface AtmosphereIR {
  location: string
  lighting: string
  mood: string
  moodSource: string  // trace
}

export interface IRTrace {
  emotions: Array<{ key: string; value: string; source: string }>
  cameras: Array<{ key: string; value: string; source: string }>
  moods: Array<{ key: string; value: string; source: string }>
  archetypes: Array<{ key: string; value: string; source: string }>
}

// ─── 静态推断映射表（rule-based，纯确定性） ──────────────────

/** 基于 action 关键字的情绪映射 */
const EMOTION_MAP: Array<{ pattern: RegExp; emotion: string }> = [
  { pattern: /walk.*room|enter|step.*into|approach/i, emotion: 'curious, attentive' },
  { pattern: /run|rush|hurry|dash|sprint/i, emotion: 'urgent, panicked' },
  { pattern: /fight|punch|kick|battle|attack|defend/i, emotion: 'aggressive, determined' },
  { pattern: /cry|tear|weep|sob|mourn/i, emotion: 'sad, melancholic' },
  { pattern: /laugh|smile|grin|chuckle|joy/i, emotion: 'joyful, cheerful' },
  { pattern: /look|gaze|stare|watch|observe/i, emotion: 'focused, curious' },
  { pattern: /talk|speak|say|whisper|shout|calling/i, emotion: 'expressive, engaged' },
  { pattern: /sit|rest|wait|pause|stand/i, emotion: 'calm, patient' },
  { pattern: /flee|escape|hide|retreat|back away/i, emotion: 'fearful, desperate' },
  { pattern: /walk|move|step|pace/i, emotion: 'casual, composed' },
]

/** 基于 camera shotType 的 intent 映射 */
const CAMERA_INTENT_MAP: Array<{ pattern: RegExp; intent: string }> = [
  { pattern: /close.up|close_up|closeup/i, intent: 'emphasize emotion, isolate subject' },
  { pattern: /wide shot|wide_shot|full shot/i, intent: 'establish spatial context, show environment' },
  { pattern: /medium shot|medium_shot|mid shot/i, intent: 'balance subject and environment, natural conversation' },
  { pattern: /dolly|track|follow|crane/i, intent: 'follow motion, create dynamic spatial progression' },
  { pattern: /static|fixed|locked/i, intent: 'stable observation, meditative pacing' },
  { pattern: /handheld|shaky|camera shake/i, intent: 'intimate, urgent, documentary realism' },
  { pattern: /over.shoulder|over_shoulder/i, intent: 'perspective from specific character viewpoint' },
  { pattern: /aerial|bird|top.down|top_down/i, intent: 'omniscient perspective, dramatic scale' },
]

/** 基于环境关键词的氛围映射 */
const MOOD_MAP: Array<{ pattern: RegExp; mood: string }> = [
  { pattern: /night|dark|shadow|dim|moon/i, mood: 'mysterious, intimate' },
  { pattern: /sun|golden|sunset|sunrise|daylight/i, mood: 'warm, welcoming' },
  { pattern: /rain|storm|cloud|fog|mist|smoke/i, mood: 'melancholic, tense' },
  { pattern: /neon|city|urban|street|alley/i, mood: 'energetic, gritty' },
  { pattern: /nature|forest|garden|park|field/i, mood: 'serene, organic' },
  { pattern: /indoor|room|house|interior|hall/i, mood: 'intimate, contained' },
  { pattern: /cold|blue|winter|ice|snow/i, mood: 'cold, isolated' },
  { pattern: /warm|fire|cozy|amber/i, mood: 'comfortable, nostalgic' },
  { pattern: /epic|grand|monument|palace\/temple|castle/i, mood: 'epic, majestic' },
]

/** 基于 subject name 的原型推断（简单启发式） */
const ARCHETYPE_MAP: Array<{ pattern: RegExp; archetype: string }> = [
  { pattern: /hero|warrior|knight|soldier|protagonist|main/i, archetype: 'heroic protagonist' },
  { pattern: /villain|enemy|dark|evil|antagonist|criminal/i, archetype: 'antagonistic force' },
  { pattern: /sage|wise|teacher|mentor|old|elder|master/i, archetype: 'mentor/guide' },
  { pattern: /child|kid|young|little|boy|girl|infant/i, archetype: 'innocent/fragile' },
  { pattern: /detective|investigate|police|agent|spy/i, archetype: 'investigator' },
  { pattern: /lover|romantic|partner|wife|husband|couple/i, archetype: 'emotional anchor' },
  { pattern: /leader|king|queen|president|chief|commander/i, archetype: 'authority figure' },
]

// ─── toDirectorIR（核心入口） ──────────────────────────────────

/**
 * 将标准化 shot 转换为导演语义 IR
 *
 * 所有推断均为 rule-based（静态映射表），不调 LLM。
 * 每个值附带 source trace 可追溯。
 */
export function toDirectorIR(shot: NormalizedShot): DirectorIR {
  const trace: IRTrace = {
    emotions: [],
    cameras: [],
    moods: [],
    archetypes: [],
  }

  const characters = shot.subject.map(s => interpretCharacter(s, trace))
  const action = interpretAction(shot.action, trace)
  const camera = interpretCamera(shot.camera, trace)
  const atmosphere = interpretAtmosphere(shot.environment, trace)

  return { characters, action, camera, atmosphere, trace }
}

// ─── 内部解释器 ───────────────────────────────────────────────

function interpretCharacter(
  s: NormalizedSubject,
  trace: IRTrace
): CharacterIR {
  // archetype 推断
  let archetype = 'neutral character'
  let archetypeSource = 'default: neutral character'

  for (const entry of ARCHETYPE_MAP) {
    if (entry.pattern.test(s.name)) {
      archetype = entry.archetype
      archetypeSource = `keyword_match: name="${s.name}" → "${entry.archetype}"`
      break
    }
  }

  trace.archetypes.push({
    key: s.id,
    value: archetype,
    source: archetypeSource,
  })

  return {
    id: s.id,
    name: s.name,
    archetype,
    archetypeSource,
    continuityKey: s.id,
  }
}

function interpretAction(
  action: string,
  trace: IRTrace
): ActionIR {
  if (!action) {
    return {
      description: 'standing still',
      emotion: 'neutral',
      emotionSource: 'default: empty action',
    }
  }

  // emotion 推断
  let emotion = 'neutral, composed'
  let emotionSource = 'default: neutral, composed'

  for (const entry of EMOTION_MAP) {
    if (entry.pattern.test(action)) {
      emotion = entry.emotion
      emotionSource = `keyword_match: action="${action}" → "${entry.emotion}"`
      break
    }
  }

  trace.emotions.push({
    key: 'action',
    value: emotion,
    source: emotionSource,
  })

  return { description: action, emotion, emotionSource }
}

function interpretCamera(
  camera: NormalizedCamera | undefined,
  trace: IRTrace
): CameraIR {
  const shotType = camera?.shotType || 'medium shot'
  const movement = camera?.movement || 'static'
  const lens = camera?.lens || '50mm'

  let intent = 'standard coverage'
  let intentSource = 'default: standard coverage'

  for (const entry of CAMERA_INTENT_MAP) {
    if (entry.pattern.test(shotType) || entry.pattern.test(movement)) {
      intent = entry.intent
      intentSource = `keyword_match: shot="${shotType}" movement="${movement}" → "${entry.intent}"`
      break
    }
  }

  trace.cameras.push({
    key: 'intent',
    value: intent,
    source: intentSource,
  })

  return { shotType, movement, lens, intent, intentSource }
}

function interpretAtmosphere(
  env: NormalizedShot['environment'] | undefined,
  trace: IRTrace
): AtmosphereIR {
  const location = env?.location || 'a cinematic setting'
  const atmosphereInput = env?.atmosphere || ''
  const timeOfDay = env?.timeOfDay || ''

  // lighting 推导
  let lighting = 'cinematic lighting'
  if (/night|dark|dim/i.test(timeOfDay || location)) lighting = 'low-key lighting with deep shadows'
  else if (/sun|daylight|golden/i.test(timeOfDay || location)) lighting = 'golden hour backlighting'
  else if (/neon|urban|city/i.test(location)) lighting = 'mixed color temperature lighting'
  else if (/indoor|room|interior/i.test(location)) lighting = 'soft diffused lighting'
  else if (/fog|mist|smoke/i.test(atmosphereInput)) lighting = 'volumetric lighting with atmospheric haze'

  // mood 推断
  let mood = 'neutral atmospheric'
  let moodSource = 'default: neutral atmospheric'

  const moodKeywords = `${location} ${atmosphereInput} ${timeOfDay}`
  for (const entry of MOOD_MAP) {
    if (entry.pattern.test(moodKeywords)) {
      mood = entry.mood
      moodSource = `keyword_match: "${moodKeywords.slice(0, 40)}..." → "${entry.mood}"`
      break
    }
  }

  trace.moods.push({
    key: 'mood',
    value: mood,
    source: moodSource,
  })

  return {
    location,
    lighting,
    mood,
    moodSource,
  }
}

export default toDirectorIR
