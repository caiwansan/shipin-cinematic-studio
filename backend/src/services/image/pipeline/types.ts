// ============================================================
// Pipeline Types — 短剧工作台制片厂执行内核类型定义
//
// 设计原则：
//   每个 stage 接收 I 返回 O，通过 PipelineStage<I,O> 强类型化
//   ExecutionContext 携带跨 stage 的 trace/identity/bible 信息
//   ValidationResult 只做“质量判定”，不触发 retry
// ============================================================

// ─── 执行上下文（D4/D5/D7/D8 预埋） ────────────────────

/** Phase 4.1: AnchorSync 约束视图（validate.stage 自动注入） */
export interface SyncConstraints {
  lighting?: {
    preferred: string
    conflictSources: string[]
    conflictSignals: string[]
  }
  spatial?: {
    layout: string
    source: string
  }
  identity?: {
    characterName: string
    visualExpectations: string[]
  }
}

export interface ExecutionContext {
  projectId: string
  stage: 'character' | 'scene' | 'storyboard' | 'frame' | 'video'
  traceId: string

  /** D4: Identity Lock — 角色 DNA 版本锚定 */
  identityLockId?: string

  /** D5: Scene Bible — 场景圣经 ID */
  sceneBibleId?: string

  /** Phase 4.1: AnchorSync 约束视图（validate.stage 自动注入） */
  syncConstraints?: SyncConstraints

  /** Phase 4.1: CNL — 归一化约束空间（D2-ready） */
  normalizedConstraints?: Array<{
    type: string
    strength: number
    scope: string
    priority: number
    domainWeight: number
    rawValue: string
  }>

  /** Phase 4.1: CDML — 决策偏置场 */
  decisionBiasField?: {
    biases: Array<{
      source: string
      target: string
      influenceType: string
      weight: number
      priority: number
      rawValue: string
      transform: { intent: string; implemented: boolean }
    }>
    integritySeal: string
    summary: string
  }

  /** Phase 4.1: DEIP — D2 输入决策图（bias 已注入结构） */
  d2InputGraph?: {
    nodes: Array<{
      id: string
      type: string
      label: string
      locked: boolean
    }>
    edges: Array<{
      from: string
      to: string
      weight: number
      label: string
      active: boolean
    }>
    integritySeal: string
  }

  /** Phase 4.1: Prompt drift proxy — 已执行的最终 prompt（trace 用） */
  finalPrompt?: string

  /** Phase 4.1: Telemetry（非侵入式观测存储） */
  telemetry?: Record<string, unknown>
}

// ─── Pipeline Stage 接口 ───────────────────────────────

export interface PipelineStage<I, O> {
  name: string
  execute(input: I, ctx: ExecutionContext): Promise<O>
}

// ─── Image Task 输入 ───────────────────────────────────

export interface ImageTaskInput {
  prompt: string
  negativePrompt: string
  projectId: string
  source: string
  characterName?: string
  seed?: number
  referenceImage?: string
  referenceImages?: string[]
}

// ─── Submit Stage 输出 ─────────────────────────────────

export interface SubmitOutput {
  taskId: string
}

// ─── Poll Stage 输出 ──────────────────────────────────

export interface PollOutput {
  taskId: string
  imageUrl: string
  duration: number
}

// ─── PostProcess Stage 输出 ───────────────────────────

export interface PostProcessOutput {
  taskId: string
  imageUrl: string
  duration: number
}

// ─── Validation ────────────────────────────────────────

export interface ValidationHook {
  name: string
  validate(imageUrl: string, ctx: ExecutionContext): Promise<ValidationOutcome>
}

export interface ValidationOutcome {
  passed: boolean
  score: number
  issues: string[]
}

export interface ValidateOutput {
  taskId: string
  imageUrl: string
  duration: number
  validation: {
    passed: boolean
    issues: string[]
    score: number
    /** D2: 可选的质量等级标签 */
    tier?: string
  }
  /** D2: 可选的质量决策 */
  decision?: Record<string, unknown>
}

// ─── Pipeline 最终输出 ────────────────────────────────

export interface PipelineOutput {
  imageUrl: string
  taskId: string
  validation: {
    passed: boolean
    issues: string[]
    score: number
  }
  /** D2: 可选的质量决策 */
  decision?: Record<string, unknown>
  traceId: string
}

// ─── Retry ─────────────────────────────────────────────

export interface RetryPolicy {
  maxRetries: number
  backoffMs: number
}

export const DEFAULT_RETRY: Record<string, RetryPolicy> = {
  character:  { maxRetries: 2, backoffMs: 3000 },
  scene:      { maxRetries: 2, backoffMs: 3000 },
  storyboard: { maxRetries: 2, backoffMs: 3000 },
  video:      { maxRetries: 1, backoffMs: 5000 },
}

// ─── 链路错误 ──────────────────────────────────────────

export interface PipelineError {
  stage: string
  error: Error
  traceId: string
}
