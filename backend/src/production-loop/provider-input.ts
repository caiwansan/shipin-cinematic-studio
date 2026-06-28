/**
 * production-loop/provider-input.ts
 *
 * ProviderVideoInput — Provider 结构化的输入合约
 *
 * 这是从 VideoBlueprint → Provider Adapter 之间的"执行语言"。
 * Blueprint 的四个字段（compiledPrompt / promptSpec / shotGraph / effectSpecs）
 * 在此被展开为 Provider 可消费的结构化参数。
 *
 * 规则：
 *   1. 只定义类型，不包含执行逻辑
 *   2. 所有字段可选，向后兼容
 *   3. 是 buildVideoBody() 的上游来源，不是替代
 */

// ── Camera 参数 ──

export interface CameraParam {
  /** 景别 */
  shotType?: string
  /** 运镜 */
  movement?: string
  /** 镜头焦段 */
  lens?: string
  /** 焦距（如果是变焦） */
  focalLength?: number
  /** 景深 */
  depthOfField?: 'shallow' | 'medium' | 'deep'
  /** 角度 */
  angle?: 'low' | 'high' | 'eye' | 'bird' | 'worm'
  /** 对应 shot 的意图 */
  intent?: string
}

// ── 灯光参数 ──

export interface LightingParam {
  style?: string
  keyLight?: string
  fillLight?: string
  backLight?: string
  ambient?: string
  colorTemperature?: 'warm' | 'neutral' | 'cold'
  mood?: string
}

// ── VFX 参数 ──

export interface VFXParam {
  type: string
  description?: string
  intensity?: string
  timing?: string
  duration?: number
}

// ── 运动/动作参数 ──

export interface MotionParam {
  type: string
  actor?: string
  speed?: 'slow' | 'normal' | 'fast'
  duration?: number
  description?: string
}

// ── 渲染参数 ──

export interface RenderParam {
  fps?: number
  aspectRatio?: string
  resolution?: string
  watermark?: boolean
  promptExtend?: boolean
}

// ── Provider 结构化输入合约 ──

export interface ProviderVideoInput {
  /** 核心 Prompt 文本 */
  prompt: string

  /** 镜头参数（展开后） */
  camera?: CameraParam[]

  /** 灯光参数 */
  lighting?: LightingParam

  /** VFX 参数 */
  vfx?: VFXParam[]

  /** 动作/运动参数 */
  motion?: MotionParam[]

  /** 渲染参数 */
  render?: RenderParam

  /** Shot Graph 结构化传递（Adapter 可自行编译） */
  shotGraph?: Array<{
    id: string
    intent: string
    camera: { type: string; movement?: string }
    subject: string[]
    action: string
    vfx: string[]
  }>

  /** 原始 VideoPromptSpec（Adapter 可自行展开） */
  rawSpec?: Record<string, unknown>
}
