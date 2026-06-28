/**
 * agent_portrait_prompt — 角色形象 Prompt 生成 Agent (v2)
 *
 * 变更：不再让 LLM 自由发挥，而是使用结构化 prompt composer，
 * 保证每次输出格式一致、质量稳定。
 *
 * 架构：
 *   1. extractFeatures() — 从角色数据提取结构化特征列表
 *   2. composePrompt() — 按照固定公式组装 prompt（不调 LLM）
 *   3. qualityGate() — 检查 prompt 是否包含必需元素
 *   4. LLM refine（可选）— 只在 compose 不足时微调
 *
 * 输入：{ character: CharacterProfile, script: string }
 * 输出：{ prompt: string, negativePrompt?: string }
 */

import { narrativeGateway } from '../runtime/narrative-gateway.js'

interface CharacterProfile {
  characterId: string
  name: string
  role: string
  appearance: any
  identityLock: any
  personality: string[]
  plotContext: string
}

// ─── QA Prompt Template（仅在 compose 不够时使用）───

const QC_PROMPT = `你是一位角色肖像提示词质量管理员。

你将收到【角色肖像优化需求表单】，请检查生成的提示词是否满足以下标准的 AIGC 提示词格式要求：

【标准格式要求】
- 角色名 + 外貌描述（年龄、发色、面部特征、服装、体型）
- 姿态: full body portrait, standing front view
- 表情描述（eg. calm expression, neutral expression）
- 背景: white background, character design sheet style
- 画质标签: high detail face, cinematic lighting, 8k, sharp focus

如果缺少上述要素，请重写提示词。
如果已包含全部要素，输出原始提示词不变。

输出必须是英文纯文本提示词，不要额外解释。`

// ─── 默认负向 prompt ───
const DEFAULT_NEGATIVE_PROMPT = 
  'ugly, deformed, blurry, low quality, extra limbs, bad anatomy, watermark, text, ' +
  'multiple views, disfigured, poorly drawn, mutation, bad proportions, extra fingers'

// ─── 特征提取 ───

interface VisualFeature {
  type: string
  value: string
}

function extractFeatures(character: CharacterProfile): VisualFeature[] {
  const features: VisualFeature[] = []
  const a = character.appearance || {}

  // 年龄/性别
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

  // 显著特征
  if (a.notableFeatures) {
    features.push({ type: 'notable', value: a.notableFeatures })
  }

  // 角色定位
  const personality = (character.personality || []).slice(0, 2).join(', ')
  if (personality) {
    features.push({ type: 'expression', value: `${personality} expression` })
  }

  return features
}

// ─── Prompt 合成（不调 LLM）───

function composePrompt(
  character: CharacterProfile,
  features: VisualFeature[]
): string {
  const name = character.name || 'character'
  
  // 1. 基础角色描述 — 外貌特征拼接
  const featureDescriptions = features
    .filter(f => ['demographic', 'hair', 'eyes', 'ethnicity', 'build', 'clothing', 'notable', 'expression'].includes(f.type))
    .map(f => f.value)
    .filter(Boolean)

  // 如果特征太少（< 3 个），用原始角色数据补全
  if (featureDescriptions.length < 3 && character.appearance) {
    const rawDesc = Object.values(character.appearance)
      .filter((v: any) => typeof v === 'string' && v.length > 1)
      .slice(0, 3)
    featureDescriptions.push(...rawDesc.map((v: string) => String(v)))
  }

  const appearanceLine = featureDescriptions.join(', ')

  // 2. 构造标准 prompt
  // 分段拼接，保证结构一致
  const parts: string[] = [
    `Portrait of ${name}, ${appearanceLine},`,
    `full body portrait, standing front view, white background,`,
    `character design sheet style, high detail face, cinematic lighting, 8k, sharp focus`
  ]

  return parts.join(' ')
}

// ─── 质量门禁 ───

interface QualityCheck {
  pass: boolean
  missing: string[]
}

function qualityGate(prompt: string): QualityCheck {
  const checks = {
    age: /\d+\s*(?:year|岁)/i,
    body: /full body|全身/i,
    front: /front view|正面/i,
    background: /white background|plain background|solid background/i,
    quality: /8k|high detail|sharp focus|cinematic/i,
    english: /^[A-Za-z]/,
  }

  const missing: string[] = []
  for (const [key, regex] of Object.entries(checks)) {
    if (!regex.test(prompt)) {
      missing.push(key)
    }
  }

  return { pass: missing.length === 0, missing }
}

// ─── 主入口 ───

export async function generatePortraitPrompt(
  character: CharacterProfile,
  script: string
): Promise<{ prompt: string; negativePrompt?: string }> {
  // Step 1: 特征提取
  const features = extractFeatures(character)

  // Step 2: 结构化 prompt 合成
  let prompt = composePrompt(character, features)
  let negativePrompt = DEFAULT_NEGATIVE_PROMPT

  // Step 3: 质量门禁
  const qc = qualityGate(prompt)
  if (!qc.pass) {
    // 质量不达标 → 用 LLM 精炼一次
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
      // Only use LLM output if it's actually better (longer, has body/background keywords)
      if (refined.length > prompt.length * 0.5 && /full body|white background|8k/i.test(refined)) {
        prompt = refined
      }
    }
  }

  return { prompt, negativePrompt }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

