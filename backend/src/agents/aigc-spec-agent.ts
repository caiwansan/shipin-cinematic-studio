/**
 * @deprecated 此 Agent 已被 v2 版本替代（aigc-spec-agent-v2.ts），
 * 当前保留仅用于历史兼容。新代码应使用 Narrative Compiler v2 架构。
 *
 * AIGC Spec Agent
 *
 * 智能代理：接收故事文本，调用 NarrativeLLMGateway 生成完整 AIGC 制作规格表，
 * 并对输出进行校验和自动修复重试。
 * 支持单项重新生成（regenerateType）供"重新构思"功能使用。
 */

import { narrativeGateway } from '../runtime/narrative-gateway.js'
import { buildPromptCached } from './prompt-service.js'

/**
 * 通过 NarrativeLLMGateway 调用 LLM（统一超时/fallback/retry）
 */
async function callLLM(messages: { role: string; content: string }[], temperature: number, maxTokens: number, userId?: string): Promise<{ content: string; totalTokens: number }> {
  const userMessage = messages.find(m => m.role === 'user')?.content || ''
  const systemMsg = messages.find(m => m.role === 'system')?.content || ''

  const result = await narrativeGateway.execute({
    systemPrompt: systemMsg,
    userMessage,
    userId: userId || 'anonymous',
    timeoutTier: 'batch', // aigc-spec 用 batch 级别（60s）避免截断
  })

  return {
    content: result.content,
    totalTokens: result.totalTokens,
  }
}

// ============================================================
// Types
// ============================================================

interface AigcSpecValidationResult {
  valid: boolean
  errors: string[]
  spec: any // 清洗后的 spec（如果校验失败但可以清洗修复）
}

interface GenerateSpecOptions {
  text: string
  title?: string
  aspectRatio?: string
  targetDuration?: number  // ⭐ 用户指定的视频总时长（秒），用于约束段落时长总和
  userId?: string
}

interface GenerateSpecResult {
  success: boolean
  data?: any
  error?: string
  meta?: {
    latencyMs: number
    totalTokens: number
    retried: boolean
  }
}

interface RetryResult {
  success: boolean
  data?: any
  meta?: {
    retried: boolean
    totalTokens: number
  }
}

interface AgentStats {
  calls: number
  success: number
  fixRetries: number
}

// ============================================================
// Constants
// ============================================================

const FIRST_TEMPERATURE = 0.6
const DEFAULT_MAX_TOKENS = 8192
const MAX_TEXT_LENGTH = 8000

const VALID_CAMERA_ANGLES = [
  'wide_establishing',
  'close_up',
  'over_shoulder',
  'fade_to_black',
  'wide_shot',
] as const

// ============================================================
// Agent Class
// ============================================================

class AigcSpecAgent {
  private systemPromise: Promise<string>
  private stats: AgentStats = { calls: 0, success: 0, fixRetries: 0 }

  constructor() {
    // ⭐ 从 PromptService 读取（统一入口）
    this.systemPromise = this.loadSystemPrompt()
  }

  private async loadSystemPrompt(): Promise<string> {
    const result = await buildPromptCached({ agentName: 'aigc-prompt' })
    return result.prompt
  }

