/**
 * CCP — Provider IR 编译器
 *
 * 职责：Semantic IR → Provider IR
 * 根据 Provider 能力模型进行映射与降级。
 * 识别 Pipeline 支持但 Provider 不支持的能力 → Capability Diff.
 */

import type { SemanticIR, ProviderIR, ProviderCapability, CapabilityLoss } from './ccp-types.js'

// ─── Known Provider Capabilities ───────────

/** Volcengine / ByteDance 视频模型能力 */
export const VOLCENGINE_CAPS: ProviderCapability = {
  name: 'volcengine',
  supportsReferenceImage: true,
  supportsCameraControl: 'partial',
  supportsSeed: true,
  supportsMotionBrush: false,
  supportsRackFocus: false,
  supportsDepthOfField: false,
  supportsNegativePrompt: true,
  maxPromptLength: 1000,
}

/**
 * Semantic IR → Provider IR
 * 
 * @param semir 语义 IR
 * @param providerCaps Provider 能力模型
 * @returns Provider 级别指令（仍不是 final prompt）
 */
export function compileToProviderIr(
  semir: SemanticIR,
  providerCaps: ProviderCapability,
): ProviderIR {
  const globalLosses: CapabilityLoss[] = []
  const globalInstructions: string[] = []

  // 全局指令：建立场景和环境
  globalInstructions.push(`Scene: ${semir.scene.title}. ${semir.scene.environmentSummary}.`)
  globalInstructions.push(`Intent: ${semir.storyIntent}. Cinematic: ${semir.cinematicIntent}.`)

  // 全局能力检查
  if (!providerCaps.supportsRackFocus) {
    globalLosses.push({ capability: 'rack_focus', reason: 'Provider does not support rack focus' })
  }
  if (!providerCaps.supportsDepthOfField) {
    globalLosses.push({ capability: 'depth_of_field', reason: 'Provider does not support depth of field control' })
  }
  if (!providerCaps.supportsMotionBrush) {
    globalLosses.push({ capability: 'motion_brush', reason: 'Provider does not support motion brush' })
  }

  // 负向提示
  const negativeInstructions: string[] = []
  if (providerCaps.supportsNegativePrompt) {
    negativeInstructions.push('blurry, distorted, low quality, artifacts')
  }

  // 逐镜头编译
  const shotInstructions = semir.shots.map((shot) => {
    const losses: CapabilityLoss[] = []

    // 镜头指令（语义化，仍以描述为主）
    const parts: string[] = []

    // Scale + Angle（绝大多数 Provider 支持）
    parts.push(`${shot.camera.scale}, ${shot.camera.angle}`)

    // 构图
    if (shot.camera.compositionDescription) {
      parts.push(shot.camera.compositionDescription)
    }

    // 运动
    if (shot.camera.motionDescription && shot.camera.motionDescription !== 'standard shot') {
      if (providerCaps.supportsCameraControl === 'none') {
        losses.push({ capability: 'camera_motion', reason: 'Provider does not support camera control' })
      } else {
        parts.push(shot.camera.motionDescription)
      }
    }

    // 焦点
    if (shot.camera.focusDescription) {
      if (providerCaps.supportsCameraControl === 'none') {
        losses.push({ capability: 'focus_control', reason: 'Provider does not support focus control' })
      } else {
        parts.push(shot.camera.focusDescription)
      }
    }

    // 灯光
    if (shot.lightingDescription) {
      parts.push(shot.lightingDescription)
    }

    // 角色
    const chars = shot.characterIds
      .map(id => semir.characters.find(c => c.id === id))
      .filter(Boolean)
    if (chars.length > 0) {
      const charDesc = chars.map(c => `${c!.name} (${c!.appearance})`).join(', ')
      parts.push(`Character(s): ${charDesc}`)
    }

    // 动作
    if (shot.actions.length > 0) {
      parts.push(`Action(s): ${shot.actions.join(', ')}`)
    }

    // 叙事目的
    if (shot.narrativePurpose) {
      parts.push(`Purpose: ${shot.narrativePurpose}`)
    }

    return {
      shotId: shot.id,
      instruction: parts.join('. '),
      capabilityLosses: losses,
    }
  })

  return {
    providerName: providerCaps.name,
    shotInstructions,
    globalInstructions,
    globalCapabilityLosses: globalLosses,
    negativeInstructions,
  }
}
