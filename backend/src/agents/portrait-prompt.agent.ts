/**
 * agent_portrait_prompt — 角色形象 Prompt 生成 Agent (v2.2)
 *
 * 变更(v2.2)：支持三视图 prompt 生成。
 * 调用方传入 tripeView: true 时返回三个视角的 prompt。
 *
 * 变更(v2.1)：从数据库读取提示词模板，不再硬编码。
 * 保留完整 fallback 机制：数据库无记录时使用当前硬编码值。
 *
 * 架构：
 *   1. extractFeatures() — 从角色数据提取结构化特征列表
 *   2. composePrompt() — 按照模板公式组装 prompt（优先从 DB 读取模板）
 *   3. qualityGate() — 检查 prompt 是否包含必需元素（规则从 DB 读取）
 *   4. LLM refine（可选）— 只在 compose 不足时微调
 *
 * 输入：{ character: CharacterProfile, script: string, tripeView?: boolean }
 * 输出：{ prompt: string, negativePrompt?: string } 或 { prompts: { front: string, side: string, back: string }, negativePrompt?: string }
 */

import { narrativeGateway } from '../runtime/narrative-gateway.js'
import { prisma } from '../utils/index.js'
import { isVisualFeature, validateVisualFeatures } from './visual-feature-validator.js'

interface CharacterProfile {
  characterId: string
  name: string
  role: string
  appearance: any
  identityLock: any
  personality: string[]
  plotContext: string
}

// ─── QA Prompt Template ⚠️ 硬编码 fallback ⚠️ ───
// 注意：这是数据库不可用时的降级方案。
// 正常情况下模板应由 `imagePromptTemplates` 表（`type='portrait'`, `templateKey='qc_prompt'`）提供。
// 如需修改模板内容，请优先更新数据库记录，而非此处的硬编码值。

const FALLBACK_QC_PROMPT = `你是一位角色肖像提示词质量管理员。

你将收到【角色肖像优化需求表单】，请检查生成的提示词是否满足以下标准的 AIGC 提示词格式要求：

【标准格式要求】
- 角色名 + 外貌描述（年龄、发色、面部特征、服装、体型）
- 姿态: full body portrait, standing front view
- 表情描述：neutral expression, calm face, eyes open looking forward, mouth closed（禁止展现任何情绪表情）
- 动作描述：static pose, arms naturally at sides, no action, no movement, no gesture（禁止出现手部动作、转身、行走等）
- 背景: white background, character design sheet style
- 画质标签: high detail face, cinematic lighting, 8k, sharp focus

如果缺少上述要素，请重写提示词。
如果已包含全部要素，输出原始提示词不变。

输出必须是英文纯文本提示词，不要额外解释。`

// ─── 默认负向 prompt ⚠️ 硬编码 fallback ⚠️ ───
// 注意：这是数据库不可用时的降级方案。
// 正常情况下模板应由 `imagePromptTemplates` 表（`type='portrait'`, `templateKey='negative_prompt'`）提供。
const FALLBACK_NEGATIVE_PROMPT =
  'ugly, deformed, blurry, low quality, extra limbs, bad anatomy, watermark, text, ' +
  'multiple views, disfigured, poorly drawn, mutation, bad proportions, extra fingers'

// ─── 提示词结构模板 ⚠️ 硬编码 fallback ⚠️ ───
// 注意：这是数据库不可用时的降级方案。
// 正常情况下模板应由 `imagePromptTemplates` 表（`type='portrait'`, `templateKey='prompt_structure'`）提供。
const FALLBACK_PROMPT_STRUCTURE =
  'Portrait of {{name}}, {{appearance}}, full body portrait, standing front view, white background, character design sheet style, high detail face, cinematic lighting, 8k, sharp focus'

