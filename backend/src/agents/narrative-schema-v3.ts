/**
 * Narrative Constitution V3 — World Model Schema
 *
 * ═══════════════════════════════════════════════════════════════
 * 陛下钦定（2026-06-24 12:30）：
 *
 * V2 的问题是 visualDesc 作为混合文本真相源，下游 Agent 被迫
 * 反解析。V3 的核心理念：
 *
 *   视觉描述 ≠ 源数据
 *   视觉描述 = 结构化信息坍缩后的产物
 *
 * 所有语义字段内联到 Segment，cameraLanguage[] 和 emotionCurve[]
 * 独立数组全部删除。Segment 是唯一真相源。
 *
 * 宪法原则：
 *   P1 — Segment 内联 Camera（替换独立 cameraLanguage[]）
 *   P2 — Segment 内联 Environment（替换独立 scenes[].environment 纯文本）
 *   P3 — Segment 内联 CharacterPresence（包含 emotion/focus）
 *   P4 — Segment 内联 Emotion（替换独立 emotionCurve[]）
 *   P5 — 删除 cameraLanguage[]
 *   P6 — 删除 emotionCurve[]
 *   P7 — visualDesc 降级为派生字段（非真相源）
 *   P8 — 禁止 Index-Based 关联，全部 Reference-Based
 *   P9 — 禁止下游 Agent 做叙事重建
 * ═══════════════════════════════════════════════════════════════
 */

// ─── Runtime IDs ──────────────────────────────────────

export type V3CharacterId = string // "char_001"
export type V3SceneId = string // "scene_001"
export type V3SegmentId = string // "seg_001"

// ─── Story Arc ────────────────────────────────────────

export interface V3StoryArc {
  setup: string
  conflict: string
  climax: string
  resolution: string
}

// ─── Character ────────────────────────────────────────

export interface V3CharacterSpec {
  id: V3CharacterId
  name: string
  alias: string
  age: string
  appearance: string    // 50+ 字外貌描述（AI 绘图输入）
  personality: string[] // 性格标签
  voiceGuide: string    // 配音指南
}

// ─── Scene ────────────────────────────────────────────

export interface V3SceneSpec {
  id: V3SceneId
  name: string        // 场景命名（如"血月废墟"），≤5 字
  location: string    // 地点类型：办公室/便利店/天台
  environment: V3EnvironmentBase  // 场景级环境基底
}

export interface V3EnvironmentBase {
  location: string    // 具体地点描述
  lighting: string    // 基础照明方案
  atmosphere: string  // 氛围基调
  colorPalette: string // 主色调描述
  weather?: string    // 天气（户外时）
  timeOfDay?: string  // 时段
}

// ─── Camera (Segment内联) ─────────────────────────────

export interface V3CameraState {
  shot: string      // close_up | medium | wide | extreme_close_up | medium_close_up | medium_wide | full
  movement: string  // static | push_in | pull_out | pan | tilt | tracking | crane | handheld | dolly
  angle: string     // eye_level | low_angle | high_angle | overhead | over_shoulder | dutch
  lens: string      // 24mm | 35mm | 50mm | 85mm | 135mm
}

// ─── Environment (Segment内联) ────────────────────────

export interface V3EnvironmentState {
  location: string    // 当前段落实际取景点
  lighting: string    // 该段落的照明状态
  atmosphere: string  // 该段落氛围
  weather?: string
  timeOfDay?: string
}

// ─── Character Presence (Segment内联) ─────────────────

export interface V3CharacterPresence {
  characterId: V3CharacterId
  role: 'primary' | 'secondary' | 'background'
  emotion: string     // 该段该角色的情绪
  focus: number       // 0-1，该段中该角色的画面聚焦权重
  action?: string     // 该段该角色的特定动作
}

// ─── Emotion (Segment内联) ────────────────────────────

export interface V3EmotionState {
  type: string       // 情绪类型：shock | calm | joy | anger | sadness | fear | disgust | surprise | neutral
  intensity: number  // 0-1，情绪强度
}

// ─── Action ───────────────────────────────────────────

export interface V3ActionState {
  primary: string    // 主要动作描述
  interaction?: string  // 人与环境/道具的交互
  expression?: string   // 面部表情
}

// ─── Segment (唯一真相源) ─────────────────────────────

export interface V3SegmentSpec {
  id: V3SegmentId
  sceneId: V3SceneId
  segmentNumber: number
  duration: number      // 12 秒

  // ══════════════════════════════════════════════
  // 内联语义层（P1-P4）—— 全部 Reference-Based
  // ══════════════════════════════════════════════

  /** P3 — 该段落出镜角色 */
  characters: V3CharacterPresence[]

  /** P2 — 该段落环境状态 */
  environment: V3EnvironmentState

  /** P1 — 该段落镜头状态（替代独立 cameraLanguage[]） */
  camera: V3CameraState

  /** 动作状态 */
  action: V3ActionState

  /** 对话文本（如有） */
  dialogue?: string

  /** P4 — 该段落主导情绪（替代独立 emotionCurve[]） */
  emotion: V3EmotionState

  // ══════════════════════════════════════════════
  // 派生字段（P7）—— 从结构化数据编译而来，非真相源
  // ══════════════════════════════════════════════

  /**
   * P7 — visualDesc 降级为派生字段
   *
   * 由 Compiler 从 camera + action + environment + emotion 编译而来。
   * 下游 Agent（Frame Designer / Render Spec Builder）不应再从 visualDesc
   * 反解析，而应直接引用内联的结构化字段。
   *
   * visualDesc 仅保留用于：
   *   1. 前端展示
   *   2. 向后兼容旧接口
   *   3. 视频模型最终 prompt 的上下文提示
   */
  visualDesc: string
}

// ─── Sound Design (Segment内联) ───────────────────────

export interface V3SoundDesignItem {
  segmentId: V3SegmentId
  ambient: string
  music: string
  effect: string
}

// ─── Effects Design (Segment内联) ─────────────────────

export interface V3EffectsDesignItem {
  segmentId: V3SegmentId
  visualEffect: string
  transition: string
}

// ─── Prop ─────────────────────────────────────────────

export interface V3PropSpec {
  id: string       // "prop_001"
  name: string
  category: string
  description: string
  function: string
  designNotes: string
}

// ─── Voice ────────────────────────────────────────────

export interface V3VoiceSpec {
  characterId: V3CharacterId
  voiceType: string
  timbre: string
  speed: string
  speakingStyle: string
}

// ─── Top-Level World Model Schema ─────────────────────

export interface NarrativeConstitutionV3 {
  title: string
  storyArc: V3StoryArc

  /** 角色库（供 characters[] 引用） */
  characters: V3CharacterSpec[]

  /** 场景库（供 sceneId 引用） */
  scenes: V3SceneSpec[]

  /**
   * 段落列表 — 全链路唯一真相源
   *
   * P5: 已删除独立 cameraLanguage[]
   * P6: 已删除独立 emotionCurve[]
   *
   * 所有语义信息内联在 segments 中。
   * 后续 Agent 直接读取 segment.camera / segment.environment / etc.
   * 不再需要 Index-Based 关联。
   */
  segments: V3SegmentSpec[]

  /** 音效设计 */
  soundDesign: V3SoundDesignItem[]

  /** 特效设计 */
  effectsDesign: V3EffectsDesignItem[]

  /** 音色 */
  voices: V3VoiceSpec[]

  /** 道具 */
  props: V3PropSpec[]
}
