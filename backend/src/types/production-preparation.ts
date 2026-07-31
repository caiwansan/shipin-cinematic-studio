/**
 * types/production-preparation.ts
 *
 * Production Preparation Layer — 导演资产 → 生产订单的加工类型
 *
 * 资产源（唯一事实源）：
 *   - AiSceneSpec    → PreparedScene
 *   - AiCharacterSpec → PreparedCharacter
 *
 * 关键规则：
 *   ✅ 不新增 DB 表 — AiSceneSpec / AiCharacterSpec 是唯一事实源
 *   ✅ Preparation 是加工过程，不是新的事实来源
 *   ✅ PreparedScene / PreparedCharacter 在 PreparationService 中构建
 *   ❌ 不绕过 buildPlanFromDbData — 后者接收 Prepared 类型
 *   ❌ 不允许空 prompt 通过
 */

// ── 加工后的场景 ──

export interface PreparedScene {
  /** 关联 AI 场景 ID */
  sceneId: string
  /** 场景名称 */
  sceneName: string
  /** 场景描述（中文，50-200 字） */
  sceneDescription: string
  /** 图片生成 prompt（≥ 20 字符，经过 LLM 补全） */
  imagePrompt: string
  /** 氛围/情绪 */
  mood: string
  /** 时间 */
  timeOfDay: string
  /** 场景地点 */
  location: string
  /** 排序权重 */
  sortOrder: number
}

// ── 加工后的角色 ──

export interface PreparedCharacter {
  /** 角色名称 */
  characterName: string
  /** 外貌描述 */
  physicalDescription: string
  /** 服装描述 */
  clothing: string
  /** 图片生成 prompt（≥ 20 字符，经过 LLM 补全） */
  imagePrompt: string
  /** 语音类型（可选） */
  voiceType?: string
}

// ── Preparation 完整输出 ──

export interface PreparedProductionAsset {
  projectId: string
  scenes: PreparedScene[]
  characters: PreparedCharacter[]
}

// ── 质量报告 ──

export interface ProductionQualityReport {
  passed: boolean
  action: 'ALLOW_EXECUTION' | 'BLOCK_EXECUTION'
  summary: string
  sceneMissing: Array<{
    sceneId: string
    sceneName: string
    missingFields: string[]
  }>
  characterMissing: Array<{
    characterName: string
    missingFields: string[]
  }>
  totalMissing: number
}

// ── 辅助函数 ──

export function isPreparedScene(scene: any): scene is PreparedScene {
  return (
    typeof scene.sceneId === 'string' &&
    typeof scene.sceneName === 'string' &&
    typeof scene.imagePrompt === 'string' &&
    scene.imagePrompt.length >= 20
  )
}

export function isPreparedCharacter(char: any): char is PreparedCharacter {
  return (
    typeof char.characterName === 'string' &&
    typeof char.imagePrompt === 'string' &&
    char.imagePrompt.length >= 20
  )
}

/**
 * 构建完整的 ProductionAsset 报告
 */
export function buildProductionReport(asset: PreparedProductionAsset): ProductionQualityReport {
  const sceneMissing = asset.scenes
    .filter((s) => !isPreparedScene(s))
    .map((s) => ({
      sceneId: s.sceneId,
      sceneName: s.sceneName,
      missingFields: buildSceneMissingFields(s),
    }))

  const characterMissing = asset.characters
    .filter((c) => !isPreparedCharacter(c))
    .map((c) => ({
      characterName: c.characterName,
      missingFields: buildCharacterMissingFields(c),
    }))

  const totalMissing = sceneMissing.length + characterMissing.length
  const passed = totalMissing === 0

  return {
    passed,
    action: passed ? 'ALLOW_EXECUTION' : 'BLOCK_EXECUTION',
    summary: passed
      ? `✅ 所有 ${asset.scenes.length} 场景 + ${asset.characters.length} 角色已准备好生产`
      : `🚫 发现 ${totalMissing} 个资产准备不完整（${sceneMissing.length} 场景 + ${characterMissing.length} 角色）`,
    sceneMissing,
    characterMissing,
    totalMissing,
  }
}

function buildSceneMissingFields(scene: PreparedScene): string[] {
  const fields: string[] = []
  if (!scene.imagePrompt || scene.imagePrompt.length < 20) fields.push('imagePrompt')
  if (!scene.sceneDescription || scene.sceneDescription.length < 10) fields.push('sceneDescription')
  if (!scene.mood) fields.push('mood')
  if (!scene.timeOfDay) fields.push('timeOfDay')
  if (!scene.location) fields.push('location')
  return fields
}

function buildCharacterMissingFields(char: PreparedCharacter): string[] {
  const fields: string[] = []
  if (!char.imagePrompt || char.imagePrompt.length < 20) fields.push('imagePrompt')
  if (!char.physicalDescription) fields.push('physicalDescription')
  return fields
}
