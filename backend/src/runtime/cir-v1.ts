/**
 * CIR — Cinematic Intermediate Representation v1.0
 *
 * Director Agent 和所有创作 Agent 的唯一输出格式。
 * Agent 禁止直接输出 Prompt，只输出 CIR。
 * Prompt 是 Compiler 的产物，不是 Agent 的产物。
 *
 * 架构定位：
 *   Story → CIR → Compiler → Provider Prompt
 *                ↓
 *          Capability Benchmark（评测入口）
 *                ↓
 *          Optimization Engine（输出 CIR Patch）
 *                ↓
 *          Learning Memory（存储 CIR + Analytics）
 */

/** CIR 版本 */
export const CIR_VERSION = '1.0'

// ─── 环境/场景 ──────────────────────────

export interface CirEnvironment {
  /** 地点类型（室内/室外/特定场所） */
  location: string
  /** 时间段 */
  timeOfDay: string
  /** 天气 */
  weather: string
  /** 氛围基调 */
  atmosphere: string
  /** 色调倾向 */
  colorPalette?: string
}

// ─── 角色 ────────────────────────────────

export interface CirCharacter {
  id: string
  name: string
  alias: string
  gender: string
  age?: string
  appearance: string
  personality: string[]
  emotion: string
  voiceGuide?: string
}

// ─── 摄影 ────────────────────────────────

export interface CirCameraPath {
  /** 路径描述（track/dolly/arc/crane/handheld/static） */
  type: string
  /** 起点 */
  startPosition?: string
  /** 终点 */
  endPosition?: string
  /** 运动平滑度要求 */
  smoothness?: 'fluid' | 'stable' | 'rough' | 'shaky'
}

export interface CirCameraMotion {
  /** 运动模式 */
  pattern: string
  /** 速度曲线 */
  speedCurve?: string
}

export interface CirCameraFocus {
  /** 焦点目标 */
  target: string
  /** 景深要求 */
  depthOfField?: 'shallow' | 'medium' | 'deep'
  /** 是否需要移焦 */
  rackFocus?: {
    cue: string
    fromTarget: string
    toTarget: string
  }
}

export interface CirCamera {
  path?: CirCameraPath
  motion?: CirCameraMotion
  composition?: {
    /** 构图规则 */
    rule: string
    /** 主体位置 */
    subjectPosition?: string
    /** 视线方向保留空间 */
    lookRoomDirection?: string
    /** 头顶空间类型 */
    headroom?: string
  }
  scale?: string       // establishing / wide / medium / close_up / extreme_close_up
  angle?: string       // eye / low / high / dutch / overhead
  focus?: CirCameraFocus
}

// ─── 灯光 ────────────────────────────────

export interface CirLighting {
  /** 主光源方向 */
  keyLightDirection: string
  /** 色温（warm/cool/neutral） */
  colorTemperature: string
  /** 环境氛围 */
  mood: string
  /** 是否锁定灯光连续性（切镜保持） */
  continuity: boolean
}

// ─── 镜头 ────────────────────────────────

export interface CirShot {
  id: string
  /** 镜头描述（语义描述，非 prompt） */
  description: string
  /** 镜头时长（秒） */
  durationSeconds: number
  /** 画面中的角色 ID 列表 */
  characterIds: string[]
  /** 动作 */
  actions: string[]
  /** 对话 */
  dialogue: string[]
  camera: CirCamera
  lighting?: CirLighting
  /** 音效/环境音 */
  audioCue?: string
  /** 叙事目的 */
  narrativePurpose?: string
}

// ─── 叙事 ────────────────────────────────

export interface CirStoryIntent {
  /** 故事层意图（如 protagonist_loses_control） */
  story: string
  /** 电影语言层意图（如 vulnerability / power_dynamics） */
  cinematic: string
  /** 灯光设计意图 */
  lighting?: string
  /** 视觉风格意图 */
  visual?: string
}

// ─── 主结构 ──────────────────────────────

export interface CirV1 {
  /** CIR 版本号 */
  version: string
  /** 场景元信息 */
  scene: {
    title: string
    environment: CirEnvironment
  }
  /** 角色清单 */
  characters: CirCharacter[]
  /** 镜头序列 */
  shots: CirShot[]
  /** 叙事意图 */
  storyIntent: CirStoryIntent
  /** 约束条件 */
  constraints?: {
    /** 生成时长上限（秒） */
    maxDuration?: number
    /** FPS */
    fps?: number
    /** 分辨率 */
    resolution?: string
  }
  /** Provider 提示（不解引用，仅供 Compiler 参考） */
  providerHints?: Record<string, unknown>
  /** 元信息 */
  metadata?: {
    generatedBy: string       // agent name
    sourceStoryId?: string
    projectId?: string
    createdAt: string         // ISO timestamp
  }
}
