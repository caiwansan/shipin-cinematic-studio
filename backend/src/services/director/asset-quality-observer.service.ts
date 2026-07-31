/**
 * services/director/asset-quality-observer.service.ts
 *
 * Asset Quality Observer — AI 导演质量观察层
 *
 * 职责：
 *   观察已生成的资产（Image / Video / Audio），
 *   根据原始 spec 和 prompt 判断质量，
 *   输出 Quality Report。
 *
 * 核心约束：
 *   ❌ 不调用 AI Provider
 *   ❌ 不修改 Asset
 *   ❌ 不自动重生成
 *   ❌ 不写入新表（使用 TaskLog.metadata）
 *
 * 数据流：
 *   GET /api/director/assets/:assetId/quality
 *     → observerService.observe(assetId)
 *       → prisma.videoTask.findUnique + loadSpec
 *         → analyze*()
 *           → write TaskLog
 *             → return AssetQualityReport
 */

import { prisma } from '../../utils/index.js'

// ── 类型定义 ──

export interface AssetQualityReport {
  /** 被观察的资产 ID（VideoTask.id） */
  assetId: string
  /** 资产类型 */
  assetType: 'image' | 'video' | 'audio'
  /** 综合评分 0-100 */
  score: number
  /** 分维度评分 */
  dimensions: AssetQualityDimensions
  /** 问题列表 */
  issues: string[]
  /** 改进建议 */
  recommendations: string[]
  /** 观察时间 */
  analyzedAt: Date
  /** 来源追踪 */
  source: {
    projectId: string
    taskType: string
    status: string
    hasOutput: boolean
    specType: string | null  // 'scene' | 'character' | 'unknown'
  }
}

export interface AssetQualityDimensions {
  /** 视觉一致性 — 画面完整性、无明显缺陷 */
  visualConsistency?: number
  /** Prompt 对齐 — 生成内容与 prompt 的匹配度 */
  promptAlignment?: number
  /** 角色一致性 — 角色特征描述覆盖度 */
  characterConsistency?: number
  /** 场景完整性 — 场景要素覆盖度 */
  sceneCompleteness?: number
  /** 音频质量 — 时长、格式合规 */
  audioQuality?: number
}

// ── 常量 ──

/** 场景视觉要素关键词（用于 prompt 对齐检测） */
const SCENE_VISUAL_ELEMENTS = [
  '构图', '视角', '光线', '光照', '色调', '色彩',
  '氛围', '景深', '景别', '镜头',
  '风格', '画质', '分辨率',
]

/** 场景完整性要素（对应 AiSceneSpec 字段） */
const SCENE_COMPLETENESS_FIELDS = [
  { key: 'type', label: '场景类型/地点' },
  { key: 'mood', label: '氛围/情绪' },
  { key: 'environment', label: '环境描述' },
  { key: 'lighting', label: '光照' },
  { key: 'colorTone', label: '色调' },
  { key: 'timeOfDay', label: '时间' },
]

/** 角色完整性要素（对应 AiCharacterSpec 字段） */
const CHARACTER_COMPLETENESS_FIELDS = [
  { key: 'gender', label: '性别' },
  { key: 'age', label: '年龄' },
  { key: 'physicalDescription', label: '外貌描述' },
  { key: 'clothing', label: '服装' },
  { key: 'role', label: '角色定位' },
]

// ── 主入口 ──

/**
 * 观察一个资产的质量
 *
 * @param assetId VideoTask.id
 * @returns AssetQualityReport
 * @throws 404 ASSET_NOT_FOUND 如果 asset 不存在
 */