// ─── 质量检查规则 ⚠️ 硬编码 fallback ⚠️ ───
// 注意：这是数据库不可用时的降级方案。
// 正常情况下规则应由 `imagePromptTemplates` 表（`type='portrait'`, `templateKey='quality_rules'`）提供。
const FALLBACK_QUALITY_RULES: Record<string, { regex: string; label: string }> = {
  age: { regex: '\\d+\\s*(?:year|岁)', label: '年龄' },
  body: { regex: 'full body|全身', label: '全身' },
  front: { regex: 'front view|正面', label: '正面' },
  background: { regex: 'white background|plain background|solid background', label: '背景' },
  quality: { regex: '8k|high detail|sharp focus|cinematic', label: '画质' },
  english: { regex: '^[A-Za-z]', label: '英文' },
}

// ─── 合成规则 ⚠️ 硬编码 fallback ⚠️ ───
// 注意：这是数据库不可用时的降级方案。
// 正常情况下规则应由 `imagePromptTemplates` 表（`type='portrait'`, `templateKey='composition_rules'`）提供。
const FALLBACK_COMPOSITION_RULES = {
  minFeatures: 3,
  featureTypes: ['demographic', 'hair', 'eyes', 'ethnicity', 'build', 'clothing', 'notable', 'expression'],
  qualityTags: ['high detail face', 'cinematic lighting', '8k', 'sharp focus'],
}

// ─── DB 读取辅助函数 ───

/** 从 DB 读取指定 type + templateKey 的模板 contents，读取失败时降级到 fallback */
async function getTemplateContent(type: string, templateKey: string, fallback: string): Promise<string> {
  try {
    const record = await prisma.imagePromptTemplates.findUnique({
      where: { type_templateKey: { type, templateKey } },
    })
    if (record && record.enabled && record.content) {
      return record.content
    }
    // 数据库记录不存在或未启用 → 降级到硬编码
    console.warn(
      `[portrait-prompt] 数据库记录为空/未启用: type="${type}", templateKey="${templateKey}"，将使用硬编码 fallback`
    )
  } catch (err) {
    // DB 不可用 → 降级到硬编码
    console.warn(
      `[portrait-prompt] 数据库查询失败: type="${type}", templateKey="${templateKey}"`,
      err instanceof Error ? err.message : err
    )
  }
  return fallback
}

/** 从 DB 读取 JSON 格式的模板并解析，读取失败时降级到 fallback */
async function getTemplateJSON<T>(type: string, templateKey: string, fallback: T): Promise<T> {
  try {
    const raw = await getTemplateContent(type, templateKey, '')
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    console.warn(
      `[portrait-prompt] JSON 解析失败: type="${type}", templateKey="${templateKey}"，将使用硬编码 fallback`
    )
    return fallback
  }
}

// ─── 特征提取 ───

interface VisualFeature {
  type: string
  value: string
}

function extractFeatures(character: CharacterProfile): VisualFeature[] {
  const features: VisualFeature[] = []
  const a = character.appearance || {}
  const age = a.age || ''
  const gender = a.gender || ''
  if (age || gender) {
    features.push({ type: 'demographic', value: [age, gender].filter(Boolean).join(' ') })
  }

  // 发型
  const hairStyle = a.hairStyle || ''
  const hairColor = a.hairColor || ''
  if (hairStyle || hairColor) {
    features.push({ type: 'hair', value: [hairStyle, hairColor, 'hair'].filter(Boolean).join(' ') })
  }

  // 眼睛
  if (a.eyeColor) {
    features.push({ type: 'eyes', value: `${a.eyeColor} eyes` })
  }

  // 肤色
  if (a.ethnicity) {
    features.push({ type: 'ethnicity', value: a.ethnicity })
  }

  // 体型
  const height = a.height || ''
  const build = a.build || ''
  if (height || build) {
    features.push({ type: 'build', value: [height, build].filter(Boolean).join(' ') })
  }

  // 服装
  if (a.clothing) {
    features.push({ type: 'clothing', value: `wearing ${a.clothing}` })
  }

  // 显著特征（外貌）
  if (a.distinctiveFeatures) {
    features.push({ type: 'notable', value: a.distinctiveFeatures })
  }

  // ⭐ 过滤非视觉特征（防止人格标签混入图片生成）
  return validateVisualFeatures(features)
}

// ─── Prompt 合成（不调 LLM）───

