/**
 * runtime/feedback-loop/prompt-diff.ts
 *
 * Prompt ↔ Video Diff Analyzer
 *
 * 职责：
 *   比较 Prompt 意图 vs 实际视频结果。
 *   基于 VideoCritique 的 failureReasons + 原始 spec，
 *   输出结构化的 PromptGap，指导 Prompt Compiler Auto-Fixer。
 *
 * @runtime feedback-loop
 */

import type { VideoCritique } from './video-critic.js'
import type { VideoPromptSpec } from '../../production-loop/prompt-compiler.js'

// ============================================================
// Types
// ============================================================

export interface PromptGap {
  /** 评分总分 */
  overallScore: number

  /** 画面中缺少了 prompt 里要求的元素 */
  missingElements: string[]

  /** 画面中出现了 prompt 里没要求的元素 */
  hallucinatedElements: string[]

  /** 镜头语言不匹配的描述 */
  cameraMismatch: string[]

  /** VFX 不匹配的描述 */
  vfxMismatch: string[]

  /** 动作/运动不匹配 */
  actionMismatch: string[]

  /** 环境/场景不匹配 */
  environmentMismatch: string[]

  /** 需要修复的方向（结构化指令） */
  fixDirectives: string[]
}

// ============================================================
// Gap Analyzer
// ============================================================

/**
 * 分析 VideoCritique 与原始 PromptSpec 之间的差距
 */
export function analyzeGap(
  critique: VideoCritique,
  spec: VideoPromptSpec,
  compiledPrompt: string,
): PromptGap {
  const missingElements: string[] = []
  const hallucinatedElements: string[] = []
  const cameraMismatch: string[] = []
  const vfxMismatch: string[] = []
  const actionMismatch: string[] = []
  const environmentMismatch: string[] = []
  const fixDirectives: string[] = []

  // ─── 1. Camera Gap Analysis ───
  if (critique.cameraScore < 0.6) {
    const failures = critique.failureReasons.filter(r =>
      /camera|shot|movement|angle|镜头|运镜/.test(r)
    )
    if (failures.length > 0) {
      cameraMismatch.push(...failures)
    } else {
      // 自动推断 camera 问题
      if (spec.camera.movement && spec.camera.movement !== 'fixed') {
        cameraMismatch.push(`missing "${spec.camera.movement}" camera movement`)
      }
      if (spec.camera.shot_type) {
        cameraMismatch.push(`expected shot type "${spec.camera.shot_type}"`)
      }
    }
    fixDirectives.push(`camera: strengthen "${spec.camera.movement || ''}" movement tokens, emphasize "${spec.camera.shot_type || ''}" shot type`)
  }

  // ─── 2. Action Gap Analysis ───
  if (critique.motionScore < 0.6) {
    const failures = critique.failureReasons.filter(r =>
      /action|motion|movement|动作|运动|连贯/.test(r)
    )
    if (failures.length > 0) {
      actionMismatch.push(...failures)
    } else {
      actionMismatch.push(`action "${spec.action.slice(0, 60)}..." not sufficiently realized`)
    }
    if (spec.action) {
      missingElements.push(`action: ${spec.action.slice(0, 80)}`)
    }
    fixDirectives.push(`action: describe motion as a single continuous physical sequence with clear start->peak->end`)
  }

  // ─── 3. VFX Gap Analysis ───
  if (critique.vfxScore < 0.6) {
    const failures = critique.failureReasons.filter(r =>
      /vfx|effect|energy|particle|physics|特效|粒子|能量/.test(r)
    )
    if (failures.length > 0) {
      vfxMismatch.push(...failures)
    }
    // 检查 spec 中的每个 VFX 条目是否合理
    if (spec.vfx.energy && spec.vfx.energy.length > 0) {
      // Energy 特效如果分数低，可能需要更具体的物理描述
      fixDirectives.push(`vfx/energy: describe "${spec.vfx.energy.join(', ')}" with physical properties (color, intensity, shape, trajectory, interaction with environment)`)
    }
    if (spec.vfx.physics && spec.vfx.physics.length > 0) {
      fixDirectives.push(`vfx/physics: emphasize spatial impact of "${spec.vfx.physics.join(', ')}" — describe what happens to the environment (debris trajectory, ground deformation, air displacement)`)
    }
    if (spec.vfx.particles && spec.vfx.particles.length > 0) {
      fixDirectives.push(`vfx/particles: density, distribution, and interaction of "${spec.vfx.particles.join(', ')}"`)
    }
  }

  // ─── 4. Scene Composition Gap ───
  if (critique.compositionScore < 0.6) {
    const failures = critique.failureReasons.filter(r =>
      /scene|composition|spatial|space|layout|场景|构图|空间/.test(r)
    )
    if (failures.length > 0) {
      environmentMismatch.push(...failures)
    }
    if (spec.environment.location) {
      fixDirectives.push(`environment: add spatial depth descriptors for "${spec.environment.location}" — foreground/midground/background layering, scale relationships`)
    }
    if (spec.subject.secondary && spec.subject.secondary.length > 0) {
      fixDirectives.push(`composition: ensure spatial relationship between main subject and secondary elements: ${spec.subject.secondary.join(', ')}`)
    }
  }

  // ─── 5. Cinematic Quality Gap ───
  if (critique.cinematicScore < 0.6) {
    const failures = critique.failureReasons.filter(r =>
      /cinematic|film|lighting|color|visual quality|电影感|光影|画质/.test(r)
    )
    if (failures.length > 0) {
      hallucinatedElements.push(...failures)
    }
    if (spec.style.keywords && spec.style.keywords.length > 0) {
      fixDirectives.push(`style: reinforce "${spec.style.keywords.slice(0, 3).join(', ')}" with concrete visual attributes (light angle, shadow hardness, color temperature, depth of field)`)
    }
  }

  return {
    overallScore: critique.overallScore,
    missingElements,
    hallucinatedElements,
    cameraMismatch,
    vfxMismatch,
    actionMismatch,
    environmentMismatch,
    fixDirectives,
  }
}
