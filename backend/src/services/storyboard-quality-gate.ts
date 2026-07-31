/**
 * @deprecated 已由 ProductionPreparationService 替代（services/director/production-preparation.service.ts）
 * Task 01.6 重构为 Task 01.7 ProductionPreparationLayer
 *
 * services/storyboard-quality-gate.ts
 *
 * StoryboardQualityGate — 分镜视觉数据质量门控
 *
 * 职责：
 *   在 ExecutionPlan 进入火麒麟前，验证所有视觉描述完整。
 *   缺失 → LLM 自动补全（通过 NarrativeGateway）或 BLOCK_EXECUTION。
 *
 * 归零原则：
 *   图片/视频生成模型不理解 "镜头编号"，只理解视觉 Prompt。
 *   空描述 = 不许执行 = 阻塞。
 *
 * 位置（插入后）：
 *   NarrativeGateway
 *     ↓
 *   ArtifactSync → 写入 AiSceneSpec/AiCharacterSpec
 *     ↓
 *   🟢 StoryboardQualityGate ◀── 你在这里
 *     ↓
 *   buildPlanFromDbData → DirectorExecutionPlan
 *     ↓
 *   fireKirin (HTTP Adapter → /api/tasks/ai-generate)
 */

import type {
  SceneVisualContract,
  CharacterVisualContract,
  QualityGateResult,
  PreExecutionValidationInput,
} from '../types/storyboard-visual-contract.js'
import type { NarrativeGateway } from '../runtime/narrative-gateway.js'

// ── 常量 ──

const IMAGE_PROMPT_MIN_LENGTH = 20
const SCENE_DESCRIPTION_MIN_LENGTH = 10
const CHARACTER_PROMPT_MIN_LENGTH = 20
const VIDEO_PROMPT_MIN_LENGTH = 10

// ── 门控结果 ──

function pass(): QualityGateResult {
  return {
    passed: true,
    action: 'ALLOW_EXECUTION',
    missingFields: [],
    summary: '✅ 所有镜头视觉描述完整，允许执行',
  }
}

function block(missing: QualityGateResult['missingFields']): QualityGateResult {
  return {
    passed: false,
    action: 'BLOCK_EXECUTION',
    missingFields: missing,
    summary: [
      `🚫 发现 ${missing.length} 个视觉描述缺失，禁止进入执行层`,
      ...missing.map(
        (m) => `  [${m.severity}] ${m.target}「${m.name}」.${m.field} = "${m.currentValue.slice(0, 30)}"`,
      ),
    ].join('\n'),
  }
}

// ── 检查场景级契约 ──

function checkScene(scene: SceneVisualContract, errors: QualityGateResult['missingFields']) {
  if (!scene.imagePrompt || scene.imagePrompt.length < IMAGE_PROMPT_MIN_LENGTH) {
    errors.push({
      target: 'scene',
      id: scene.sceneId,
      name: scene.sceneName,
      field: 'imagePrompt',
      currentValue: scene.imagePrompt || '(empty)',
      severity: 'critical',
    })
  }
  if (!scene.sceneDescription || scene.sceneDescription.length < SCENE_DESCRIPTION_MIN_LENGTH) {
    errors.push({
      target: 'scene',
      id: scene.sceneId,
      name: scene.sceneName,
      field: 'sceneDescription',
      currentValue: scene.sceneDescription || '(empty)',
      severity: 'warning',
    })
  }
}

// ── 检查角色级契约 ──

function checkCharacter(char: CharacterVisualContract, errors: QualityGateResult['missingFields']) {
  if (!char.imagePrompt || char.imagePrompt.length < CHARACTER_PROMPT_MIN_LENGTH) {
    errors.push({
      target: 'character',
      id: char.characterName,
      name: char.characterName,
      field: 'imagePrompt',
      currentValue: char.imagePrompt || '(empty)',
      severity: 'critical',
    })
  }
  if (!char.physicalDescription) {
    errors.push({
      target: 'character',
      id: char.characterName,
      name: char.characterName,
      field: 'physicalDescription',
      currentValue: '',
      severity: 'warning',
    })
  }
}

// ── 主入口：验证并补全 ──