  /**
   * 生成 AIGC 制作规格表
   */
  async generateSpec(options: GenerateSpecOptions): Promise<GenerateSpecResult> {
    const start = Date.now()
    this.stats.calls++

    const { text, title, aspectRatio } = options

    const systemPrompt = await this.systemPromise
    const userPrompt = this._buildUserPrompt(text, title, aspectRatio, options.targetDuration)

    let response
    try {
      response = await callLLM(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        FIRST_TEMPERATURE,
        DEFAULT_MAX_TOKENS,
        options.userId
      )
    } catch (err: any) {
      return {
        success: false,
        error: `LLM 调用失败: ${err.message}`,
      }
    }

    // 2. 解析 JSON
    let spec = this._parseJson(response.content)
    if (!spec) {
      // JSON 解析失败，尝试重试
      this.stats.fixRetries++
      const corrected = await this._retryWithCorrection(
        text,
        title,
        aspectRatio,
        ['JSON 解析失败，请确保输出为严格有效的 JSON，不要额外文字']
      )
      if (corrected.success) {
        this.stats.success++
        return {
          success: true,
          data: corrected.data,
          meta: {
            latencyMs: Date.now() - start,
            totalTokens: corrected.meta?.totalTokens ?? 0,
            retried: true,
          },
        }
      }
      return {
        success: false,
        error: 'LLM 返回格式无法解析，重试后仍失败',
      }
    }

    // 3. 校验
    const validation = this._validate(spec)
    if (!validation.valid) {
      // 第一次失败：带纠正信息重试
      this.stats.fixRetries++
      const corrected = await this._retryWithCorrection(
        text,
        title,
        aspectRatio,
        validation.errors
      )
      if (corrected.success) {
        this.stats.success++
        return {
          success: true,
          data: corrected.data,
          meta: {
            latencyMs: Date.now() - start,
            totalTokens: corrected.meta?.totalTokens ?? 0,
            retried: true,
          },
        }
      }

      // 重试仍然失败，返回清洗后的 spec 和错误
      if (validation.spec) {
        this.stats.success++
        return {
          success: true,
          data: validation.spec,
          meta: {
            latencyMs: Date.now() - start,
            totalTokens: response.totalTokens,
            retried: false,
          },
        }
      }

      return {
        success: false,
        error: '校验失败: ' + validation.errors.join('; '),
      }
    }

    this.stats.success++
    return {
      success: true,
      data: spec,
      meta: {
        latencyMs: Date.now() - start,
        totalTokens: response.totalTokens,
        retried: false,
      },
    }
  }

  /**
   * 根据原始剧本重新生成特定类型的 AIGC 规格。
   * 让 LLM 重新阅读剧本，只输出目标类型对应的那部分表格数据。
   */
  async regenerateType(options: {
    type: 'character' | 'scene' | 'storyboard' | 'voice' | 'frame'
    text: string
    title?: string
    aspectRatio?: string
    currentData?: any
    characterNames?: string[]
    userId?: string
  }): Promise<GenerateSpecResult> {
    const start = Date.now()
    const { type, text, title, aspectRatio, currentData, characterNames } = options

    const TYPE_LABELS: Record<string, string> = {
      character: '角色形象规格（characterSpecs）',
      scene: '场景图规格（sceneSpecs）',
      storyboard: '视频段落规划（videoSegments）',
      voice: '音色配置（voiceConfigs）',
      frame: '首尾帧设计（frameDesign）',
    }

    const typePrompt = this._buildTypePrompt(type, aspectRatio, currentData, characterNames)
    const userMessage = this._buildTypeUserMessage(type, text, title, characterNames)

    let response
    try {
      response = await callLLM(
        [
          { role: 'system', content: typePrompt },
          { role: 'user', content: userMessage },
        ],
        0.7,
        4096,
        options.userId
      )
    } catch (err: any) {
      return { success: false, error: `LLM 调用失败: ${err.message}` }
    }

    let spec = this._parseJson(response.content)
    if (!spec) {
      return { success: false, error: 'LLM 返回格式无法解析为 JSON' }
    }

    return {
      success: true,
      data: spec,
      meta: {
        latencyMs: Date.now() - start,
        totalTokens: response.totalTokens,
        retried: false,
      },
    }
  }

  // ─── Private Helpers ───

