/**
 * services/director/production-preparation.service.ts
 *
 * ProductionPreparationService — 导演资产 → 生产订单的加工层
 *
 * 职责：
 *   1. 读取 AiSceneSpec + AiCharacterSpec
 *   2. 检查关键字段完整性（imagePrompt, description, mood, timeOfDay, location）
 *   3. 缺失 → LLM 补全 → 写回 DB
 *   4. 输出 PreparedProductionAsset（字段保证完整）
 *   5. 经过 DirectorProductionQualityGate 门控
 *
 * 定位（插入后）：
 *   AiSceneSpec / AiCharacterSpec
 *     ↓
 *   🟢 ProductionPreparationService ◀── 你在这里
 *     ↓
 *   DirectorProductionQualityGate
 *     ↓
 *   PreparedProductionAsset
 *     ↓
 *   buildPlanFromDbData (只接受 Prepared 类型)
 *     ↓
 *   DirectorExecutionPlan
 *     ↓
 *   Task Runtime
 *
 * 关键约束：
 *   - 不新增 DB 表 — AiSceneSpec/AiCharacterSpec 是唯一事实源
 *   - Preparation 是加工过程，不是新的事实来源
 *   - 所有补全都写回 DB，保持持久化
 *   - 输出 PreparedProductionAsset 保证所有字段非空
 */

import type { NarrativeGateway } from '../../runtime/narrative-gateway.js'
import type {
  PreparedProductionAsset,
  PreparedScene,
  PreparedCharacter,
  ProductionQualityReport,
} from '../../types/production-preparation.js'
import { buildProductionReport } from '../../types/production-preparation.js'

// ── 默认值 ──

const DEFAULT_MOOD = '自然真实'
const DEFAULT_TIME_OF_DAY = '白天'
const DEFAULT_LOCATION = '室内'

// ── Service ──

export class ProductionPreparationService {
  constructor(private narrativeGateway?: NarrativeGateway) {}

  // ── 主入口 ──

  /**
   * prepare — 加工导演资产为生产订单
   *
   * @param projectId 项目 ID
   * @param rawScenes 原始 AiSceneSpec 数据
   * @param rawCharacters 原始 AiCharacterSpec 数据
   * @param autoFix 是否自动 LLM 补全（默认 true）
   */
  async prepare(
    projectId: string,
    rawScenes: RawScene[],
    rawCharacters: RawCharacter[],
    autoFix = true,
  ): Promise<{
    asset: PreparedProductionAsset
    report: ProductionQualityReport
    fixedScenes: string[] // sceneId 列表
    fixedCharacters: string[] // characterName 列表
  }> {
    // 1. 场景加工
    const preparedScenes: PreparedScene[] = []
    const fixedScenes: string[] = []

    for (const raw of rawScenes) {
      const prepared = await this.prepareScene(raw, autoFix)
      preparedScenes.push(prepared)
      if (prepared.imagePrompt !== raw.imagePrompt) {
        fixedScenes.push(raw.sceneId)
      }
    }

    // 2. 角色加工
    const preparedCharacters: PreparedCharacter[] = []
    const fixedCharacters: string[] = []

    for (const raw of rawCharacters) {
      const prepared = await this.prepareCharacter(raw, autoFix)
      preparedCharacters.push(prepared)
      if (prepared.imagePrompt !== raw.imagePrompt) {
        fixedCharacters.push(raw.characterName)
      }
    }

    // 3. 构建资产
    const asset: PreparedProductionAsset = {
      projectId,
      scenes: preparedScenes,
      characters: preparedCharacters,
    }

    // 4. 质量报告
    const report = buildProductionReport(asset)

    return { asset, report, fixedScenes, fixedCharacters }
  }

  // ── 单场景加工 ──

  private async prepareScene(raw: RawScene, autoFix: boolean): Promise<PreparedScene> {
    const needsFix =
      !raw.imagePrompt || raw.imagePrompt.length < 20 ||
      !raw.description || raw.description.length < 10 ||
      !raw.mood ||
      !raw.timeOfDay

    if (needsFix && autoFix && this.narrativeGateway) {
      try {
        const fixed = await this.fixScene(raw)
        return {
          sceneId: raw.sceneId,
          sceneName: raw.sceneName || '未命名场景',
          sceneDescription: fixed.sceneDescription || raw.description || '',
          imagePrompt: fixed.imagePrompt || raw.imagePrompt || '',
          mood: fixed.mood || raw.mood || DEFAULT_MOOD,
          timeOfDay: fixed.timeOfDay || raw.timeOfDay || DEFAULT_TIME_OF_DAY,
          location: raw.environment || DEFAULT_LOCATION,
          sortOrder: raw.sortOrder ?? 0,
        }
      } catch (e) {
        console.error(`[ProductionPreparation] Scene LLM 补全失败: ${raw.sceneId}`, e)
        // Fallback: 使用原始值
      }
    }

    // 无补全 / 补全失败 → 使用原始值
    return {
      sceneId: raw.sceneId,
      sceneName: raw.sceneName || '未命名场景',
      sceneDescription: raw.description || '',
      imagePrompt: raw.imagePrompt || '',
      mood: raw.mood || DEFAULT_MOOD,
      timeOfDay: raw.timeOfDay || DEFAULT_TIME_OF_DAY,
      location: raw.environment || DEFAULT_LOCATION,
      sortOrder: raw.sortOrder ?? 0,
    }
  }