function composePrompt(
  character: CharacterProfile,
  features: VisualFeature[],
  structureTemplate: string,
  compositionRules: { minFeatures: number; featureTypes: string[]; qualityTags: string[] }
): string {
  const name = character.name || 'character'

  // 1. 基础角色描述 — 外貌特征拼接
  const featureDescriptions = features
    .filter(f => compositionRules.featureTypes.includes(f.type))
    .map(f => f.value)
    .filter(Boolean)

  // 如果特征太少（小于阈值），用原始角色数据补全
  const minFeatures = compositionRules.minFeatures || 3
  if (featureDescriptions.length < minFeatures && character.appearance) {
    const rawDesc = Object.values(character.appearance)
      .filter((v: any) => typeof v === 'string' && v.length > 1)
      .slice(0, minFeatures)
    featureDescriptions.push(...rawDesc.map((v: any) => String(v)))
  }

  const appearanceLine = featureDescriptions.join(', ')

  // 2. 使用模板替换变量
  const qualityTags = (compositionRules.qualityTags || []).join(', ')
  let prompt = structureTemplate
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{appearance\}\}/g, appearanceLine)
    .replace(/\{\{quality_tags\}\}/g, qualityTags)

  return prompt
}

// ─── 质量门禁 ───

interface QualityCheck {
  pass: boolean
  missing: string[]
}

function qualityGate(prompt: string, rules: Record<string, { regex: string; label: string }>): QualityCheck {
  const missing: string[] = []
  for (const [_key, rule] of Object.entries(rules)) {
    try {
      const regex = new RegExp(rule.regex, 'i')
      if (!regex.test(prompt)) {
        missing.push(rule.label)
      }
    } catch {
      // 无效 regex 跳过
      missing.push(rule.label)
    }
  }

  return { pass: missing.length === 0, missing }
}

// ─── 三视图 prompt 模板 ───

interface PortraitPrompts {
  prompt: string
  negativePrompt?: string
}

interface TripleViewPrompts {
  prompts: {
    front: string     // 正面 prompt
    side: string      // 侧面/¾面 prompt
    back: string      // 背面 prompt
  }
  negativePrompt?: string
}

export type PortraitPromptResult = PortraitPrompts | TripleViewPrompts

/**
 * 生成三视图各视角的 prompt
 */
function composeTripleViewPrompts(
  character: CharacterProfile,
  features: VisualFeature[],
  structureTemplate: string,
  compositionRules: { minFeatures: number; featureTypes: string[]; qualityTags: string[] }
): TripleViewPrompts['prompts'] {
  const name = character.name || 'character'

  const featureDescriptions = features
    .filter(f => compositionRules.featureTypes.includes(f.type))
    .map(f => f.value)
    .filter(Boolean)

  const appearanceLine = featureDescriptions.join(', ')
  const qualityTags = (compositionRules.qualityTags || []).join(', ')
  // 替换模板变量
  const basePrompt = structureTemplate
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{appearance\}\}/g, appearanceLine)
    .replace(/\{\{quality_tags\}\}/g, qualityTags)

  // 三视图各视角修饰（强调端正站姿，避免歪身/扭胯/侧倾）
  const views = {
    front: `${basePrompt}, front view, looking at viewer, symmetrical, full body, standing, facing forward, straight posture, upright, body centered, feet shoulder-width apart, arms at sides, neutral pose, no tilt, no twist, no angle`,
    side: `${basePrompt}, side view, profile, 3/4 angle, looking to the side, standing, body straight, upright, vertical alignment, no lean, no bend`,
    back: `${basePrompt}, back view, from behind, looking away, full body, standing, straight back, vertical, symmetric shoulders, centered`,
  }

  return views
}

// ─── 主入口 ───

