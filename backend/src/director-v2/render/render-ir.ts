/**
 * render-ir.ts — Phase 6D.1: RenderIR Type Schema (Versioned)
 *
 * 这是 CinematicRenderIR 的独立类型定义。
 * 与 render-adapter.ts 的类型定义同步更新，但独立管理版本号。
 *
 * 版本规则：
 *   MAJOR — 结构不兼容变更（如有字段被删除/重命名）
 *   MINOR — 新增字段（向后兼容）
 *   PATCH — 字段语义 clarification（不影响序列化结构）
 *
 * 当前版本：1.0.0
 */

// ============================================================
// CinematicRenderIR — 完整指令集
// ============================================================

export interface CinematicRenderIR {
  /** Schema version (MAJOR.MINOR.PATCH) */
  version: string
  /** 全局唯一 ID */
  irId: string
  /** SHA-256 完整性锁 */
  hash: string
  /** 源 session */
  sessionId: string

  /** 场景链 */
  sceneChain: RenderScene[]
  /** 镜头链（全量拍平） */
  shotChain: RenderShot[]
  /** 帧指令集 */
  frameInstructions: FrameInstruction[]

  /** 全局约束 */
  constraints: IRConstraints
  /** 时间连续性锚点 */
  temporalAnchors: TemporalAnchors

  /** 元数据（不可用于 hash 运算） */
  metadata: IRMetadata
}

// ============================================================
// Scene / Shot / Frame
// ============================================================

export interface RenderScene {
  sceneId: string
  index: number
  mood: string
  pacing: 'slow' | 'moderate' | 'fast'
  narrativeFunction: string
  emotionalWeight: number
  /** 关联的 shotId 列表 */
  shots: string[]
  forbiddenStates: string[]
}

export interface RenderShot {
  shotId: string
  sceneId: string
  shotType: string
  emotionalTension: 'low' | 'medium' | 'high'
  colorGuide: ColorGuide
  motionIntensity: number
  cameraMotion: string
  visualKeywords: string[]
  /** 关联的 frameId 列表 */
  frameIds: string[]
}

export interface FrameInstruction {
  frameId: string
  type: 'opening' | 'key_frame' | 'transition' | 'closing'
  contrast: number
  brightnessOffset: number
  renderDescription: string
  forbiddenStyles: string[]
}

// ============================================================
// Supporting types
// ============================================================

export interface ColorGuide {
  primary: string
  palette: string
  lighting: string
}

export interface IRConstraints {
  characterContinuity: boolean
  visualConsistency: boolean
  toneLocked: boolean
  maxMotionIntensity: number
  forbiddenVisualStates: string[]
}

export interface TemporalAnchors {
  /** 所有出现过的角色（由 intent/projection 层推断） */
  characters: string[]
  /** 所有出现过的场景位置 */
  locations: string[]
  /** 关键道具/物体 */
  objects: string[]
}

export interface IRMetadata {
  createdAt: number
  sourceProjectTitle: string
  stabilityAtCompile: string
}

// ============================================================
// IR Policy — 不可变字段定义
// ============================================================

export const IR_POLICY = {
  /** 用于 hash 运算的字段（不可变部分） */
  hashableFields: [
    'sceneChain',
    'shotChain',
    'frameInstructions',
    'constraints',
    'temporalAnchors',
  ] as const,

  /** 禁止的后编译突变 */
  forbiddenMutations: [
    'post-compilation modification',
    'backend override of structure',
    'prompt rewrite of IR scene/shot/frame chain',
  ] as const,

  enforcement: 'STRICT' as const,
}
