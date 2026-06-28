/**
 * 剧本拆解总导演 Agent — Narrative Constitution V3
 *
 * ═══════════════════════════════════════════════════════════════
 * 陛下钦定（2026-06-24 12:30）：
 *
 * V3 升级核心：
 *   1. Segment 内联 Camera（替代独立 cameraLanguage[]）
 *   2. Segment 内联 Environment（替代纯文本环境描述）
 *   3. Segment 内联 CharacterPresence（角色+情绪+权重）
 *   4. Segment 内联 Emotion（替代独立 emotionCurve[]）
 *   5. 删除 cameraLanguage[]
 *   6. 删除 emotionCurve[]
 *   7. visualDesc 降级为派生字段
 *   8. 禁止 Index-Based 关联，全部 Reference-Based
 * ═══════════════════════════════════════════════════════════════
 *
 * @phase4-owner
 * @v3-migration 2026-06-24
 */

import { narrativeGateway } from '../runtime/narrative-gateway.js'
import type { NarrativeConstitutionV3 } from './narrative-schema-v3.js'

// ============================================================
// Schema Validation Error
// ============================================================

export class SchemaValidationError extends Error {
  public missingFields: string[]
  constructor(missing: string[]) {
    super(`Schema validation failed: missing fields [${missing.join(', ')}]`)
    this.name = 'SchemaValidationError'
    this.missingFields = missing
  }
}

// ============================================================
// Core Function
// ============================================================

export async function runBreakdownMaster(
  storyText: string,
  userId: string,
  options?: {
    title?: string
    genre?: string
    visualStyle?: string
  }
): Promise<{
  success: boolean
  data?: NarrativeConstitutionV3
  error?: string
  rawContent?: string
}> {
  // ⭐ 通过 PromptRegistry 读取 prompt（宪法级约束，禁止硬编码）
  const { getPrompt } = await import('../runtime/prompt/PromptRegistry.js')
  let promptTemplate: string
  try {
    promptTemplate = await getPrompt('剧本拆解总导演', { 字数量: String(storyText.length || ''), 段数: String(Math.max(1, Math.ceil((storyText.length || 300) / 140))) })
  } catch (e: any) {
    return { success: false, error: `PromptRegistry 获取剧本拆解总导演失败: ${e.message}` }
  }

  // 构建 style context
  const styleParts: string[] = []
  if (options?.title) styleParts.push(`【作品标题】${options.title}`)
  if (options?.genre) styleParts.push(`【剧本风格】${options.genre}`)
  if (options?.visualStyle) styleParts.push(`【视觉风格】${options.visualStyle}`)
  const styleSuffix = styleParts.length > 0 ? `\n\n${styleParts.join('\n')}` : ''

  // 替换 {剧本内容} 占位符
  const systemPrompt = promptTemplate.replace('{剧本内容}', storyText)
  const userMessage = styleSuffix

  // 第一次调用
  const rawContent = await callLlm(systemPrompt, userMessage, userId)
  if (!rawContent) {
    return { success: false, error: 'LLM 返回为空' }
  }

  // 第一次解析
  let output = parseConstitutionJson(rawContent)
  if (output) {
    try {
      validateBreakdownOutput(output)
      // ⭐ Trace: 输出场景的环境字段（检查 weather/timeOfDay/colorPalette 是否来自 LLM）
      if (output.scenes?.length) {
        for (const sc of output.scenes) {
          const env = (sc as any).environment || {}
          console.log(`[BreakdownMaster] scene "${(sc as any).name}" env fields:`, JSON.stringify({
            location: env.location,
            lighting: env.lighting,
            atmosphere: env.atmosphere,
            colorPalette: env.colorPalette,
            weather: env.weather,
            timeOfDay: env.timeOfDay,
          }))
        }
      }
      return { success: true, data: output, rawContent }
    } catch (validationErr: unknown) {
      // 结构缺失，尝试重试
      const msg = validationErr instanceof Error ? validationErr.message : 'Schema 校验失败'
      console.warn(`[BreakdownMaster] ⚠️ 第一次校验失败: ${msg}`)
    }
  }

  // 第二次重试：要求 LLM 严格输出纯净 JSON
  console.warn(`[BreakdownMaster] ⚠️ 第一次 JSON 解析/校验失败，重试中...`)
  const retryUserMessage = `上一步输出不符合格式要求。请严格按照以下指示重新输出：

1. 只输出一个合法的 JSON 对象。
2. 不要使用 markdown 代码块包裹。
3. 不要包含任何解释文字。
4. JSON 必须包含所有顶级字段：title, storyArc, characters, scenes, segments, soundDesign, effectsDesign, voices, props。
5. 已删除 cameraLanguage[] 和 emotionCurve[]，不要输出这两个字段。
6. segments 必须内联 camera / environment / characters / emotion 字段。

剧本内容是：
${rawContent.substring(0, 6000)}`
  const retryResult = await callLlm(systemPrompt, retryUserMessage, userId)
  if (retryResult) {
    output = parseConstitutionJson(retryResult)
    if (output) {
      try {
        validateBreakdownOutput(output)
        console.log(`[BreakdownMaster] ✅ 第二次重试解析成功`)
        return { success: true, data: output, rawContent: retryResult }
      } catch {
        console.warn(`[BreakdownMaster] ⚠️ 第二次校验仍失败`)
      }
    }
  }

  // 两次都失败
  const snippet = (rawContent || '').substring(0, 2000)
  return {
    success: false,
    error: 'JSON 汇总解析失败，LLM 未按 Narrative Constitution V2 格式输出',
    rawContent: snippet,
  }
}

