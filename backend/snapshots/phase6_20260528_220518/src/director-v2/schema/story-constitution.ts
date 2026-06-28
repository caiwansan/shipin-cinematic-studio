/**
 * Story Constitution — 导演系统语义宪法
 *
 * 这是整个导演系统的「语义真相源」（Single Source of Truth）。
 * 所有下游 agent 只读消费此契约，严禁修改。
 *
 * 核心设计原则：
 * 1. Immutable — constitution 一旦生成，agent 不可修改
 * 2. Versioned — 每个 constitution 携带 schemaVersion + constitutionVersion
 * 3. Typed — 消灭 any，所有字段有精确 TS 类型
 * 4. Traceable — 携带生成 traceId 和时间戳
 */

import type { ScriptSourceInfo } from './script-source.js'
import type {
  EmotionalArc,
  EmotionalArcSegment,
} from './emotional-arc.js'
import type { VisualDoctrine } from './visual-doctrine.js'
import type { PacingDoctrine } from './pacing-doctrine.js'
import type { CinematicIdentity } from './cinematic-identity.js'
import type { CharacterLaw } from './character-law.js'
import type { WorldPhysics } from './world-physics.js'
import type { ToneBoundary } from './tone-boundary.js'

// ============================================================
// StoryConstitution — 宪法本体
// ============================================================

export interface StoryConstitution {
  /** schema 版本号（由本文件控制，提升大版本号表示破坏性变更） */
  schemaVersion: string

  /** constitution 实例版本（由编译器生成，语义化版本） */
  constitutionVersion: string

  /** 项目归属 */
  projectId: string

  /** 生成时间戳 */
  createdAt: number

  /** 追踪 ID（关联 narrative gateway trace） */
  traceId: string

  // ==================== 核心语义字段 ====================

  /** 故事核心主题（一句话） */
  coreTheme: string

  /** 情感弧线 — 整部作品的情感演变轨迹 */
  emotionalTrajectory: EmotionalArc

  /** 视觉教义 — 整部作品的视觉风格宪章 */
  visualDoctrine: VisualDoctrine

  /** 节奏教义 — 整部作品的节奏控制宪章 */
  pacingDoctrine: PacingDoctrine

  /** 电影身份 — 导演风格的认同标识 */
  cinematicIdentity: CinematicIdentity

  /** 角色法则 — 角色一致性和视觉锁定规则 */
  characterLaws: CharacterLaw[]

  /** 世界物理 — 世界观/物理规则定义 */
  worldPhysics: WorldPhysics

  /** 基调边界 — 可接受/不可接受的风格边界 */
  toneBoundaries: ToneBoundary[]

  /** 禁用风格列表 — 明确禁止使用的风格元素 */
  forbiddenStyles: string[]

  // ==================== 元数据 ====================

  /** 信息来源（原始剧本/用户输入） */
  source: ScriptSourceInfo

  /** 编译置信度（0-1，LLM 输出经归一化后的可信度） */
  confidence: number

  /** 是否整体降级（某些字段被 fallback 填充） */
  degraded: boolean

  /** 降级原因（degraded=true 时必填） */
  degradeReason?: string
}

// ============================================================
// 默认值工厂 — 用于完全降级时的安全兜底
// ============================================================

/**
 * 创建一个安全的默认 Constitution（所有 LLM 调用失败时使用）
 * 注意：这个默认值虽然是合法的 typing，但它不包含任何创造性决策。
 * Review Engine 应该检测 degraded=true 并标记为高风险。
 */
export function createDefaultConstitution(
  projectId: string,
  traceId: string,
  options?: { reason?: string },
): StoryConstitution {
  return {
    schemaVersion: '1.0',
    constitutionVersion: '1.0.0',
    projectId,
    createdAt: Date.now(),
    traceId,

    coreTheme: '未解析',
    emotionalTrajectory: {
      dominantEmotion: '中性',
      arcType: 'linear',
      segments: [],
      peakIntensity: 5,
      resolutionTone: '中性',
    },
    visualDoctrine: {
      colorDoctrine: {
        primaryPalette: ['#808080'],
        accentPalette: [],
        colorSymbolism: {},
        temperatureBias: 'neutral',
      },
      lightingDoctrine: {
        baseApproach: 'natural',
        keySceneExceptions: [],
      },
      cameraDoctrine: {
        defaultLensBias: '50mm',
        preferredMotions: ['static'],
        motionIntensityRange: [1, 3],
      },
      compositionDoctrine: {
        defaultComposition: 'rule_of_thirds',
        depthBias: 'medium',
      },
    },
    pacingDoctrine: {
      structureType: 'three_act',
      hookDensity: 'moderate',
      beatMap: [],
      climaxPlacement: 0.75,
      pacingCurve: 'crescendo',
    },
    cinematicIdentity: {
      primaryInfluences: [],
      signatureElements: [],
        eraTags: [],
      visualConsistencyLevel: 'standard',
    },
    characterLaws: [],
    worldPhysics: {
      environmentType: 'realistic',
      timePeriod: 'contemporary',
      physicsAnomalies: [],
      scale: 'human',
    },
    toneBoundaries: [
      {
        dimension: 'humor',
        min: 0,
        max: 3,
        note: '默认值：降级模式',
      },
    ],
    forbiddenStyles: [],

    source: {
      type: 'unknown',
      originalLength: 0,
      language: 'zh-CN',
    },
    confidence: 0,
    degraded: true,
    degradeReason: options?.reason || 'LLM 全部失败，使用默认兜底 Constitution',
  }
}
