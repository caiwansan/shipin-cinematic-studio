// ============================================================
// NarrativeIR — Canonical Narrative Intermediate Representation
// Phase 1: IR Schema Definition
// 
// 铁律（不可违反）：
// 1. 不存"结果" — 无 prompt/image/video 字段
// 2. Beat 是唯一时间轴 — scene/segment 无独立时间
// 3. Intent Graph 驱动跳转 — 禁止线性 breakdown 驱动流程
// ============================================================

// ─── Scene Layer: 空间语义 + 叙事功能 ────────────────────
export interface IRScene {
  id: string
  order: number
  location: string
  /** 叙事功能，非描述。如 "introduce protagonist tension", "raise conflict pressure" */
  purpose: string
}

// ─── Character State Layer: 动态角色状态投影 ─────────────
export interface IRCharacterState {
  emotion: string           // 当前情绪
  objective: string         // 当前目标
  tensionLevel: number      // 0-1 张力等级
}

export interface IRCharacter {
  id: string
  name: string
  state: IRCharacterState
}

// ─── Beat Layer: 最小叙事动作单元（唯一时间轴）───────────
export type CameraIntent =
  | 'slow-push-in'
  | 'handheld-instability'
  | 'static-tension-framing'
  | 'dolly-zoom'
  | 'wide-establishing'
  | 'close-up-reveal'
  | 'over-the-shoulder'
  | 'tracking-follow'
  | 'aerial-establishing'
  | 'low-angle-power'
  | 'high-angle-vulnerability'
  | 'dutch-angle-instability'
  | 'panscan-discover'
  | 'steady-contemplation'
  | 'rapid-cut-action'

export interface IRBeat {
  /** 时间轴（毫秒，从 0 开始） */
  t: number
  /** 发生什么 — 纯动作语义 */
  action: string
  /** 情绪状态 */
  emotion: string
  /** 可视化约束提示 */
  visualHint: string
  /** ⚠️ 镜头意图 — 不可省略 */
  cameraIntent: CameraIntent
}

// ─── Segment Layer: 叙事控制块 ───────────────────────────
export type NarrativeFunction =
  | 'setup'
  | 'rising-tension'
  | 'climax-building'
  | 'climax'
  | 'falling-action'
  | 'resolution'
  | 'transition'
  | 'flashback'
  | 'montage'

export interface IRSegment {
  id: string
  sceneId: string
  narrativeFunction: NarrativeFunction
  beats: IRBeat[]
}

// ─── Intent Graph Layer: 因果驱动 ────────────────────────
export type IntentType =
  | 'desire'
  | 'conflict'
  | 'revelation'
  | 'reversal'
  | 'consequence'

export interface IRIntentNode {
  id: string
  type: IntentType
  /** 来源 Beat ID */
  sourceBeatId: string
  /** 目标 Beat ID */
  targetBeatId: string
  /** 因果强度 0-1 */
  weight: number
  /** 因果极性：positive=驱动, negative=抑制 */
  polarity: -1 | 1
}

export interface IRCausalEdge {
  sourceId: string
  targetId: string
  intentId: string
}

// ─── Graph Layer: 贯穿所有 node 的因果图 ────────────────
export interface IRGraph {
  nodes: IRIntentNode[]
  edges: IRCausalEdge[]
  /** 故事入口 Beat ID 列表 */
  entryPoints: string[]
  /** 故事出口 Beat ID 列表 */
  exitPoints: string[]
}

// ─── NarrativeIR: 顶层容器（唯一 Canonical 输出）────────
export interface NarrativeIR {
  id: string
  projectId: string
  version: 'v1'
  scenes: IRScene[]
  characters: IRCharacter[]
  segments: IRSegment[]
  graph: IRGraph
  globalTone: string
  createdAt: number
}