export async function observeAsset(assetId: string): Promise<AssetQualityReport> {
  // === 1. 获取任务记录 ===
  const task = await prisma.videoTask.findUnique({ where: { id: assetId } })
  if (!task) {
    const err = new Error('ASSET_NOT_FOUND')
    ;(err as any).statusCode = 404
    throw err
  }

  const projectId = task.projectId

  // === 2. 解析 input/output ===
  let parsedError: any = null
  try {
    parsedError = task.error ? JSON.parse(task.error) : null
  } catch {
    // error 字段格式异常，继续
  }

  const input = parsedError?.input || null
  const output = parsedError?.output || null
  const prompt = input?.prompt?.trim() || ''
  const negativePrompt = input?.negativePrompt?.trim() || ''

  const hasOutput = !!(output?.url || output?.imageUrl || output?.videoUrl || output?.audioUrl)
  const outputUrl = output?.url || output?.imageUrl || output?.videoUrl || output?.audioUrl || null

  // === 3. 确定资产类型 ===
  const assetType = mapTaskTypeToAssetType(task.taskType)

  // === 4. 加载匹配的 Spec ===
  // 尝试从 prompt 中提取场景/角色名
  const sceneMatch = extractSceneInfo(prompt)
  const characterMatch = extractCharacterInfo(prompt)

  let sceneSpec: any = null
  let charSpec: any = null
  let specType: string | null = null

  if (sceneMatch?.sceneId) {
    sceneSpec = await prisma.aiSceneSpec.findFirst({
      where: { projectId, sceneId: sceneMatch.sceneId },
    })
  }
  if (!sceneSpec && sceneMatch?.sceneName) {
    sceneSpec = await prisma.aiSceneSpec.findFirst({
      where: { projectId, sceneName: sceneMatch.sceneName },
    })
  }
  // fallback: 尝试拿任意一个 scene spec（对于单一场景项目）
  if (!sceneSpec) {
    sceneSpec = await prisma.aiSceneSpec.findFirst({ where: { projectId } })
  }

  if (characterMatch?.characterName) {
    charSpec = await prisma.aiCharacterSpec.findFirst({
      where: { projectId, characterName: characterMatch.characterName },
    })
  }
  if (!charSpec) {
    charSpec = await prisma.aiCharacterSpec.findFirst({ where: { projectId } })
  }

  if (sceneSpec) specType = 'scene'
  if (charSpec && !sceneSpec) specType = 'character'
  if (charSpec && sceneSpec) specType = 'scene+character'

  // === 5. 分析各维度 ===

  const promptAlignment = analyzePromptAlignment(prompt, sceneSpec, charSpec)
  const sceneCompleteness = sceneSpec ? analyzeSceneCompleteness(prompt, sceneSpec) : 0
  const characterConsistency = charSpec ? analyzeCharacterConsistency(prompt, charSpec) : 0
  const visualConsistency = analyzeVisualConsistency(prompt, hasOutput)

  // 聚合综合评分
  const dimensions: AssetQualityDimensions = {
    visualConsistency,
    promptAlignment,
    characterConsistency,
    sceneCompleteness,
  }

  const score = computeOverallScore(dimensions)

  // === 6. 收集问题和建议 ===

  const issues: string[] = []
  const recommendations: string[] = []

  if (!hasOutput) {
    issues.push('资产尚未生成完成，缺少输出')
    recommendations.push('等待任务完成后再进行质量评估')
  }

  if (!prompt) {
    issues.push('任务缺少生产 prompt')
    recommendations.push('通过 plan-from-specs 补充完整 prompt 后重试')
  }

  if (promptAlignment < 60) {
    issues.push('Prompt 中缺少关键视觉要素描述（构图、光线、色调等）')
    recommendations.push('补充场景的视觉要素描述到 imagePrompt 中')
  }

  if (sceneCompleteness < 60 && sceneSpec) {
    const missing = SCENE_COMPLETENESS_FIELDS
      .filter(f => !prompt.toLowerCase().includes((sceneSpec as any)[f.key]?.toLowerCase() || ''))
      .map(f => f.label)
    issues.push(`场景完整性不足：缺失 ${missing.join('、')} 等要素描述`)
    recommendations.push('在 imagePrompt 中包含场景类型、氛围、光照、色调、环境等要素')
  } else if (!sceneSpec) {
    issues.push('未找到匹配的场景 spec')
    recommendations.push('确认 projectId 和场景 ID 正确')
  }

  if (characterConsistency < 60 && charSpec) {
    const missing = CHARACTER_COMPLETENESS_FIELDS
      .filter(f => (charSpec as any)[f.key] && !prompt.toLowerCase().includes((charSpec as any)[f.key].toLowerCase()))
      .map(f => f.label)
    if (missing.length > 0) {
      issues.push(`角色特征描述不完整：缺失 ${missing.join('、')}`)
      recommendations.push('在 prompt 中包含角色的性别、年龄、外貌、服装等关键特征')
    }
  }

  if (score < 40 && hasOutput) {
    recommendations.push('考虑重新生成，本次质量评分过低')
  }

  // === 7. 持久化到 TaskLog.metadata ===
  try {
    await prisma.taskLog.create({
      data: {
        taskId: assetId,
        level: 'info',
        message: `质量观察: score=${score}, issues=${issues.length}`,
        metadata: {
          qualityObservation: {
            score,
            dimensions,
            issues,
            recommendations,
            analyzedAt: new Date().toISOString(),
          },
        },
      },
    })
  } catch {
    // TaskLog 写入失败不阻塞
  }

  // === 8. 返回报告 ===

  return {
    assetId,
    assetType,
    score,
    dimensions,
    issues,
    recommendations,
    analyzedAt: new Date(),
    source: {
      projectId,
      taskType: task.taskType,
      status: task.status,
      hasOutput,
      specType,
    },
  }
}

// ── 内部分析函数 ──

/**
 * 分析 Prompt 对齐度
 * 检查 prompt 是否包含基本的视觉要素关键词
 */
