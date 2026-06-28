/**
 * Style Evolution — 类型定义
 *
 * v5: Cinematic Style Evolution Engine
 *
 * 核心定位：
 * - 跨 project 风格记忆（不污染 physics/bias/slack）
 * - 只影响 prompt 层
 * - 带 anti-collapse 保护
 */

// ============================================================
// Style Node — 单项目风格向量
// ============================================================

export interface StyleNode {
  projectId: string
  /** 时间戳（ms） */
  timestamp: number
  /** 项目强度（0-1），越旧的项目权重越小 */
  strength: number
  /** 三维风格向量 */
  visualBiasVector: number[]      // 色彩/构图倾向
  cameraBiasVector: number[]      // 运镜倾向
  emotionBiasVector: number[]     // 情绪倾向
  /** 源数据快照（用于审计） */
  sourceSnapshot: {
    biasRound: number
    slackConsumed: number
    avgSlackInfluence: number
    constraintCount: number
  }
}

// ============================================================
// Style Edge — 项目间风格转移
// ============================================================

export interface StyleTransition {
  fromProjectId: string
  toProjectId: string
  /** 风格变化向量（to - from） */
  deltaVisual: number[]
  deltaCamera: number[]
  deltaEmotion: number[]
  transitionTime: number
}

// ============================================================
// Style Memory Graph
// ============================================================

export interface StyleMemoryGraph {
  nodes: StyleNode[]
  edges: StyleTransition[]
  lastUpdated: number
}

// ============================================================
// Style Vector（一次运行的输出）
// ============================================================

export interface StyleRunVector {
  projectId: string
  visual: number[]
  camera: number[]
  emotion: number[]
  strength: number
}

// ============================================================
// Style Aggregation — 跨 project 聚合结果
// ============================================================

export interface StyleAggregationResult {
  /** 全局风格向量（attention-weighted） */
  globalVisual: number[]
  globalCamera: number[]
  globalEmotion: number[]
  /** 各维度的分散度（用于 entropy 检测） */
  varianceVisual: number
  varianceCamera: number
  varianceEmotion: number
  /** 参与的 project 数量 */
  nodeCount: number
  /** 聚合强度（0-1），新项目时低 */
  confidence: number
}

// ============================================================
// Divergence Controller
// ============================================================

export interface DivergenceControlOutput {
  /** 是否需要注入探索噪声 */
  needsExploration: boolean
  /** 当前 entropy 水平 */
  entropyScore: number
  /** 注入的噪声强度（0-0.1） */
  explorationStrength: number
  /** 各维度噪声向量 */
  explorationVector: {
    visual: number[]
    camera: number[]
    emotion: number[]
  }
}

// ============================================================
// 向量化输入
// ============================================================

export interface StyleVectorizationInput {
  projectId: string
  /** Bias layer 当前偏置 */
  biasEntries: Array<{ key: string; currentBias: number }>
  /** Slack engine 本次输出 */
  slackInfluenceScores: number[]
  slackConsumed: number
  /** Prompt compiler 变形统计 */
  promptDeformationStats: {
    avgSlackInfluenceScore: number
    shotCount: number
    driftDimensions: Record<string, number>  // cameraDrift 均值等
  }
  /** 当前 constraint count */
  constraintCount: number
  biasRound: number
}

// ============================================================
// Style Injection — 注入到 prompt
// ============================================================

export interface StyleInjectionSignal {
  /** 是否生效 */
  active: boolean
  /** 风格影响强度（0-0.4） */
  influenceScore: number
  /** 各维度漂移量 */
  styleDrift: {
    visual: number
    camera: number
    emotion: number
  }
  /** 注入的 prompt 片段 */
  promptTokens: string[]
}

// ============================================================
// API 输出
// ============================================================

export interface StyleEvolutionAPIOutput {
  projectStyleVector: {
    visual: number[]
    camera: number[]
    emotion: number[]
  }
  globalStyleVector: {
    visual: number[]
    camera: number[]
    emotion: number[]
  }
  styleInfluenceScore: number
  styleDrift: {
    visual: number
    camera: number
    emotion: number
  }
  /** 防 collapse 诊断 */
  divergenceStatus: {
    entropyScore: number
    collapsed: boolean
    explorationInjected: boolean
  }
}
