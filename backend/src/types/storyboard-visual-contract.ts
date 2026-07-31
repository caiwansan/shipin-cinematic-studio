/**
 * types/storyboard-visual-contract.ts
 *
 * StoryboardVisualContract — 分镜视觉数据契约
 *
 * 确保进入执行层的每一帧都具有可执行的视觉描述。
 * 所有制片人（昆仑镜）的输出，在进入火麒麟前必须通过此契约验证。
 *
 * 设计原则：
 *   - LLM 不理解 "镜头编号"，只理解视觉 Prompt
 *   - 空描述 = 不许执行
 *   - 验证发生在 StoryboardProduction 层（不是 Provider 层，不是前端）
 */

// ── 单镜头视觉契约 ──

export interface ShotVisualContract {
  /** 镜头/场景 ID */
  shotId: string

  /** 场景说明（来自剧本） */
  sceneDescription: string

  /** 视觉描述（≥20 字符，面向图像/视频模型） */
  visualDescription: string

  /** 镜头语言（如：中景、特写、推轨） */
  cameraLanguage: string

  /** 角色动作描述 */
  characterAction: string

  /** 环境描述 */
  environment: string

  /** 光线描述 */
  lighting: string

  /** 氛围/情绪 */
  mood: string
}

// ── 场景级契约（从 AiSceneSpec / narrative output 转换） ──

export interface SceneVisualContract {
  /** 场景 ID */
  sceneId: string

  /** 场景名称 */
  sceneName: string

  /** 场景描述 */
  sceneDescription: string

  /** 场景的图片生成 Prompt */
  imagePrompt: string

  /** 场景的图片 Prompt 最短长度 */
  readonly IMAGE_PROMPT_MIN_LENGTH: 20

  /** 场景描述最短长度 */
  readonly DESCRIPTION_MIN_LENGTH: 10

  /** 视频 Prompt（可选） */
  videoPrompt?: string
}

// ── 角色级契约 ──

export interface CharacterVisualContract {
  /** 角色名称 */
  characterName: string

  /** 角色外貌描述 */
  physicalDescription: string

  /** 角色图片生成 Prompt */
  imagePrompt: string

  /** 服装描述 */
  clothing: string

  /** 角色图片 Prompt 最短长度 */
  readonly CHARACTER_PROMPT_MIN_LENGTH: 20
}

// ── 质量门控结果 ──

export interface QualityGateResult {
  /** 验证是否通过 */
  passed: boolean

  /** 通过 / 屏蔽执行 */
  action: 'ALLOW_EXECUTION' | 'BLOCK_EXECUTION'

  /** 缺失字段列表 */
  missingFields: Array<{
    target: 'scene' | 'character'
    id: string
    name: string
    field: string
    currentValue: string
    severity: 'critical' | 'warning'
  }>

  /** 阻塞原因摘要 */
  summary: string
}

// ── 执行前验证入参 ──

export interface PreExecutionValidationInput {
  scenes: Array<{
    sceneId: string
    sceneName: string
    sceneDescription?: string
    imagePrompt?: string
    videoPrompt?: string
  }>
  characters?: Array<{
    characterName: string
    physicalDescription?: string
    imagePrompt?: string
    clothing?: string
  }>
}