function analyzePromptAlignment(
  prompt: string,
  sceneSpec: any,
  charSpec: any,
): number {
  if (!prompt) return 0

  const matched = SCENE_VISUAL_ELEMENTS.filter(el => prompt.includes(el))
  const ratio = matched.length / SCENE_VISUAL_ELEMENTS.length

  if (ratio >= 0.5) return Math.min(90, Math.round(50 + ratio * 50))
  if (ratio >= 0.3) return Math.round(40 + ratio * 40)
  return Math.round(ratio * 60)
}

/**
 * 分析场景完整性
 * 检查 prompt 是否覆盖了 AiSceneSpec 的各个字段
 */
function analyzeSceneCompleteness(prompt: string, spec: any): number {
  if (!prompt || !spec) return 0

  const total = SCENE_COMPLETENESS_FIELDS.length
  const filled = SCENE_COMPLETENESS_FIELDS.filter(f => {
    const val = spec[f.key]
    if (!val || val === '') return true // field not set → skip
    return prompt.toLowerCase().includes(String(val).toLowerCase())
  }).length

  return Math.round((filled / total) * 100)
}

/**
 * 分析角色一致性
 * 检查 prompt 中是否包含了角色 spec 的关键特征
 */
function analyzeCharacterConsistency(prompt: string, spec: any): number {
  if (!prompt || !spec) return 0

  const total = CHARACTER_COMPLETENESS_FIELDS.length
  const filled = CHARACTER_COMPLETENESS_FIELDS.filter(f => {
    const val = spec[f.key]
    if (!val || val === '') return true // field not set → skip
    return prompt.toLowerCase().includes(String(val).toLowerCase())
  }).length

  return Math.round((filled / total) * 100)
}

/**
 * 分析视觉一致性（无 AI 推断）
 * - prompt 长度
 * - 是否有 negative prompt
 * - 是否有输出 URL（任务完成）
 */
function analyzeVisualConsistency(prompt: string, hasOutput: boolean): number {
  let score = 0

  // Prompt 长度基础分
  if (prompt.length >= 200) score += 30
  else if (prompt.length >= 100) score += 20
  else if (prompt.length >= 50) score += 10

  // Prompt 结构评分
  if (prompt.includes('构图') || prompt.includes('视角')) score += 10
  if (prompt.includes('光线') || prompt.includes('光照') || prompt.includes('色调')) score += 10
  if (prompt.includes('风格') || prompt.includes('画质')) score += 10

  // 输出可用性
  if (hasOutput) score += 30

  // 含有角色名
  if (prompt.includes('角色') || prompt.match(/「[^」]+」/)) score += 10

  return Math.min(100, score)
}

/**
 * 计算综合评分
 * 加权平均各维度
 */
function computeOverallScore(dimensions: AssetQualityDimensions): number {
  const weights: Record<string, number> = {
    visualConsistency: 0.35,
    promptAlignment: 0.25,
    sceneCompleteness: 0.20,
    characterConsistency: 0.20,
  }

  let totalWeight = 0
  let weightedScore = 0

  for (const [key, weight] of Object.entries(weights)) {
    const val = dimensions[key as keyof AssetQualityDimensions]
    if (val !== undefined) {
      weightedScore += val * weight
      totalWeight += weight
    }
  }

  return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0
}

// ── 辅助函数 ──

function mapTaskTypeToAssetType(taskType: string): 'image' | 'video' | 'audio' {
  if (taskType === 'image' || taskType === 'img' || taskType === 'picture') return 'image'
  if (taskType === 'video' || taskType === 'vid') return 'video'
  if (taskType === 'tts' || taskType === 'audio' || taskType === 'voice') return 'audio'
  return 'image' // default
}

interface SceneMatch {
  sceneId?: string
  sceneName?: string
}

interface CharacterMatch {
  characterName?: string
}

/**
 * 从 prompt 中提取场景信息
 * 匹配「场景名」或 sceneId 模式
 */
function extractSceneInfo(prompt: string): SceneMatch | null {
  if (!prompt) return null

  // 匹配「场景名」模式
  const sceneNameMatch = prompt.match(/场景[：:]\s*(「[^」]+」)/)
  if (sceneNameMatch) {
    return { sceneName: sceneNameMatch[1].replace(/「|」/g, '') }
  }

  return null
}

/**
 * 从 prompt 中提取角色信息
 * 匹配「角色名」模式
 */
function extractCharacterInfo(prompt: string): CharacterMatch | null {
  if (!prompt) return null

  // 匹配 角色「名称」 模式
  const charMatch = prompt.match(/角色[「(（]([^」)）]+)[」)）]/)
  if (charMatch) {
    return { characterName: charMatch[1] }
  }

  // 匹配 角色名: xxx
  const charNameMatch = prompt.match(/角色名[：:]\s*([^\s，,。.、]+)/)
  if (charNameMatch) {
    return { characterName: charNameMatch[1] }
  }

  return null
}
