/**
 * director-runtime/types.ts
 *
 * ⚔️ Phase 2.1 — Director Intelligence Layer
 *
 * 陛下钦定宪法：
 *   Director Runtime = Narrative Layer ONLY
 *   Execution Spine  = Media Layer ONLY
 *   两者之间必须有不可逆转换边界
 *
 * v2.1 升级：从"规则结构生成器"升级为"可编译叙事规划系统"
 *   - 新增 narrativeLogic: 因果图 + 张力流 + 节奏模型
 *   - 新增 NarrativeNode/NarrativeEdge: 事件因果网络
 *   - 新增 compileGraphToBlueprints: 因果图 → Blueprint 种子
 *
 * 宪法规则（不变）：
 *   1. Director 的唯一输出是 DirectorPlan
 *   2. DirectorPlan 只包含叙事结构，不包含任何视觉参数
 *   3. Director 不得感知 prompt / camera / vfx / lighting / motion
 *   4. Director 不得知道 Provider 存在
 *   5. Director 不得知道 Blueprint 结构细节
 *   6. director-to-blueprint-compiler 是唯一合规的转换器
 *
 * 违禁词表（不变）：
 *   prompt, compiledPrompt, camera, cameraDirectives, shotType,
 *   movement, lens, lighting, vfx, motion, shotGraph, shotPlan,
 *   styleTokens, styleKeywords, providerVideoInput, providerNativePayload
 */

// ── 输入边界 ──

export interface DirectorInput {
  userIntent: string
  constraints?: DirectorConstraints
  referenceMaterial?: DirectorReference
}

export interface DirectorConstraints {
  /** 目标时长（秒） */
  targetDuration?: number
  /** 叙事节奏倾向 */
  pacing?: 'slow' | 'normal' | 'fast'
  /** 风格倾向（仅文本描述，不涉及视觉参数） */
  styleTendency?: string
  /** 情绪基调 */
  mood?: string
  /** 禁止出现的叙事元素 */
  prohibited?: string[]
  /** 目标观众 */
  targetAudience?: string
}

export interface DirectorReference {
  /** 原故事文本 */
  storyText?: string
  /** 角色设定 */
  characterProfiles?: Array<{ name: string; personality: string; role: string }>
  /** 参考作品名称 */
  referenceWorks?: string[]
}

// ── 叙事因果图（Narrative Graph） ──

/**
 * NarrativeNode — 事件节点
 *
 * 一个事件 = 一个"观众应该注意到"的叙事原子单元。
 * 不包含任何视觉描述，只回答"发生了什么"和"为什么重要"。
 */
export interface NarrativeNode {
  id: string
  /** 事件标题 */
  label: string
  /** 事件描述（仅叙事，不写画面） */
  description: string
  /** 情感标签 */
  emotion: string
  /** 相对时间轴位置（0-1） */
  position: number
  /** 事件重要性（0-1） */
  weight: number
  /** 所属场景段 */
  sceneId: string
}

/**
 * NarrativeEdge — 事件因果关系
 *
 * Edge 回答"为什么下一个事件必然发生"，而不是"时间上紧接着"。
 * 不允许的 edge 类型："同时发生"、"过渡到"（这些是时间关系，非因果）
 */
export interface NarrativeEdge {
  sourceId: string
  targetId: string
  /** 因果关系描述 */
  relation: 'causes' | 'enables' | 'resolves' | 'contrasts'
  /** 为什么存在这个因果 */
  rationale: string
}

/**
 * NarrativeGraph — 事件因果网络
 *
 * 核心结构：事件节点 + 因果关系边。
 * 用于指导 Blueprint 编译器的 shot 排序和情绪控制。
 *
 * 禁止：
 *   ❌ 任何视觉/摄影/渲染节点
 *   ❌ 任何时间轴关系（那是视频的，不是叙事的）
 *   ❌ 任何"镜头"概念
 */
export interface NarrativeGraph {
  nodes: NarrativeNode[]
  edges: NarrativeEdge[]
}

// ── DirectorPlan — 叙事规划器输出（v2.1 升级版） ──

