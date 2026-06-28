/**
 * production-loop/provider-native-payload.ts
 *
 * Phase 1.8 — Provider Adapter De-Legacyization
 *
 * ProviderNativePayload — Adapter 层最终消费的结构化输入体裁。
 *
 * 此处定义的 payload 会直接进入 Adapter 的 execute 方法。
 * 只有经过 ProviderPromptCompiler 编译的干净结构化数据，才能进入此层。
 *
 * 目标：Adapter 不再直接接收 string prompt，而是接收结构化的段落/指令。
 */

// ── Prompt Block ──

export interface PromptBlock {
  type: 'narrative' | 'dialogue' | 'effect' | 'style' | 'spatial' | 'avoid'
  content: string
  priority?: number
}

// ── Camera Directive ──

export interface CameraDirective {
  shotType?: string
  movement?: string
  lens?: string
  focalLength?: number
  depthOfField?: 'shallow' | 'medium' | 'deep'
  angle?: 'low' | 'high' | 'eye' | 'bird' | 'worm'
  intent?: string
}

// ── VFX Directive ──

export interface VFXDirective {
  type: string
  description?: string
  intensity?: string
  timing?: string
  duration?: number
}

// ── Motion Directive ──

export interface MotionDirective {
  type: 'action' | 'camera_track' | 'transition'
  actor?: string
  speed?: 'slow' | 'normal' | 'fast'
  duration?: number
  description?: string
}

// ── Lighting Directive ──

export interface LightingDirective {
  style?: string
  keyLight?: string
  fillLight?: string
  backLight?: string
  ambient?: string
  colorTemperature?: 'warm' | 'neutral' | 'cold'
  mood?: string
}

// ── Provider 最终消费的标准化 Payload ──

export interface ProviderNativePayload {
  /** 编译后的最终 Prompt 文本（向下兼容） */
  compiledPrompt: string

  /** Prompt 语义块（结构化分段） */
  promptBlocks?: PromptBlock[]

  /** 镜头指令 */
  cameraDirectives?: CameraDirective[]

  /** VFX 指令 */
  vfxDirectives?: VFXDirective[]

  /** 动作/运动时间轴 */
  motionDirectives?: MotionDirective[]

  /** 灯光指令 */
  lightingDirective?: LightingDirective

  /** 原始 Blueprint 元信息 */
  meta?: {
    mode: 'native' | 'hybrid' | 'legacy'
    shotGraphUsed: boolean
    effectSpecsUsed: boolean
    promptSpecUsed: boolean
  }
}
