/**
 * P0 — Capability Enum
 *
 * 系统中所有 AI 调用必须通过 capability 进入 Runtime。
 * 业务层只能声明"要什么能力"，不能指定"用什么 provider"。
 *
 * ═══ Capability-Based Runtime Architecture ═══
 * Capability → User Provider → Adapter → Native Provider
 *
 * @see docs/architecture/capability-runtime.md
 */

export enum Capability {
  // ── Narrative / Script ──
  SCRIPT_ANALYSIS = 'script_analysis',
  PROMPT_OPTIMIZATION = 'prompt_optimization',
  STORY_EXPANSION = 'story_expansion',
  DIRECTOR_REASONING = 'director_reasoning',
  CINEMATIC_PROMPT = 'cinematic_prompt',

  // ── Media Generation ──
  IMAGE_GENERATION = 'image_generation',
  VIDEO_GENERATION = 'video_generation',
  VOICE_GENERATION = 'voice_generation',

  // ── Future ──
  MUSIC_GENERATION = 'music_generation',
  EFFECT_GENERATION = 'effect_generation',
}

/**
 * Capability 元数据映射
 */
export const CAPABILITY_META: Record<Capability, {
  label: string
  description: string
}> = {
  [Capability.SCRIPT_ANALYSIS]: {
    label: '剧本拆解',
    description: '分析剧本，提取角色/场景/分镜',
  },
  [Capability.PROMPT_OPTIMIZATION]: {
    label: 'Prompt 优化',
    description: '对角色/场景/分镜的 Prompt 进行语义增强',
  },
  [Capability.STORY_EXPANSION]: {
    label: '故事扩写',
    description: '展开故事细节，增加剧情转折',
  },
  [Capability.DIRECTOR_REASONING]: {
    label: '导演推理',
    description: '导演认知层，镜头语言/节奏/情绪分析',
  },
  [Capability.CINEMATIC_PROMPT]: {
    label: '影视 Prompt 生成',
    description: '生成用于视频模型的详细描述性 Prompt',
  },
  [Capability.IMAGE_GENERATION]: {
    label: '图片生成',
    description: '根据 Prompt 生成图片',
  },
  [Capability.VIDEO_GENERATION]: {
    label: '视频生成',
    description: '根据 Prompt + 参考图生成视频',
  },
  [Capability.VOICE_GENERATION]: {
    label: '语音生成',
    description: '根据文本生成语音',
  },
  [Capability.MUSIC_GENERATION]: {
    label: '音乐生成',
    description: '生成背景音乐或音效',
  },
  [Capability.EFFECT_GENERATION]: {
    label: '特效生成',
    description: '生成视觉特效',
  },
}