/**
 * validateAndFix — 验证执行前视觉数据完整性
 *
 * 流程：
 *   1. 遍历 scenes → 检查 imagePrompt / description
 *   2. 遍历 characters → 检查 imagePrompt / physicalDescription
 *   3. 有缺失 → autoFix === true → LLM 补全 ✓ → 返回 passed
 *   4. 有缺失 → autoFix === false → BLOCK_EXECUTION
 *
 * @param input 待验证的场景+角色数据
 * @param narrativeGateway 叙事网关（用于 LLM 补全）
 * @param autoFix 是否自动 LLM 补全（默认 true）
 */
export async function validateAndFix(
  input: PreExecutionValidationInput,
  narrativeGateway?: NarrativeGateway,
  autoFix = true,
): Promise<{
  result: QualityGateResult
  fixedScenes: PreExecutionValidationInput['scenes']
  fixedCharacters: PreExecutionValidationInput['characters']
}> {
  const errors: QualityGateResult['missingFields'] = []
  const fixedScenes = [...input.scenes]
  const fixedCharacters = input.characters ? [...input.characters] : []

  // 1. 验证 scenes
  for (const scene of fixedScenes) {
    checkScene(
      {
        sceneId: scene.sceneId,
        sceneName: scene.sceneName,
        sceneDescription: scene.sceneDescription || '',
        imagePrompt: scene.imagePrompt || '',
        videoPrompt: scene.videoPrompt,
      },
      errors,
    )
  }

  // 2. 验证 characters
  if (fixedCharacters) {
    for (const char of fixedCharacters) {
      checkCharacter(
        {
          characterName: char.characterName,
          physicalDescription: char.physicalDescription || '',
          imagePrompt: char.imagePrompt || '',
          clothing: char.clothing || '',
        },
        errors,
      )
    }
  }

  // 3. 全部通过
  if (errors.length === 0) {
    return { result: pass(), fixedScenes, fixedCharacters }
  }

  // 4. 有缺失
  const criticalErrors = errors.filter((e) => e.severity === 'critical')

  // 如果 autoFix 关闭，或者没有 LLM 可用 → BLOCK
  if (!autoFix || !narrativeGateway) {
    return { result: block(errors), fixedScenes, fixedCharacters }
  }

  // 5. LLM 补全
  console.log(`[StoryboardGate] ${errors.length} 处缺失，开始 LLM 补全...`)
  for (const err of errors) {
    if (err.target === 'scene') {
      const scene = fixedScenes.find((s) => s.sceneId === err.id)
      if (scene) {
        const fixed = await fixSceneVisualDescription(scene, narrativeGateway)
        if (fixed.imagePrompt) scene.imagePrompt = fixed.imagePrompt
        if (fixed.sceneDescription) scene.sceneDescription = fixed.sceneDescription
      }
    } else if (err.target === 'character') {
      const char = fixedCharacters?.find((c) => c.characterName === err.name)
      if (char) {
        const fixed = await fixCharacterVisualDescription(char, narrativeGateway)
        if (fixed.imagePrompt) char.imagePrompt = fixed.imagePrompt
      }
    }
  }

  // 6. 二次验证
  const recheckErrors: QualityGateResult['missingFields'] = []
  for (const scene of fixedScenes) {
    checkScene(
      {
        sceneId: scene.sceneId,
        sceneName: scene.sceneName,
        sceneDescription: scene.sceneDescription || '',
        imagePrompt: scene.imagePrompt || '',
      },
      recheckErrors,
    )
  }
  if (fixedCharacters) {
    for (const char of fixedCharacters) {
      checkCharacter(
        {
          characterName: char.characterName,
          physicalDescription: char.physicalDescription || '',
          imagePrompt: char.imagePrompt || '',
          clothing: char.clothing || '',
        },
        recheckErrors,
      )
    }
  }

  const criticalStill = recheckErrors.filter((e) => e.severity === 'critical')
  if (criticalStill.length > 0) {
    return {
      result: block(criticalStill),
      fixedScenes,
      fixedCharacters,
    }
  }

  return {
    result: pass(),
    fixedScenes,
    fixedCharacters,
  }
}

