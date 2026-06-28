// ═══════════════════════════════════════════════════════════════
// CinematicIR 入口 — 统一导出 + Pipeline Runner
// ═══════════════════════════════════════════════════════════════

export * from './types.js'
export * from './compiler.js'
export * from './validator.js'
export * from './capability.js'

// ─── 完整编译管线 ──────────────────────────────────

import {
  CinematicSequence,
  createCinematicSequence,
} from './types.js'
import { compileCinematicSequence } from './compiler.js'
import { validateSequence, formatIssues, ValidationIssue } from './validator.js'
import { getModelCapability } from './capability.js'

export interface CinematicPipelineResult {
  ir: CinematicSequence
  prompt: string
  issues: ValidationIssue[]
  modelCapable: boolean
  modelWarnings: string[]
}

/**
 * 完整 Cinematic 管线：
 * 1. 创建 IR → 2. 校验 + 自动修复 → 3. 功能降级 → 4. 编译为 Prompt
 */
export function runCinematicPipeline(
  projectId: string,
  segmentId: string,
  modelId: string,
  buildIR: (ir: CinematicSequence) => void,
): CinematicPipelineResult {
  // Step 1: 创建 IR
  const ir = createCinematicSequence({ projectId, segmentId })

  // Step 2: 填充 IR（由上层回调填入动作/镜头/过渡等）
  buildIR(ir)

  // Step 3: 校验 + 自动修复
  const issues = validateSequence(ir, { autoFix: true })

  // Step 4: 检查模型能力
  const modelWarnings: string[] = []
  const cap = getModelCapability(modelId)
  let modelCapable = false

  if (cap) {
    const { calculateCapabilityScore } = await_import_or_calc(cap)
    // 检查镜头兼容性
    for (const cam of ir.cameraTrack) {
      const needed = cam.shotType
      const available = cap.camera as Record<string, boolean>
      if (!available[needed]) {
        modelWarnings.push(`镜头 "${needed}" 不被 ${cap.name} 支持，已降级为 wide`)
      }
    }
    modelCapable = true
  } else {
    modelWarnings.push(`模型 ${modelId} 未知能力，使用默认编译`)
  }

  // Step 5: 编译为模型 prompt
  const prompt = compileCinematicSequence(ir)

  return { ir, prompt, issues, modelCapable, modelWarnings }
}

function await_import_or_calc(cap: any) {
  // 内联避免循环引用
  const { calculateCapabilityScore } = require('./capability.js')
  return { calculateCapabilityScore }
}
