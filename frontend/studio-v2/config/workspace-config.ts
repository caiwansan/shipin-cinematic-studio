/**
 * workspace-config.ts — Creative Workspace 领域配置
 *
 * 定义每个创作领域的 Pipeline Stage 序列、AI Prompt 模板、生产规则。
 * 这是 Workspace-SEPARATION 的核心配置，所有领域差异集中在此。
 *
 * 扩展新领域：添加一个 WorkspaceConfig 条目即可，零 Core 变更。
 */

// ─── Pipeline Stage 定义 ───
export interface PipelineStageDef {
  key: string
  label: string
  icon: string
  description: string
}

// ─── AI Prompt 模板 ───
export interface PromptTemplate {
  system: string
  outputFormat: string
}

// ─── 生产规则 ───
export interface ProductionRules {
  /** 推断默认时长（秒） */
  inferDuration: (input: CreativeInput) => number
  /** 推断集数 */
  inferEpisodeCount?: (input: CreativeInput) => number
  /** 断档提醒阈值（百分比） */
  budgetWarningThreshold: number
}

export interface CreativeInput {
  projectType: string
  creativeInput: string
  genre?: string
  visualStyle?: string
  aspectRatio?: string
  targetDuration?: number
}

// ─── Workspace 布局类型 ───
export type WorkspaceLayoutType = 'short-drama' | 'music' | 'advertisement'

// ─── 完整领域配置 ───
export interface WorkspaceConfig {
  /** 项目类型枚举值（与后端 Project.type 对齐） */
  projectType: string[]
  /** 显示名称 */
  label: string
  /** 布局组件类型 */
  layout: WorkspaceLayoutType
  /** Pipeline Stage 序列 */
  pipelineStages: PipelineStageDef[]
  /** AI Prompt 模板 */
  promptTemplate: PromptTemplate
  /** 生产规则 */
  productionRules: ProductionRules
  /** 展示用的描述 */
  description: string
  /** 领域图标 */
  icon: string
}

// ══════════════════════════════════════════════════════════
// 🎬 短剧工作台
// ══════════════════════════════════════════════════════════

const SHORT_DRAMA_STAGES: PipelineStageDef[] = [
  { key: 'script-analysis', label: '📖 故事', description: '故事剧本、角色、场景分析' },
  { key: 'character-design', label: '🎭 角色', description: '角色外观、服装、气质' },
  { key: 'scene-design', label: '🏙 场景', description: '场景氛围、光线、环境' },
  { key: 'storyboard', label: '🎬 分镜', description: '镜头语言、画面构图' },
  { key: 'video-generation', label: '🎥 视频', description: '逐段生成 AI 视频' },
  { key: 'music-generation', label: '🎵 声音', description: '主题曲与背景音乐' },
  { key: 'final-render', label: '✨ 发布', description: '合并所有素材输出成片' },
]

// ══════════════════════════════════════════════════════════
// 🎵 音乐工作台
// ══════════════════════════════════════════════════════════

const MUSIC_STAGES: PipelineStageDef[] = [
  { key: 'music-generation', label: '🎵 音乐创作', description: 'AI 作词 → 作曲 → 音乐合成' },
]

// ══════════════════════════════════════════════════════════
// 📢 广告工作台
// ══════════════════════════════════════════════════════════

const AD_STAGES: PipelineStageDef[] = [
  { key: 'storyboard', label: '🎬 分镜脚本', description: '脚本优化 + 分镜时间轴' },
  { key: 'video-generation', label: '🎥 视频生成', description: '广告视频合成' },
]

// ══════════════════════════════════════════════════════════
// 💼 求职招聘工作台
// ══════════════════════════════════════════════════════════

const JOB_STAGES: PipelineStageDef[] = [
  { key: 'job-career', label: '🪞 镜心 · AI 职业伙伴', description: '认识自己 · 规划方向 · 发现机会 · 提升竞争力' },
  { key: 'job-match', label: '🎯 岗位匹配', description: '智能推荐匹配岗位' },
  { key: 'job-enterprise', label: '🏢 企业招聘', description: '企业发布岗位、简历筛选' },
]

// ══════════════════════════════════════════════════════════
// 领域配置注册表
// ══════════════════════════════════════════════════════════