// ============================================================
// LLM Call
// ============================================================

async function callLlm(systemPrompt: string, userMessage: string, userId: string): Promise<string | null> {
  try {
    const result = await narrativeGateway.execute({
      systemPrompt,
      userMessage,
      userId: userId || 'anonymous',
      timeoutTier: 'batch',
      maxTokens: 16384,
    })
    return result.content
  } catch (err: any) {
    console.warn(`[BreakdownMaster] LLM 调用失败: ${err.message}`)
    return null
  }
}

// ============================================================
// JSON Parsing (Step 4: repairBrokenJson)
// ============================================================

function parseConstitutionJson(content: string): NarrativeConstitutionV3 | null {
  if (!content) return null

  // 尝试直接解析整个内容
  let jsonStr = tryExtractCleanJson(content)
  if (!jsonStr) {
    jsonStr = repairBrokenJson(content)
  }
  if (!jsonStr) return null

  try {
    return JSON.parse(jsonStr) as NarrativeConstitutionV2
  } catch {
    // 宽松解析
    try {
      const loose = jsonStr
        .replace(/'/g, '"')
        .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3')
        .replace(/,\s*([}\]])/g, '$1')
      return JSON.parse(loose) as NarrativeConstitutionV2
    } catch {
      return null
    }
  }
}

/**
 * 优先提取纯净 JSON：找到第一个 { 和最后一个 } 之间的内容。
 */
function tryExtractCleanJson(content: string): string | null {
  const firstBrace = content.indexOf('{')
  const lastBrace = content.lastIndexOf('}')
  if (firstBrace < 0 || lastBrace < 0 || lastBrace <= firstBrace) return null

  const candidate = content.substring(firstBrace, lastBrace + 1)
  try {
    JSON.parse(candidate)
    return candidate
  } catch {
    return null
  }
}

/**
 * repairBrokenJson — 自动修复常见 JSON 格式问题
 *
 * - 去除 markdown 代码块包裹
 * - 去除前后非 JSON 文本
 * - 修复缺失引号
 * - 修复尾逗号
 */
function repairBrokenJson(content: string): string | null {
  if (!content) return null

  let cleaned = content

  // 去除 markdown 代码块
  cleaned = cleaned.replace(/```(?:json)?\s*\n?/gi, '')
  cleaned = cleaned.replace(/\n?\s*```/g, '')

  // 找到第一个 { 和最后一个 }
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace < 0 || lastBrace < 0 || lastBrace <= firstBrace) return null
  cleaned = cleaned.substring(firstBrace, lastBrace + 1)

  // 修复尾逗号
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1')

  // 尝试解析
  try {
    JSON.parse(cleaned)
    return cleaned
  } catch {
    // 尝试修复缺失引号的键名
    try {
      cleaned = cleaned.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3')
      JSON.parse(cleaned)
      return cleaned
    } catch {
      return null
    }
  }
}

// ============================================================
// Schema Validation (Step 3) — V3
// ============================================================

const V3_TOP_LEVEL_FIELDS = [
  'title',
  'storyArc',
  'characters',
  'scenes',
  'segments',
  'soundDesign',
  'effectsDesign',
  'voices',
  'props',
]

const V3_STORY_ARC_FIELDS = ['setup', 'conflict', 'climax', 'resolution']
const V3_CHARACTER_FIELDS = ['id', 'name', 'alias', 'age', 'appearance', 'personality', 'voiceGuide']
const V3_SCENE_FIELDS = ['id', 'name', 'location', 'environment']
const V3_SCENE_ENV_FIELDS = ['location', 'lighting', 'atmosphere', 'colorPalette']
const V3_SEGMENT_FIELDS = ['id', 'sceneId', 'segmentNumber', 'duration', 'characters', 'environment', 'camera', 'action', 'emotion', 'visualDesc']
const V3_SEGMENT_CAMERA_FIELDS = ['shot', 'movement', 'angle', 'lens']
const V3_SEGMENT_CHARACTER_FIELDS = ['characterId', 'role', 'emotion', 'focus']
const V3_SEGMENT_ENV_FIELDS = ['location', 'lighting', 'atmosphere']
const V3_SEGMENT_ACTION_FIELDS = ['primary']
const V3_SEGMENT_EMOTION_FIELDS = ['type', 'intensity']
const V3_SOUND_FIELDS = ['segmentId', 'ambient', 'music', 'effect']
const V3_EFFECTS_FIELDS = ['segmentId', 'visualEffect', 'transition']
const V3_VOICE_FIELDS = ['characterId', 'voiceType', 'timbre', 'speed', 'speakingStyle']
const V3_PROP_FIELDS = ['id', 'name', 'category', 'description', 'function', 'designNotes']

