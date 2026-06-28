/**
 * PHASE B — PromptIR Canonical Schema
 *
 * SINGLE SOURCE OF TRUTH
 * All AI video generation must use this structure.
 * No narrative / flat fields are allowed in downstream processing.
 *
 * ⚠️ This replaces all scattered inline PromptIR interfaces across:
 *   - ai-optimize-shot.ts
 *   - optimize-video-agent.ts
 *   - ai-optimize-ad-script.ts
 *   - ai-optimize-frame-prompt.ts
 *
 * LLM reinterpretation is eliminated at the type level:
 *   - promptIR is the ONLY semantic authority
 *   - downstream processing must be deterministic (no LLM)
 *   - narrative/dialogue/effects must NOT be passed as flat fields
 */

export interface PromptIR {
  /** 剧情语义层（唯一的叙事解释） */
  script: {
    narrative: string
    dialogue: string
    effects: string
    emotion?: string
    negativePrompt?: string
  }
  /** 分镜/角色/场景结构层 */
  breakdown: {
    shots: Shot[]
    characters: Character[]
    scenes: Scene[]
  }
  /** 渲染层（可选，通常由 compiler 填充） */
  render?: RenderSpec
}

export interface Shot {
  second: number
  camera: string
  movement?: string
  action: string
  subject?: string
  environment?: string
  effect?: string
  dialogue?: string
  expression?: string
  dubbingTiming?: string
}

export interface Character {
  name: string
  appearance: string
  imageUrl?: string
}

export interface Scene {
  name: string
  environment: string
  imageUrl?: string
  lighting?: string
}

export interface RenderSpec {
  style?: string
  camera?: string
  fps?: number
  duration?: number
}

/**
 * VideoPromptSpec — Video Compiler 输出契约
 * 确定性映射后的结构化视频 prompt
 */
export interface VideoPromptSpec {
  camera: {
    shot_type: string
    movement: string
    framing: string
    /** P1.6: angle 补入——俯拍/仰拍/平视 等叙事视角 */
    angle?: string
  }
  subject: {
    description: string
    expression: string
    clothing: string
  }
  action: string
  environment: {
    setting: string
    props: string[]
    lighting: string
    /** P1.6: atmosphere 补入 */
    atmosphere?: string
    /** P1.6: colorPalette 补入——色板驱动风格一致性 */
    colorPalette?: string
  }
  vfx: string[]
  style: {
    name: string
    keywords: string[]
    mood: string
  }
  /** P1.6: emotion 补入——情绪信号直通视频模型 */
  emotion?: {
    mood: string
    intensity: number
  }
  negative_prompt: string
}

/**
 * 编译器输出
 */
export interface CompileResult {
  spec: VideoPromptSpec
  prompt: string
  promptIR: PromptIR
  scores: {
    duration: number
    shotCount: number
    coverage: number // 0-1, 输入到输出的语义覆盖度
  }
  error?: CompileError | null  // Phase D: typed failure
  trace?: CompileTrace         // Phase D: execution trace
}

/**
 * Phase D: Typed Compile Error
 * 每一 stage 的失败必须显式 stage 化
 */
export interface CompileError {
  stage: 'VALIDATE' | 'MAP_SHOTS' | 'BUILD_SPEC' | 'COMPILE_PROMPT' | 'RENDER'
  code: string
  message: string
  recoverable: boolean
}

/**
 * Phase D: Execution Trace — 系统可逆性保证
 * 每次 compile 生成一个 trace，支持 replay 验证一致性
 */
export interface CompileTrace {
  traceId: string
  inputHash: string
  outputHash: string
  timestamp: number
  durationMs: number
  stages: Array<{
    name: string
    input: unknown
    output: unknown
    durationMs: number
  }>
}

/**
 * 校验结果
 */
export interface CompileGuard {
  valid: boolean
  warnings: string[]
  errors: string[]
}

// Phase D: JSONL trace 存储路径
export const COMPILE_TRACE_DIR = 'data/compile-traces'