export const WORKSPACE_CONFIGS: Record<string, WorkspaceConfig> = {
  SHORT_DRAMA: {
    projectType: ['SHORT_DRAMA'],
    label: '短剧',
    layout: 'short-drama',
    icon: '🎬',
    description: '连续剧情内容',
    pipelineStages: SHORT_DRAMA_STAGES,
    promptTemplate: {
      system: '你是一位专业短剧编剧。请根据用户输入分析剧本结构、角色设定、场景描述、镜头语言。',
      outputFormat: '{ "summary": "string", "characters": [], "scenes": [], "shots": [], "episodeCount": 10, "sceneCount": 30, "shotCount": 120 }',
    },
    productionRules: {
      inferDuration: () => 180,
      inferEpisodeCount: () => 10,
      budgetWarningThreshold: 80,
    },
  },

  SHORT_VIDEO: {
    projectType: ['SHORT_VIDEO'],
    label: '短视频',
    layout: 'short-drama',
    icon: '📱',
    description: '15-180秒内容',
    pipelineStages: SHORT_DRAMA_STAGES,
    promptTemplate: {
      system: '你是一位短视频创作专家。请分析创意亮点、视觉风格、节奏控制。',
      outputFormat: '{ "summary": "string", "visualStyle": "string", "duration": 60 }',
    },
    productionRules: {
      inferDuration: () => 60,
      budgetWarningThreshold: 80,
    },
  },

  MV: {
    projectType: ['MV'],
    label: 'MV',
    layout: 'music',
    icon: '🎵',
    description: '音乐视觉作品',
    pipelineStages: MUSIC_STAGES,
    promptTemplate: {
      system: '你是一位MV导演。请根据音乐风格设计视觉叙事、画面节奏、色彩氛围。',
      outputFormat: '{ "summary": "string", "visualStyle": "string", "mood": "string" }',
    },
    productionRules: {
      inferDuration: () => 240,
      budgetWarningThreshold: 80,
    },
  },

  MUSIC: {
    projectType: ['MUSIC'],
    label: '音乐创作',
    layout: 'music',
    icon: '🎵',
    description: 'AI作词+作曲',
    pipelineStages: MUSIC_STAGES,
    promptTemplate: {
      system: '你是一位音乐创作人。请根据用户描述创作歌词，风格包括押韵、节奏感、情感表达。',
      outputFormat: '{ "title": "string", "lyrics": "string", "style": "string", "mood": "string" }',
    },
    productionRules: {
      inferDuration: () => 180,
      budgetWarningThreshold: 80,
    },
  },

  AD: {
    projectType: ['AD'],
    label: '广告片',
    layout: 'advertisement',
    icon: '📢',
    description: '品牌营销视频',
    pipelineStages: AD_STAGES,
    promptTemplate: {
      system: '你是一位广告创意总监。请优化广告脚本、设计分镜时间轴、输出视频生成参数。',
      outputFormat: '{ "narrative": "string", "shots": [], "dialogue": "string", "effects": "string", "totalTime": 30 }',
    },
    productionRules: {
      inferDuration: () => 30,
      budgetWarningThreshold: 80,
    },
  },

  JOB: {
    projectType: ['JOB'],
    label: '求职招聘',
    layout: 'short-drama',
    icon: '💼',
    description: 'AI求职助手 + 企业招聘',
    pipelineStages: JOB_STAGES,
    promptTemplate: {
      system: '你是一位AI职业顾问。请根据用户的学历、技能、经历、目标城市和薪资期望，生成职业画像，推荐匹配岗位。',
      outputFormat: '{ "profile": { "name": "string", "education": "string", "skills": [], "experience": "string", "city": "string", "salaryRange": "string", "careerGoal": "string" }, "recommendations": [] }',
    },
    productionRules: {
      inferDuration: () => 0,
      budgetWarningThreshold: 80,
    },
  },
}

// ─── 查询函数 ───

/** 根据 projectType 获取领域配置 */
export function getWorkspaceConfig(projectType: string): WorkspaceConfig {
  const cfg = WORKSPACE_CONFIGS[projectType]
  if (!cfg) {
    // 未知类型回退到短剧
    return WORKSPACE_CONFIGS.SHORT_DRAMA
  }
  return cfg
}

/** 根据 projectType 获取布局组件类型 */
export function getLayoutType(projectType: string): WorkspaceLayoutType {
  return getWorkspaceConfig(projectType).layout
}

/** 判断是否为短剧类（复用完整 Pipeline） */
export function isShortDramaType(projectType: string): boolean {
  return getWorkspaceConfig(projectType).layout === 'short-drama'
}

/** 获取 Pipeline Stage 序列 */
export function getPipelineStages(projectType: string): PipelineStageDef[] {
  return getWorkspaceConfig(projectType).pipelineStages
}

/** 推断默认时长 */
export function inferDuration(projectType: string): number {
  return getWorkspaceConfig(projectType).productionRules.inferDuration({
    projectType,
    creativeInput: '',
  })
}