  private _buildTypePrompt(
    type: string,
    aspectRatio?: string,
    currentData?: any,
    characterNames?: string[]
  ): string {
    const TYPE_CONTENT: Record<string, string> = {
      character: `JSON Schema（角色形象规格）:
{
  "characterSpecs": [
    {
      "characterName": "角色名",
      "gender": "男 | 女 | 未知",
      "age": "青年 | 中年 | 老年",
      "physicalDescription": "身高、体型、面部特征、气质描述（中文，50-100字）",
      "personality": "性格描述（中文，30-60字）",
      "clothing": "服装描述（中文，20-50字）",
      "props": "常用道具（中文，20字内）",
      "imagePrompt": "表格化格式，参见详细要求",
      "negativePrompt": "负面词"
    }
  ]
}
【角色形象图要求】
- 全身正面站姿或微侧身，完整展示从头到脚，穿着合身的动作捕捉服
- 角色居中构图，背景纯白色
- 必须表格化格式，每行一个 [字段名]: 值
- 字段包含：构图类型、面部五官、表情眼神、身体姿态、体型轮廓特征、光影光线、背景环境、风格关键词
- 风格关键词必须包含「角色定妆照、全身人设图、影视级质感」
- ⚠️ 根据角色名称推断时代背景（古装/现代/科幻/奇幻/神话），并在 imagePrompt 中明确体现。如哪吒=神话古装，敖丙=神话古装
- 禁止使用分号 ; 作为分隔符
- 负面词只写质量和画质问题`,
      scene: `JSON Schema（场景图规格）:
{
  "sceneSpecs": [
    {
      "sceneId": "scene_0",
      "sceneName": "场景名称",
      "description": "场景氛围描述（中文，30-80字）",
      "imagePrompt": "表格化格式",
      "negativePrompt": "负面词",
      "aspectRatio": "${aspectRatio || '9:16'}"
    }
  ]
}
【场景图要求】
- 绝对禁止出现任何人物、角色、人影、剪影
- 只包含环境景物
- 必须使用表格化格式
- 字段包含：景别构图、环境描述、光线色调、天气氛围、画面元素、风格关键词`,
      storyboard: `JSON Schema（视频段落规划）:
{
  "videoSegments": [
    {
      "segmentId": "seg_0",
      "title": "段落标题",
      "associatedScenes": ["scene_0"],
      "duration": 8,
      "narrativePurpose": "叙事目的描述（中文，20-50字）",
      "shotPattern": "wide_to_close | close_to_wide | medium_medium | montage",
      "emotionArc": "情绪变化弧线",
      "backgroundMusic": "配乐风格建议"
    }
  ]
}
- duration 严格控制在 5-8 秒
- ⭐ 分镜段落数严格按照剧本字数决定：300字以内 → 2-3段；300-600字 → 3-4段；600-1000字 → 4-6段；1000字以上 → 最多8段
- 每个段落的 narrativePurpose 要包含完整的画面描述（30-80字），不能只写一句话`,
      voice: `JSON Schema（音色配置）:
{
  "voiceConfigs": [
    {
      "characterName": "角色名",
      "voiceType": "zh_male_deep | zh_male_warm | zh_male_calm | zh_male_cheerful | zh_female_calm | zh_female_warm | zh_female_cheerful | zh_female_young | zh_male_young | zh_male_authoritative",
      "speakingStyle": "说话风格描述（10字内）",
      "pitch": 1.0,
      "speed": 1.0,
      "ttsPrompt": "TTS prompt 辅助描述（20字内）"
    }
  ]
}
- 根据角色性别、年龄、性格选择音色
- 儿童高音快语速，老人低音慢语速
- 活泼用 cheerful，沉稳用 calm，权威用 authoritative
- pitch 0.8-1.5，speed 0.7-1.3`,
      frame: `JSON Schema（首尾帧设计）:
{
  "frameDesign": [
    {
      "segmentId": "seg_0",
      "firstFrame": {
        "description": "开场画面描述",
        "imagePrompt": "表格化文生图 prompt",
        "cameraAngle": "wide_establishing | close_up | over_shoulder"
      },
      "lastFrame": {
        "description": "结束画面描述",
        "imagePrompt": "表格化文生图 prompt",
        "cameraAngle": "close_up | fade_to_black | wide_shot"
      }
    }
  ]
}`,
    }

    const currentDataStr = currentData
      ? `\n\n当前已有的该类型数据（供参考，可以完全重新生成）:\n${JSON.stringify(currentData, null, 2).slice(0, 3000)}`
      : ''

    const LABELS: Record<string, string> = {
      character: '角色形象规格（characterSpecs）',
      scene: '场景图规格（sceneSpecs）',
      storyboard: '视频段落规划（videoSegments）',
      voice: '音色配置（voiceConfigs）',
      frame: '首尾帧设计（frameDesign）',
    }
    return `你是一个专业的 AIGC 影视短剧制作规划师。你的任务是根据故事文本，重新生成以下类型的规格数据：${LABELS[type] || type}

要求：
1. 输出必须是严格有效的 JSON，不要任何额外文字或代码块标记。
2. JSON 只包含该类型对应的字段，不包含其他类型的数据。
3. 严格遵守原始故事文本的内容，不得添加故事中不存在的信息。
4. 所有文本描述使用中文。
5. 输出质量必须达到专业影视制作水平。

${TYPE_CONTENT[type] || ''}
${currentDataStr}
${characterNames?.length ? `\n【重要】请只重新生成以下角色的数据：${characterNames.join('、')}` : ''}`
  }