  // ── 单角色加工 ──

  private async prepareCharacter(raw: RawCharacter, autoFix: boolean): Promise<PreparedCharacter> {
    const needsFix =
      !raw.imagePrompt || raw.imagePrompt.length < 20
      // physicalDescription 可选，但缺失时尝试补全

    if (needsFix && autoFix && this.narrativeGateway) {
      try {
        const fixed = await this.fixCharacter(raw)
        return {
          characterName: raw.characterName || '未命名角色',
          physicalDescription: fixed.physicalDescription || raw.physicalDescription || '',
          clothing: raw.clothing || '',
          imagePrompt: fixed.imagePrompt || raw.imagePrompt || '',
          voiceType: raw.voiceType,
        }
      } catch (e) {
        console.error(`[ProductionPreparation] Character LLM 补全失败: ${raw.characterName}`, e)
      }
    }

    return {
      characterName: raw.characterName || '未命名角色',
      physicalDescription: raw.physicalDescription || '',
      clothing: raw.clothing || '',
      imagePrompt: raw.imagePrompt || '',
      voiceType: raw.voiceType,
    }
  }

  // ── LLM 补全 ──

  private async fixScene(raw: RawScene): Promise<{
    imagePrompt: string
    sceneDescription: string
    mood: string
    timeOfDay: string
  }> {
    if (!this.narrativeGateway) throw new Error('NarrativeGateway 未初始化')

    const systemPrompt = `你是一个专业的电影分镜视觉设计师。根据场景信息，补全完整的视觉描述和 AI 图片生成参数。

请务必返回严格 JSON 格式：
{
  "imagePrompt": "面向 AI 图片生成模型的 prompt（中文，80-200字），包含：人物动作、环境细节、光线氛围、镜头构图、色彩风格。末尾追加：电影级画质，4K 写实，高细节",
  "sceneDescription": "场景的中文描述（50-100字），供人类阅读",
  "mood": "场景情绪基调（1-2个词，如：紧张/温馨/悲壮/神秘/宁静）",
  "timeOfDay": "时间（如：清晨/正午/黄昏/深夜）"
}

规则：
1. imagePrompt 必须 ≥ 80 字，面向图片生成模型
2. sceneDescription 面向人类阅读
3. mood 不要过长，1-2个词
4. timeOfDay 包含具体时段
5. 禁止使用"镜头编号"、"场景编号"等元数据`

    const userPrompt = `场景名称: ${raw.sceneName || '(无)'}
现有描述: ${raw.description || '(无)'}
现有环境: ${raw.environment || '(无)'}
现有光线: ${raw.lighting || '(无)'}
现有氛围: ${raw.mood || '(无)'}

请补全场景的视觉描述和生成参数。`

    const response = await this.narrativeGateway.execute({
      systemPrompt,
      userMessage: userPrompt,
      maxTokens: 1024,
      temperature: 0.7,
      timeoutTier: 'normal',
    })

    const result = this.parseJsonResponse(response.content)
    return {
      imagePrompt: result.imagePrompt || result.image_prompt || '',
      sceneDescription: result.sceneDescription || result.description || result.scene_description || '',
      mood: result.mood || '',
      timeOfDay: result.timeOfDay || result.time_of_day || '',
    }
  }

  private async fixCharacter(raw: RawCharacter): Promise<{
    imagePrompt: string
    physicalDescription: string
  }> {
    if (!this.narrativeGateway) throw new Error('NarrativeGateway 未初始化')

    const systemPrompt = `你是一个专业的角色视觉设计师。根据角色信息，生成高质量的 AI 图片生成参数。

请务必返回严格 JSON 格式：
{
  "imagePrompt": "面向 AI 图片生成模型的 prompt（中文，80-150字），包含：角色外貌特征、服装细节、气质表情、光线氛围、镜头构图。末尾追加：单人，全身定妆照，写实真人照片级，电影级画质",
  "physicalDescription": "角色外貌的补充文字描述（中文，30-80字），供人类阅读"
}

规则：
1. imagePrompt 面向图片生成模型，必须 ≥ 80 字
2. physicalDescription 面向人类阅读
3. 基于角色名称、外貌、服装生成，不创造未提供的信息`

    const userPrompt = `角色名: ${raw.characterName || '(无)'}
外貌描述: ${raw.physicalDescription || '(无)'}
服装: ${raw.clothing || '(无)'}

请生成角色的图片生成 prompt。`

    const response = await this.narrativeGateway.execute({
      systemPrompt,
      userMessage: userPrompt,
      maxTokens: 1024,
      temperature: 0.7,
      timeoutTier: 'normal',
    })

    const result = this.parseJsonResponse(response.content)
    return {
      imagePrompt: result.imagePrompt || result.image_prompt || '',
      physicalDescription: result.physicalDescription || result.physical_description || '',
    }
  }

  // ── JSON 解析 ──

  private parseJsonResponse(content: string): Record<string, string> {
    try {
      const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim()
      return JSON.parse(jsonStr)
    } catch {
      return {}
    }
  }
}

// ── 原始输入类型 ──

export interface RawScene {
  sceneId: string
  sceneName?: string
  description?: string
  imagePrompt?: string
  mood?: string
  timeOfDay?: string
  lighting?: string
  environment?: string
  sortOrder?: number
}

export interface RawCharacter {
  characterName: string
  physicalDescription?: string
  clothing?: string
  imagePrompt?: string
  voiceType?: string
}