function checkFields(obj: Record<string, unknown>, required: string[], prefix: string): string[] {
  const missing: string[] = []
  for (const field of required) {
    if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
      missing.push(`${prefix}.${field}`)
    }
  }
  return missing
}

function checkArrayFields(arr: unknown[], checkFn: (item: Record<string, unknown>, idx: number, missing: string[]) => void, itemLabel: string): string[] {
  const missing: string[] = []
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i]
    if (typeof item !== 'object' || item === null) {
      missing.push(`${itemLabel}[${i}]: not an object`)
      continue
    }
    checkFn(item as Record<string, unknown>, i, missing)
  }
  return missing
}

export function validateBreakdownOutput(output: unknown): asserts output is NarrativeConstitutionV3 {
  if (typeof output !== 'object' || output === null) {
    throw new SchemaValidationError(['output is not an object'])
  }

  const obj = output as Record<string, unknown>
  const missing: string[] = []

  // 顶级字段（V3: 已删除 emotionCurve, cameraLanguage）
  missing.push(...checkFields(obj, V3_TOP_LEVEL_FIELDS, ''))

  // storyArc
  if (obj.storyArc && typeof obj.storyArc === 'object') {
    missing.push(...checkFields(obj.storyArc as Record<string, unknown>, V3_STORY_ARC_FIELDS, 'storyArc'))
  }

  // characters
  if (Array.isArray(obj.characters)) {
    missing.push(...checkArrayFields(obj.characters, (item, i, m) => {
      m.push(...checkFields(item, V3_CHARACTER_FIELDS, `characters[${i}]`))
    }, 'characters'))
  }

  // scenes（V3: environment 是嵌套对象）
  if (Array.isArray(obj.scenes)) {
    missing.push(...checkArrayFields(obj.scenes, (item, i, m) => {
      m.push(...checkFields(item, V3_SCENE_FIELDS, `scenes[${i}]`))
      if (item.environment && typeof item.environment === 'object') {
        m.push(...checkFields(item.environment as Record<string, unknown>, V3_SCENE_ENV_FIELDS, `scenes[${i}].environment`))
      }
    }, 'scenes'))
  }

  // segments（V3: 内联 camera/environment/characters/emotion）
  if (Array.isArray(obj.segments)) {
    missing.push(...checkArrayFields(obj.segments, (item, i, m) => {
      m.push(...checkFields(item, V3_SEGMENT_FIELDS, `segments[${i}]`))
      // camera 内联
      if (item.camera && typeof item.camera === 'object') {
        m.push(...checkFields(item.camera as Record<string, unknown>, V3_SEGMENT_CAMERA_FIELDS, `segments[${i}].camera`))
      }
      // environment 内联
      if (item.environment && typeof item.environment === 'object') {
        m.push(...checkFields(item.environment as Record<string, unknown>, V3_SEGMENT_ENV_FIELDS, `segments[${i}].environment`))
      }
      // characters 内联（数组）
      if (Array.isArray(item.characters)) {
        for (let j = 0; j < item.characters.length; j++) {
          const cp = item.characters[j]
          if (typeof cp === 'object' && cp !== null) {
            m.push(...checkFields(cp as Record<string, unknown>, V3_SEGMENT_CHARACTER_FIELDS, `segments[${i}].characters[${j}]`))
          }
        }
      }
      // action 内联
      if (item.action && typeof item.action === 'object') {
        m.push(...checkFields(item.action as Record<string, unknown>, V3_SEGMENT_ACTION_FIELDS, `segments[${i}].action`))
      }
      // emotion 内联
      if (item.emotion && typeof item.emotion === 'object') {
        m.push(...checkFields(item.emotion as Record<string, unknown>, V3_SEGMENT_EMOTION_FIELDS, `segments[${i}].emotion`))
      }
    }, 'segments'))
  }

  // 其余数组
  if (Array.isArray(obj.soundDesign)) {
    missing.push(...checkArrayFields(obj.soundDesign, (item, i, m) => {
      m.push(...checkFields(item, V3_SOUND_FIELDS, `soundDesign[${i}]`))
    }, 'soundDesign'))
  }
  if (Array.isArray(obj.effectsDesign)) {
    missing.push(...checkArrayFields(obj.effectsDesign, (item, i, m) => {
      m.push(...checkFields(item, V3_EFFECTS_FIELDS, `effectsDesign[${i}]`))
    }, 'effectsDesign'))
  }
  if (Array.isArray(obj.voices)) {
    missing.push(...checkArrayFields(obj.voices, (item, i, m) => {
      m.push(...checkFields(item, V3_VOICE_FIELDS, `voices[${i}]`))
    }, 'voices'))
  }
  if (Array.isArray(obj.props)) {
    missing.push(...checkArrayFields(obj.props, (item, i, m) => {
      m.push(...checkFields(item, V3_PROP_FIELDS, `props[${i}]`))
    }, 'props'))
  }

  if (missing.length > 0) {
    throw new SchemaValidationError(missing)
  }
}