// ── LLM 补全函数 ──

/**
 * fixSceneVisualDescription — 用 LLM 生成场景的视觉描述和 imagePrompt
 *
 * 输入：{ sceneName: "男主走进办公室", sceneDescription: "" }
 * 输出：{ imagePrompt: "..., 电影质感, ...", sceneDescription: "..." }
 */
async function fixSceneVisualDescription(
  scene: PreExecutionValidationInput['scenes'][0],
  narrativeGateway: NarrativeGateway,
): Promise<{ imagePrompt: string; sceneDescription: string }> {
  const systemPrompt = `你是一个专业的电影分镜设计师。根据场景名称和描述，生成完整的视觉描述和 AI 图片生成 prompt。

规则：
1. 返回 JSON 格式：{ "sceneDescription": "场景说明（中文，50-100字）", "imagePrompt": "AI 图片 prompt（中文，80-150字）" }
2. imagePrompt 必须包含：人物、动作、环境、光线、镜头、氛围
3. 禁止使用"镜头编号"、"场景编号"等元数据
4. 面向 图片生成模型（非人类阅读者）
5. 图片 prompt 末尾追加风格描述：电影级画质，4K 写实`

  const userPrompt = `场景名称: ${scene.sceneName}
现有描述: ${scene.sceneDescription || '(无)'}

请生成完整的场景视觉描述和图片生成 prompt。`

  try {
    const response = await narrativeGateway.execute({
      systemPrompt,
      userMessage: userPrompt,
      maxTokens: 1024,
      temperature: 0.7,
      timeoutTier: 'normal',
    })

    const jsonMatch = response.content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.content.trim()
    const result = JSON.parse(jsonStr)

    return {
      imagePrompt: result.imagePrompt || result.image_prompt || '',
      sceneDescription: result.sceneDescription || result.description || result.scene_description || '',
    }
  } catch (e) {
    console.error(`[StoryboardGate] Scene LLM 补全失败:`, e)
    return { imagePrompt: '', sceneDescription: '' }
  }
}

/**
 * fixCharacterVisualDescription — 用 LLM 生成角色的视觉描述和 imagePrompt
 *
 * 输入：{ characterName: "程序员小明", physicalDescription: "...", clothing: "..." }
 * 输出：{ imagePrompt: "..., 单人定妆照, ..." }
 */
async function fixCharacterVisualDescription(
  character: NonNullable<PreExecutionValidationInput['characters']>[0],
  narrativeGateway: NarrativeGateway,
): Promise<{ imagePrompt: string }> {
  const systemPrompt = `你是一个专业的角色视觉设计师。根据角色描述生成高质量的 AI 图片生成 prompt。

规则：
1. 返回 JSON 格式：{ "imagePrompt": "中文 prompt（80-150字）" }
2. imagePrompt 必须包含：角色外貌特征、服装细节、气质表情、光线氛围、镜头构图
3. 图片 prompt 末尾追加：单人，仅此一人，全身定妆照，静态站姿，写实真人照片级，电影级画质`

  const userPrompt = `角色名: ${character.characterName}
外貌描述: ${character.physicalDescription || '(无)'}
服装: ${character.clothing || '(无)'}

请生成角色的图片生成 prompt。`

  try {
    const response = await narrativeGateway.execute({
      systemPrompt,
      userMessage: userPrompt,
      maxTokens: 1024,
      temperature: 0.7,
      timeoutTier: 'normal',
    })

    const jsonMatch = response.content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.content.trim()
    const result = JSON.parse(jsonStr)

    return {
      imagePrompt: result.imagePrompt || result.image_prompt || '',
    }
  } catch (e) {
    console.error(`[StoryboardGate] Character LLM 补全失败:`, e)
    return { imagePrompt: '' }
  }
}

// ── 单次场景/角色检查（快捷入口） ──

export function validateSceneQuick(sceneName: string, imagePrompt: string): boolean {
  return imagePrompt.length >= IMAGE_PROMPT_MIN_LENGTH
}

export function validateCharacterQuick(characterName: string, imagePrompt: string): boolean {
  return imagePrompt.length >= CHARACTER_PROMPT_MIN_LENGTH
}