  private _buildTypeUserMessage(
    type: string,
    text: string,
    title?: string,
    characterNames?: string[]
  ): string {
    const TYPE_LABELS: Record<string, string> = {
      character: '角色形象规格（characterSpecs）',
      scene: '场景图规格（sceneSpecs）',
      storyboard: '视频段落规划（videoSegments）',
      voice: '音色配置（voiceConfigs）',
      frame: '首尾帧设计（frameDesign）',
    }

    return `请根据以下故事文本，重新生成 ${TYPE_LABELS[type] || type} 数据。

故事标题：${title || '未命名故事'}

故事文本：
${text.slice(0, MAX_TEXT_LENGTH)}

${characterNames?.length ? `【重要】请只重新生成以下角色的数据：${characterNames.join('、')}` : ''}

请严格按照 JSON Schema 格式输出，只输出该类型对应的数据。`
  }

  private _buildUserPrompt(text: string, title?: string, aspectRatio?: string, targetDuration?: number): string {
    const durationConstraint = targetDuration
      ? `\n\n## ⚠️ 视频总时长严格约束
目标视频总时长为 ${targetDuration} 秒（±10%）。
- 所有 videoSegments 的 duration 字段加起来必须约等于 ${targetDuration} 秒
- 如果剧本较长，适当增加段落数（可多于 6 段）以匹配 ${targetDuration} 秒总时长
- 如果剧本较短，适当放慢节奏加长段落
- 每个段落仍控制在 5-8 秒，通过调整段落数量来匹配总时长\n`
      : ''

    return `请根据以下故事文本，生成完整的 AIGC 制作规格表 JSON。

故事标题：${title || '未命名故事'}
用户选择的画幅比例：${aspectRatio || '9:16'}
${durationConstraint}
故事文本：
${text.slice(0, MAX_TEXT_LENGTH)}

## ⚠️ 角色 variant 规则（必须遵守）

逐角色分析剧本全文，判断是否存在"视觉连续性断裂"：
- 身体变化：胖→瘦、人→机器人、毁容→康复
- 长期造型变化：长发→短发、常服→战甲、校服→礼服
- 身份变化：平民→皇帝、学生→特工
- 跨世界观变化：人类→魔化、普通→终极形态

如果有，同一个角色输出多条 characterSpec，用 variant 字段区分（如"减肥前""减肥后""魔化""正常"）。
如果没有，variant 留空字符串 ""。

**绝不因表情、动作、临时情绪、镜头变化创建 variant。**

JSON Schema 严格遵循 system prompt 中的定义。`
  }

