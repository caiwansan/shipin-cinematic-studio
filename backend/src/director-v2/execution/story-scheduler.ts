/**
 * execution/story-scheduler.ts — Phase 3 故事执行调度器
 *
 * 职责：从 StoryBundle 推导完整执行计划
 *
 * Pipeline:
 *   StoryBundle
 *     ↓ sequenceScenes → SceneExecutionPlan[] + TransitionRule[]
 *     ↓ computePacing → PacingControllerOutput
 *   StoryExecutionGraph（最终输出）
 *
 * 宪法：
 *   1. 纯 deterministic
 *   2. executionPlan 是 StoryBundle 的派生投影（不修改 IR/Timeline）
 *   3. 建议值均可被上层覆盖
 */

import type { StoryBundle } from '../story/story-compiler.js'
import { sequenceScenes } from './scene-sequencer.js'
import { computePacing, type PacingControllerOutput } from './pacing-controller.js'
import type { SceneExecutionPlan, TransitionRule } from './scene-sequencer.js'

// ─── 类型 ─────────────────────────────────────────────────

export interface StoryExecutionGraph {
  scenes: SceneExecutionPlan[]
  transitions: TransitionRule[]
  pacing: PacingControllerOutput
  meta: {
    totalScenes: number
    dominantSpeedFactor: number
    hasRestPoint: boolean
    version: string
  }
}

// ─── compileExecutionPlan ────────────────────────────────

/**
 * 从 StoryBundle 编译完整执行计划
 *
 * ExecutionPlan 不修改任何已有数据。
 * 它是 StoryBundle 的派生投影——改变计划不影响故事本身。
 */
export function compileExecutionPlan(bundle: StoryBundle): StoryExecutionGraph {
  // 1. 场景排序 + 过渡规则
  const { plans, transitions } = sequenceScenes(bundle)

  // 2. 节奏控制
  const pacing = computePacing(bundle)

  // 3. 汇总 meta
  const avgSpeed = plans.length > 0
    ? pacing.pacingCurve.reduce((sum, p) => sum + p.speedFactor, 0) / plans.length
    : 1.0

  return {
    scenes: plans,
    transitions,
    pacing,
    meta: {
      totalScenes: plans.length,
      dominantSpeedFactor: Math.round(avgSpeed * 100) / 100,
      hasRestPoint: pacing.restPoints.length > 0,
      version: 'director-v2.0',
    },
  }
}

export default { compileExecutionPlan }
