/**
 * production-loop/provider-input-builder.ts
 *
 * buildProviderInput — 从 VideoBlueprint 构建结构化的 Provider 输入
 *
 * 此函数是 Phase 1.7 的核心：
 *   Blueprint { compiledPrompt, promptSpec, shotGraph, effectSpecs }
 *     ↓
 *   ProviderVideoInput { prompt, camera, lighting, vfx, motion, render, shotGraph }
 *
 * 规则：
 *   1. 只做"展开映射"，不做"优化/生成"
 *   2. 所有输出字段可选，向后兼容
 *   3. 不修改 Blueprint 结构
 *   4. 不调用 LLM / Agent / Runtime
 */

import type { ProviderVideoInput, CameraParam, LightingParam, VFXParam, MotionParam } from './provider-input.js'

/**
 * 从 Blueprint 构建 ProviderVideoInput
 * @param blueprint 前端传入的 VideoBlueprint（可选字段）
 * @param legacyNarrative 降级用叙事文本
 * @returns 结构化 Provider 输入
 */
export function buildProviderInput(
  blueprint: Record<string, any> | undefined | null,
  legacyNarrative: string,
): ProviderVideoInput {
  const promptSource = blueprint?.compiledPrompt ? 'compiled' : 'legacy'

  // ─── prompt ───
  const prompt = blueprint?.compiledPrompt || legacyNarrative

  // ─── shotGraph → camera + motion ───
  const camera: CameraParam[] = []
  const motion: MotionParam[] = []
  if (blueprint?.shotGraph?.shots?.length) {
    for (const shot of blueprint.shotGraph.shots) {
      if (shot.camera) {
        camera.push({
          shotType: shot.camera.type,
          movement: shot.camera.movement,
          intent: shot.intent,
        })
      }
      if (shot.action) {
        motion.push({
          type: 'action',
          description: shot.action,
          actor: shot.subject?.[0],
        })
      }
    }
  }

  // ─── promptSpec → lighting + camera + render ───
  let lighting: LightingParam | undefined
  const render: Record<string, any> = {}
  if (blueprint?.promptSpec) {
    const spec = blueprint.promptSpec

    // 环境 → lighting
    if (spec.environment) {
      lighting = {
        ...(spec.environment.location ? { style: spec.environment.location } : {}),
        ...(spec.environment.atmosphere ? { mood: spec.environment.atmosphere } : {}),
        ...(spec.environment.time_of_day ? { keyLight: spec.environment.time_of_day } : {}),
      }
    }

    // camera → 补充 camera 数组
    if (spec.camera && camera.length === 0) {
      camera.push({
        shotType: spec.camera.shot_type,
        movement: spec.camera.movement,
        lens: spec.camera.lens,
      })
    }

    // style → render
    if (spec.style?.keywords?.length) {
      render.styleKeywords = spec.style.keywords
    }
  }

  // ─── effectSpecs → vfx ───
  const vfx: VFXParam[] = []
  if (blueprint?.effectSpecs?.length) {
    for (const fx of blueprint.effectSpecs) {
      vfx.push({
        type: fx.type || 'unknown',
        description: fx.description || '',
        intensity: fx.intensity,
        timing: fx.timing,
        duration: fx.duration,
      })
    }
  }

  // ─── 组装结果 ───
  const result: ProviderVideoInput = {
    prompt,
    camera: camera.length > 0 ? camera : undefined,
    lighting,
    vfx: vfx.length > 0 ? vfx : undefined,
    motion: motion.length > 0 ? motion : undefined,
    render: Object.keys(render).length > 0 ? render as any : undefined,
    shotGraph: blueprint?.shotGraph?.shots?.length ? blueprint.shotGraph.shots : undefined,
    rawSpec: blueprint?.promptSpec || undefined,
  }

  console.log(`[buildProviderInput] source=${promptSource}, camera=${camera.length}, vfx=${vfx.length}, motion=${motion.length}, lighting=${lighting ? 1 : 0}`)

  return result
}