export async function generatePortraitPrompt(
  character: CharacterProfile,
  script: string,
  options?: { tripleView?: boolean }
): Promise<PortraitPromptResult> {
  // Step 0: 从数据库读取所有模板（并行）
  const [qcPromptRaw, negativePromptRaw, structureTemplateRaw, qualityRulesRaw, compositionRulesRaw] = await Promise.all([
    getTemplateContent('portrait', 'qc_prompt', FALLBACK_QC_PROMPT),
    getTemplateContent('portrait', 'negative_prompt', FALLBACK_NEGATIVE_PROMPT),
    getTemplateContent('portrait', 'prompt_structure', FALLBACK_PROMPT_STRUCTURE),
    getTemplateJSON<Record<string, { regex: string; label: string }>>('portrait', 'quality_rules', FALLBACK_QUALITY_RULES),
    getTemplateJSON<{ minFeatures: number; featureTypes: string[]; qualityTags: string[] }>(
      'portrait',
      'composition_rules',
      FALLBACK_COMPOSITION_RULES,
    ),
  ])

  const QC_PROMPT = qcPromptRaw
  const DEFAULT_NEGATIVE_PROMPT = negativePromptRaw
  const promptStructure = structureTemplateRaw
  const qualityRules = qualityRulesRaw
  const compositionRules = compositionRulesRaw

  // Step 1: 特征提取
  const features = extractFeatures(character)

  // ⭐ 三视图模式分支
  const isTripleView = options?.tripleView === true

  // Step 2: 结构化 prompt 合成
  let prompt = composePrompt(character, features, promptStructure, compositionRules)
  let negativePrompt = DEFAULT_NEGATIVE_PROMPT

  if (isTripleView) {
    // 三视图模式：直接合成三视角的 prompt，不经过质量门禁（每个视角单独 LLM 精炼太贵）
    const triplePrompts = composeTripleViewPrompts(character, features, promptStructure, compositionRules)

    // 可选：对正面 prompt 做一次质量门禁（正面最重要）
    const qcFront = qualityGate(triplePrompts.front, qualityRules)
    if (!qcFront.pass) {
      const refineInput = JSON.stringify({
        character,
        generatedPrompt: triplePrompts.front,
        missingElements: qcFront.missing,
        features: features.map(f => `${f.type}: ${f.value}`),
      })
      const result = await narrativeGateway.execute({
        systemPrompt: QC_PROMPT,
        userMessage: `Refine this character portrait prompt:\n${triplePrompts.front}\n\nMissing elements: ${qcFront.missing.join(', ')}\n\nCharacter data: ${refineInput}`,
        timeoutTier: 'fast',
        userId: 'agent_portrait_prompt',
      })
      if (result.ok && result.content) {
        const refined = result.content.trim()
        if (refined.length > prompt.length * 0.5 && /full body|white background|8k/i.test(refined)) {
          triplePrompts.front = refined
        }
      }
    }

    return {
      prompts: triplePrompts,
      negativePrompt,
    }
  }

  // 单视图模式（原有逻辑）
  // Step 3: 质量门禁
  const qc = qualityGate(prompt, qualityRules)
  if (!qc.pass) {
    const refineInput = JSON.stringify({
      character,
      generatedPrompt: prompt,
      missingElements: qc.missing,
      features: features.map(f => `${f.type}: ${f.value}`),
    })

    const result = await narrativeGateway.execute({
      systemPrompt: QC_PROMPT,
      userMessage: `Refine this character portrait prompt:\n${prompt}\n\nMissing elements: ${qc.missing.join(', ')}\n\nCharacter data: ${refineInput}`,
      timeoutTier: 'fast',
      userId: 'agent_portrait_prompt',
    })

    if (result.ok && result.content) {
      const refined = result.content.trim()
      if (refined.length > prompt.length * 0.5 && /full body|white background|8k/i.test(refined)) {
        prompt = refined
      }
    }
  }

  // 汇总检查
  if (
    QC_PROMPT === FALLBACK_QC_PROMPT ||
    DEFAULT_NEGATIVE_PROMPT === FALLBACK_NEGATIVE_PROMPT ||
    promptStructure === FALLBACK_PROMPT_STRUCTURE ||
    qualityRules === FALLBACK_QUALITY_RULES ||
    compositionRules === FALLBACK_COMPOSITION_RULES
  ) {
    console.warn(
      `[portrait-prompt] ⚠️ 使用了硬编码 fallback 模板（数据库记录缺失或不可用），特征数=${features.length}，角色=${character.name}`
    )
  }

  return { prompt, negativePrompt }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};
