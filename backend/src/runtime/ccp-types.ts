/**
 * CCP — Cinematic Compilation Pipeline
 *
 * CIR → Semantic IR → ProviderIR → Prompt → Optimized Prompt
 *                                            ↓
 *                                     CompileReport（含 Capability Diff）
 *
 * 原则：
 * - CIR 保持 Provider 无关
 * - Semantic IR：所有 Provider 共享的中间表示（仍无 Prompt）
 * - Provider IR：根据 Provider 能力映射与降级
 * - Prompt Renderer：生成各 Provider 的最终 Prompt
 * - Prompt Optimizer：压缩 + 最佳实践 + 负向提示合成
 * - CompileReport：Capability Diff / Loss / Warnings / Score
 */

import type { CirV1 } from './cir-v1.js'

// ─── Semantic IR（Provider 无关）────────────

export interface SemanticIrShot {
  id: string
  description: string
  durationSeconds: number
  characterIds: string[]
  actions: string[]
  dialogue: string[]
  camera: {
    // 镜头运动描述（自然语言，仍保持 Provider 无关）
    motionDescription: string
    scale: string
    angle: string
    compositionDescription: string
    focusDescription: string
  }
  lightingDescription: string
  narrativePurpose?: string
}

export interface SemanticIR {
  version: string
  scene: {
    title: string
    environmentSummary: string
  }
  characters: Array<{ id: string; name: string; appearance: string; emotion: string }>
  shots: SemanticIrShot[]
  storyIntent: string
  cinematicIntent: string
  constraints: { fps: number; resolution: string; maxDuration: number }
}

// ─── Provider Capability Model ──────────────

export interface ProviderCapability {
  supportsReferenceImage: boolean
  supportsCameraControl: 'none' | 'partial' | 'full'
  supportsSeed: boolean
  supportsMotionBrush: boolean
  supportsRackFocus: boolean
  supportsDepthOfField: boolean
  supportsNegativePrompt: boolean
  maxPromptLength: number
  /** Provider 名称 */
  name: string
}

// ─── Provider IR（Provider 能力映射后）──────

export interface CapabilityLoss {
  capability: string
  reason: string
}

export interface ProviderIR {
  providerName: string
  /** 降级后的镜头描述 */
  shotInstructions: Array<{
    shotId: string
    /** 语义化的镜头指令（非 final prompt，但已按 Provider 风格调整） */
    instruction: string
    /** 本镜头丢失的能力 */
    capabilityLosses: CapabilityLoss[]
  }>
  /** 全局指令（跨镜头保持） */
  globalInstructions: string[]
  /** 全局丢失的能力 */
  globalCapabilityLosses: CapabilityLoss[]
  /** 负向提示 */
  negativeInstructions: string[]
}

// ─── Compile Report ─────────────────────────

export interface CompileReport {
  /** 编译总评分 (0-100) */
  compileScore: number
  /** 支持的能力列表 */
  supportedCapabilities: string[]
  /** 丢失的能力列表 */
  lostCapabilities: CapabilityLoss[]
  /** Provider 告警 */
  warnings: string[]
  /** 输入 CIR 的 shot 总数 */
  inputShotCount: number
  /** 输出指令的 shot 数 */
  outputShotCount: number
}

// ─── 编译结果 ───────────────────────────────

export interface CompileResult {
  semanticIR: SemanticIR
  providerIR: ProviderIR
  prompt: string
  negativePrompt: string
  optimizedPrompt: string
  report: CompileReport
}

// ─── Compiler 接口 ─────────────────────────

/**
 * CinematicCompiler — CCP 入口
 * 所有 Provider 的 Compiler 都必须实现此接口。
 */
export interface CinematicCompiler {
  /** 编译：CIR → CompileResult */
  compile(cir: CirV1): CompileResult | Promise<CompileResult>
  /** Provider 能力声明 */
  capabilities: ProviderCapability
}
