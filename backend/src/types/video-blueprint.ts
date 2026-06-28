/**
 * types/video-blueprint.ts
 *
 * VideoBlueprint — 视频生成唯一事实源
 *
 * 这是 compileAndScore + buildShotGraph 到 Worker 之间的 Contract。
 * 只定义数据结构，不包含任何执行逻辑。
 *
 * 规则：
 *   1. Worker 优先消费 compiledPrompt
 *   2. promptSpec / shotGraph / effectSpecs 逐步接入
 *   3. 所有字段均为可选，确保向后兼容
 *   4. 禁止在此文件中添加任何执行函数
 */

import type { VideoPromptSpec } from '../production-loop/prompt-compiler.js'

/**
 * Shot Graph 合约（引用自 director-v2）
 * 无需额外导入结构，此处只声明接口
 */
export interface BlueprintShotGraph {
  shots: Array<{
    id: string
    intent: string
    spatialFrame: string
    camera: { type: string; movement?: string }
    subject: string[]
    action: string
    vfx: string[]
    continuity?: { previousRelation: string; description: string }
  }>
  meta: {
    totalShots: number
    narrativeSummary: string
  }
}

export interface BlueprintEffectSpec {
  type: string
  description: string
  timing: string
  duration: number
  intensity: string
}

/**
 * VideoBlueprint — 所有视频生成的唯一数据合约
 *
 * 字段说明：
 *   narrative         原始用户叙述文本（向前兼容）
 *   compiledPrompt    compileAndScore 输出的编译后 prompt
 *   promptSpec        VideoPromptSpec 结构体（含 camera/subject/action/environment/vfx/style）
 *   shotGraph         镜头图规划（buildShotGraph 输出）
 *   effectSpecs       特效规范列表
 *   promptSource      标记 prompt 来源：'compiled' | 'legacy'
 */
export interface VideoBlueprint {
  /** 原始用户叙事文本 */
  narrative?: string

  /** compileAndScore 编译后的最终 prompt */
  compiledPrompt?: string

  /** VideoPromptSpec 结构体 */
  promptSpec?: {
    camera?: {
      shot_type: string
      movement?: string
      lens?: string
    }
    subject?: {
      main: string
      secondary?: string[]
    }
    action?: string
    environment?: {
      location?: string
      atmosphere?: string
      time_of_day?: string
    }
    vfx?: {
      energy?: string[]
      physics?: string[]
      particles?: string[]
    }
    style?: {
      cinematic?: boolean
      keywords?: string[]
    }
  }

  /** Shot Graph 镜头规划 */
  shotGraph?: BlueprintShotGraph

  /** 特效规范 */
  effectSpecs?: BlueprintEffectSpec[]

  /** Prompt 来源标记 */
  promptSource?: 'compiled' | 'legacy'
}