  /**
   * 校验输出 JSON 是否符合 schema
   */
  private _validate(spec: any): AigcSpecValidationResult {
    const errors: string[] = []

    if (!spec || typeof spec !== 'object') {
      return { valid: false, errors: ['输出不是有效的 JSON 对象'], spec }
    }

    // 检查 characterSpecs
    if (!spec.characterSpecs || !Array.isArray(spec.characterSpecs)) {
      errors.push('缺少 characterSpecs 数组')
    }

    // 检查 sceneSpecs
    if (!spec.sceneSpecs || !Array.isArray(spec.sceneSpecs)) {
      errors.push('缺少 sceneSpecs 数组')
    }

    // 检查首尾帧格式：每个 item 必须有 firstFrame 和 lastFrame
    if (spec.frameDesign && Array.isArray(spec.frameDesign)) {
      for (const fd of spec.frameDesign) {
        if (!fd.firstFrame || !fd.lastFrame) {
          errors.push(`frameDesign 缺少 firstFrame 或 lastFrame`)
          break
        }
        // cameraAngle 枚举检查
        if (fd.firstFrame.cameraAngle && !VALID_CAMERA_ANGLES.includes(fd.firstFrame.cameraAngle as any)) {
          errors.push(`firstFrame cameraAngle "${fd.firstFrame.cameraAngle}" 不在枚举范围内`)
        }
        if (fd.lastFrame.cameraAngle && !VALID_CAMERA_ANGLES.includes(fd.lastFrame.cameraAngle as any)) {
          errors.push(`lastFrame cameraAngle "${fd.lastFrame.cameraAngle}" 不在枚举范围内`)
        }
      }
    }

    // 检查新四表
    if (!spec.effectSpecs || !Array.isArray(spec.effectSpecs)) {
      errors.push('缺少 effectSpecs 数组')
    }
    if (!spec.actionSpecs || !Array.isArray(spec.actionSpecs)) {
      errors.push('缺少 actionSpecs 数组')
    }
    if (!spec.cameraSpecs || !Array.isArray(spec.cameraSpecs)) {
      errors.push('缺少 cameraSpecs 数组')
    }
    if (!spec.emotionSpecs || !Array.isArray(spec.emotionSpecs)) {
      errors.push('缺少 emotionSpecs 数组')
    }

    return { valid: errors.length === 0, errors, spec }
  }

  /**
   * 解析 JSON（支持代码块格式和常见 JSON 错误修复）
   */
  private _parseJson(content: string): any {
    // 尝试从代码块中提取 JSON
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim()

    // 第一次尝试：标准 JSON 解析
    try {
      return JSON.parse(jsonStr)
    } catch {
      // 第二次尝试：修复常见 JSON 错误
      try {
        return JSON.parse(
          jsonStr
            // 修复注释
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            // 修复 trailing comma
            .replace(/,\s*([}\]])/g, '$1')
            // 修复单引号
            .replace(/'/g, '"')
            // 修复未加引号的 key
            .replace(/(\{|,)\s*(\w+)\s*:/g, '$1"$2":')
        )
      } catch {
        // 第三次尝试：用 {} 包裹松散内容
        try {
          const wrapped = `{${jsonStr}}`
          return JSON.parse(wrapped)
        } catch {
          return null
        }
      }
    }
  }

  /**
   * 带纠正信息的重试
   */
  private async _retryWithCorrection(
    text: string,
    title?: string,
    aspectRatio?: string,
    errors?: string[]
  ): Promise<RetryResult> {
    const correction = errors?.length
      ? `\n\n[系统校验反馈]\n你之前生成的 JSON 有以下格式错误：\n${errors.map(e => `- ${e}`).join('\n')}\n请根据以上问题修正你的输出，严格遵循 JSON schema 格式。特别注意：角色形象图的 imagePrompt 必须使用表格化格式（每行一个 [字段名]: 值），且 negativePrompt 只写质量/画质问题，不要写任何构图/姿势/景别有关的词。`
      : ''

    try {
      const systemPrompt = await this.systemPromise
      const response = await callLLM(
        [
          { role: 'system', content: systemPrompt + correction },
          {
            role: 'user',
            content: `故事标题：${title || '未命名故事'}\n画幅比例：${aspectRatio || '9:16'}\n\n故事文本：${text.slice(0, MAX_TEXT_LENGTH)}`,
          },
        ],
        0.4, // 降低 temperature 提高准确率
        DEFAULT_MAX_TOKENS
      )

      const spec = this._parseJson(response.content)
      if (spec && this._validate(spec).valid) {
        return {
          success: true,
          data: spec,
          meta: { retried: true, totalTokens: response.totalTokens },
        }
      }
    } catch {
      // 重试失败，静默处理
    }

    return { success: false }
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const aigcSpecAgent = new AigcSpecAgent()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