/**
 * DirectorPlan — Director Runtime 唯一输出。
 *
 * 这是一个纯叙事结构，不包含任何视觉/摄影/渲染参数。
 * 所有描述应回答"观众应该理解/感受到什么"，而非"画面上应该出现什么"。
 *
 * v2.1 新增：
 *   - narrativeLogic: 因果图 + 张力流 + 节奏模型
 *   - narrativeGraph: 事件因果网络（NarrativeGraph）
 *
 * 对 Blueprint 的编译影响（由 compiler 实现，Director 不感知）：
 *   - sceneSegmentation → shotGraph seed
 *   - narrativeLogic.tensionFlow → emotional pacing control
 *   - narrativeLogic.causeEffectGraph → shot ordering hints
 *   - narrativeGraph → blueprint scene structure priority
 */
export interface DirectorPlan {
  /** 叙事意图 — 观众应该理解什么 */
  narrativeIntent: string

  /** 情绪曲线 — 全剧情绪走向 */
  emotionalArc: string[]

  /** 场景划分 — 纯剧情段，不含视觉参数 */
  sceneSegmentation: Array<{
    id: string
    narrativePurpose: string  // 此段在故事中的作用
    emotionalTone: string     // 此段应该传达的情绪
    summary: string           // 剧情概要（仅叙事，不写画面）
  }>

  /** 🔬 v2.1 叙事逻辑 — 因果、张力、节奏 */
  narrativeLogic: {
    /** 事件因果关系链 */
    causeEffectGraph: string[]
    /** 张力流（各时间点张力值） */
    tensionFlow: string[]
    /** 节奏模型描述 */
    pacingModel: string
  }

  /** 🔬 v2.1 事件因果网络（用于指导编译器） */
  narrativeGraph: NarrativeGraph

  /** 叙事约束 */
  narrativeConstraints?: {
    pacing: 'slow' | 'normal' | 'fast'
    climaxPosition?: number   // 高潮位置（0-1）
    themeKeywords?: string[]  // 主题关键词
  }

  /** 元信息 */
  meta: {
    timestamp: number
    inputSource: 'user_text' | 'story_analysis' | 'template'
    version: string
  }
}

// ── 输出边界守卫（不变，违禁词表同 v2.0） ──

const DIRECTOR_FORBIDDEN_FIELDS = [
  'prompt', 'compiledPrompt', 'narrative', 'dialogue',
  'camera', 'cameraDirectives', 'shotType', 'movement', 'lens',
  'lighting', 'lightingDirective',
  'vfx', 'vfxDirectives',
  'motion', 'motionDirectives',
  'shotGraph', 'shotPlan', 'shotScript',
  'styleTokens', 'styleKeywords',
  'providerVideoInput', 'providerNativePayload',
  'provider', 'adapter',
]

/**
 * assertNoDirectorLeak — 运行时字段泄漏检测
 *
 * 检查产出对象是否包含 Director 禁止输出的技术字段。
 * v2.1 增强：对 NarrativeGraph 的 node/edge 同样执行深度检查。
 */
export function assertNoDirectorLeak(plan: unknown): asserts plan is DirectorPlan {
  if (!plan || typeof plan !== 'object') {
    throw new Error('[DIRECTOR_VIOLATION] Director 输出非对象')
  }

  const obj = plan as Record<string, unknown>
  const leaked: string[] = []

  function walk(value: unknown, path: string) {
    if (!value || typeof value !== 'object') return
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const fullPath = path ? `${path}.${key}` : key
      if (DIRECTOR_FORBIDDEN_FIELDS.includes(key)) {
        leaked.push(fullPath)
      }
      walk((value as Record<string, unknown>)[key], fullPath)
    }
  }

  walk(obj, '')

  if (leaked.length > 0) {
    const msg = `[DIRECTOR_VIOLATION] Director 输出检测到违规字段: ${leaked.join(', ')}`
    console.error(msg)
    throw new Error(msg)
  }
}

// ── Director Runtime 接口（Phase 3 升级） ──

export interface DirectorRuntime {
  /** 分析用户意图，生成叙事计划 */
  analyze(input: DirectorInput): Promise<DirectorPlan>

  /** 将叙事计划编译为 VideoBlueprint */
  compile(plan: DirectorPlan): Promise<Record<string, unknown>>

  /** Phase 3: 获取叙事变体（2-3 个候选项） */
  getVariants?(plan: DirectorPlan, count?: number): Promise<DirectorPlan[]>
}
