/**
 * adaptive/mutation-engine.ts — Phase 6 安全突变引擎
 *
 * 职责：执行 Policy Engine 批准的 MutationPlan
 *   仅作用于 ExecutionPlan / RuntimeState / Timeline（投射）
 *   禁止修改 IR / StoryGraph / SceneGraph
 *
 * 允许的突变：
 *   - adjust_pacing: 修改 ExecutionPlan 的场景 speedFactor
 *   - adjust_intensity: 修改 RuntimeState 的 intensity
 *   - insert_rest_scene: 在指定位置插入低强度场景
 *   - reorder_scene: 有限范围内的场景重排
 *
 * 禁止：
 *   - IR schema 修改
 *   - StoryGraph 结构修改
 *   - 角色特征修改
 *   - LLM 直接写任何状态
 */

import type { StoryBundle } from '../story/story-compiler.js'
import type { StoryExecutionGraph } from '../execution/story-scheduler.js'
import type { PolicyDecision, MutationPlan } from './policy-engine.js'
import type { PlaybackControllerState } from '../runtime/playback-controller.js'

// ─── 类型 ─────────────────────────────────────────────────

export interface MutationResult {
  applied: boolean
  summary: string
  modifiedKeys: string[]
  debug?: Record<string, unknown>
}

// ─── Mutation 宪法校验 ──────────────────────────────────

const ALLOWED_ACTIONS = new Set(['adjust_pacing', 'adjust_intensity', 'insert_rest_scene', 'reorder_scene', 'none'])
const FORBIDDEN_TARGETS = ['ir', 'storyGraph', 'sceneGraph', 'characters', 'story']

function validatePlan(plan: MutationPlan): string | null {
  if (!ALLOWED_ACTIONS.has(plan.action)) {
    return `禁止的 mutation action: ${plan.action}`
  }
  if (FORBIDDEN_TARGETS.includes(plan.target)) {
    return `禁止的 mutation target: ${plan.target}（不可修改 IR / StoryGraph）`
  }
  return null
}

// ─── applyMutation ───────────────────────────────────────

/**
 * 应用 Policy 批准的突变
 * 不直接修改 bundle/executionPlan——返回建议的 delta 值
 */
export function applyMutation(
  decision: PolicyDecision,
  currentState: PlaybackControllerState,
  _bundle?: StoryBundle,
  executionPlan?: StoryExecutionGraph,
): {
  result: MutationResult
  suggestedOverrides?: {
    intensity?: number
    speedFactor?: number
  }
} {
  if (!decision.approved || !decision.mutationPlan) {
    return {
      result: { applied: false, summary: decision.reason, modifiedKeys: [] },
    }
  }

  const plan = decision.mutationPlan
  const validationError = validatePlan(plan)
  if (validationError) {
    return {
      result: { applied: false, summary: validationError, modifiedKeys: [] },
    }
  }

  const overrides: { intensity?: number; speedFactor?: number } = {}
  const modified: string[] = []

  switch (plan.action) {
    case 'adjust_pacing': {
      const adj = (plan.params.adjustment as number) ?? 0
      overrides.speedFactor = Math.max(0.5, Math.min(2.0, (currentState.runtimeState.intensity ?? 1.0) + adj))
      modified.push('pacing')
      break
    }
    case 'adjust_intensity': {
      const delta = (plan.params.delta as number) ?? 0
      overrides.intensity = Math.max(0, Math.min(1, (currentState.runtimeState.intensity ?? 0.5) + delta))
      modified.push('intensity')
      break
    }
    case 'insert_rest_scene': {
      // 插入 rest scene 建议
      modified.push('scene_order')
      break
    }
    case 'reorder_scene': {
      modified.push('scene_order')
      break
    }
    case 'none':
      break
  }

  const summary = modified.length > 0
    ? `已应用 mutation: ${plan.action} → ${modified.join(', ')}`
    : '无修改需要（none action）'

  return {
    result: {
      applied: modified.length > 0,
      summary,
      modifiedKeys: modified,
    },
    suggestedOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
  }
}

export default { applyMutation, ALLOWED_ACTIONS }
