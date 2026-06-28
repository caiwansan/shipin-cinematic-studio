/**
 * CCP — Prompt Renderer
 *
 * 职责：Provider IR → Provider Prompt
 * 这一层才最终生成文本 Prompt。
 */

import type { ProviderIR, CompileReport } from './ccp-types.js'

/**
 * 编译 Compile Report
 */
export function buildCompileReport(
  providerIR: ProviderIR,
  inputShotCount: number,
  maxPromptLength: number,
): CompileReport {
  const allLosses = [
    ...providerIR.globalCapabilityLosses,
    ...providerIR.shotInstructions.flatMap(si => si.capabilityLosses),
  ]

  const lostCaps = [...new Set(allLosses.map(l => l.capability))]
  const allCapIds = new Set([
    'camera_motion', 'camera_path', 'focus_control', 'rack_focus',
    'depth_of_field', 'motion_brush', 'lighting_control', 'reference_image',
  ])
  const supported = [...allCapIds].filter(c => !lostCaps.includes(c))

  // compile score = 100 - (lost / total) * 100
  const totalCaps = allCapIds.size
  const lostCount = lostCaps.length
  const compileScore = Math.round((1 - lostCount / totalCaps) * 100)

  const warnings: string[] = []
  if (allLosses.length > 0) {
    warnings.push(`${allLosses.length} capability loss(es): ${lostCaps.join(', ')}`)
  }

  return {
    compileScore,
    supportedCapabilities: supported,
    lostCapabilities: allLosses,
    warnings,
    inputShotCount,
    outputShotCount: providerIR.shotInstructions.length,
  }
}

/**
 * Render: ProviderIR → Prompt
 * 基础的 Prompt Renderer，按 Provider 风格生成。
 */
export function renderPrompt(
  providerIR: ProviderIR,
  maxPromptLength: number,
): { prompt: string; negativePrompt: string } {
  const parts: string[] = []

  // 全局指令
  parts.push(...providerIR.globalInstructions)

  // 逐镜头指令
  for (const si of providerIR.shotInstructions) {
    parts.push(si.instruction)
  }

  // 合并
  let prompt = parts.join('\n')
  if (prompt.length > maxPromptLength) {
    prompt = prompt.slice(0, maxPromptLength - 3) + '...'
  }

  const negativePrompt = providerIR.negativeInstructions.join('; ')

  return { prompt, negativePrompt }
}

/**
 * Optimize: 压缩 + 最佳实践优化
 * 基础版：去重 + 裁剪。后续可增加 Learning Memory 驱动优化。
 */
export function optimizePrompt(
  prompt: string,
  maxPromptLength: number,
): string {
  let optimized = prompt
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .join('. ')

  if (optimized.length > maxPromptLength) {
    optimized = optimized.slice(0, maxPromptLength - 3) + '...'
  }

  return optimized
}
