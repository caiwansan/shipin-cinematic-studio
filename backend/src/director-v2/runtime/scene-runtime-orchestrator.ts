/**
 * runtime/scene-runtime-orchestrator.ts — Phase 4 场景运行时编排器
 *
 * 职责：管理多个 SceneRuntimeContext 的生命周期
 *   - createSceneRuntimes: 从 ExecutionPlan 初始化所有场景上下文
 *   - startScene: 激活指定场景（标记 playing）
 *   - tickScene: 单帧推进场景内部状态
 *   - advanceShot: 推进到场景的下一 shot
 *   - completeScene: 标记场景完成
 *
 * 宪法：
 *   1. 不修改 StoryBundle / IR / Timeline / ExecutionPlan
 *   2. 所有操作是纯 deterministic
 *   3. 不涉及持久化（由上层决定是否持久化状态）
 */

import type { StoryExecutionGraph } from './story-scheduler.js'
import type { SceneTimeline } from '../timeline/scene-timeline.js'
import type { RuntimeState, SceneRuntimeContext } from './state-machine.js'
import { createSceneContext, createRuntimeState, transitionSceneStatus } from './state-machine.js'

// ─── createSceneRuntimes ──────────────────────────────

/**
 * 从 ExecutionPlan 初始化所有场景运行时上下文
 * 以及全局 RuntimeState
 */
export function createSceneRuntimes(executionPlan: StoryExecutionGraph): {
  sceneContexts: Map<string, SceneRuntimeContext>
  runtimeState: RuntimeState
} {
  const sceneContexts = new Map<string, SceneRuntimeContext>()
  let firstSceneId: string | null = null

  for (const plan of executionPlan.scenes) {
    if (!firstSceneId) firstSceneId = plan.sceneId

    sceneContexts.set(
      plan.sceneId,
      createSceneContext(plan.sceneId, plan.cameraIntensity, plan.durationWeight)
    )
  }

  const runtimeState = createRuntimeState(firstSceneId, executionPlan.scenes.length)

  return { sceneContexts, runtimeState }
}

// ─── startScene ──────────────────────────────────────

/**
 * 启动场景：切换状态为 playing，更新全局 RuntimeState
 */
export function startScene(
  sceneContexts: Map<string, SceneRuntimeContext>,
  runtimeState: RuntimeState,
  sceneId: string
): { sceneContexts: Map<string, SceneRuntimeContext>; runtimeState: RuntimeState } {
  const ctx = sceneContexts.get(sceneId)
  if (!ctx || ctx.status === 'completed') {
    // 场景已完成或不存在 → 不切换
    return { sceneContexts, runtimeState }
  }

  // 暂停当前场景（若非 idle）
  const newContexts = new Map(sceneContexts)
  const currentCtx = runtimeState.currentSceneId
    ? sceneContexts.get(runtimeState.currentSceneId)
    : null

  if (currentCtx && currentCtx.status === 'playing' && currentCtx.sceneId !== sceneId) {
    newContexts.set(currentCtx.sceneId, transitionSceneStatus(currentCtx, 'completed'))
  }

  // 启动新场景
  newContexts.set(sceneId, transitionSceneStatus(ctx, 'playing'))

  // 更新全局状态
  const newState: RuntimeState = {
    ...runtimeState,
    currentSceneId: sceneId,
    currentShotIndex: 0,
    sceneTime: 0,
  }

  return { sceneContexts: newContexts, runtimeState: newState }
}

// ─── tickScene ────────────────────────────────────────

/**
 * 单帧推进场景
 *
 * 根据 speedFactor 决定推进速率
 * 当 sceneTime 超过阈值时自动 advanceShot
 */
export function tickScene(
  sceneContexts: Map<string, SceneRuntimeContext>,
  runtimeState: RuntimeState,
  deltaTime: number
): { sceneContexts: Map<string, SceneRuntimeContext>; runtimeState: RuntimeState } {
  if (!runtimeState.currentSceneId) {
    return { sceneContexts, runtimeState }
  }

  const ctx = sceneContexts.get(runtimeState.currentSceneId)
  if (!ctx || ctx.status !== 'playing') {
    return { sceneContexts, runtimeState }
  }

  const effectiveDelta = deltaTime * ctx.speedFactor
  const newSceneTime = ctx.sceneTime + effectiveDelta

  // shot 推进阈值：每 1.0 抽象时间单位推进一个 shot
  if (newSceneTime % 1.0 < (ctx.sceneTime % 1.0) || newSceneTime >= 3.0) {
    const newShotIndex = Math.min(ctx.shotIndex + 1, 2)
    const newContexts = new Map(sceneContexts)
    newContexts.set(ctx.sceneId, {
      ...ctx,
      sceneTime: newSceneTime,
      shotIndex: newShotIndex,
    })

    return {
      sceneContexts: newContexts,
      runtimeState: {
        ...runtimeState,
        playbackTime: runtimeState.playbackTime + effectiveDelta,
        currentShotIndex: newShotIndex,
        intensity: ctx.baseIntensity,
      },
    }
  }

  // 普通 tick（不推进 shot）
  const newContexts = new Map(sceneContexts)
  newContexts.set(ctx.sceneId, { ...ctx, sceneTime: newSceneTime })

  return {
    sceneContexts: newContexts,
    runtimeState: {
      ...runtimeState,
      playbackTime: runtimeState.playbackTime + effectiveDelta,
    },
  }
}

// ─── advanceShot ──────────────────────────────────────

/**
 * 强制推进到下一 shot
 */
export function advanceShot(
  sceneContexts: Map<string, SceneRuntimeContext>,
  runtimeState: RuntimeState
): { sceneContexts: Map<string, SceneRuntimeContext>; runtimeState: RuntimeState } {
  if (!runtimeState.currentSceneId) {
    return { sceneContexts, runtimeState }
  }

  const ctx = sceneContexts.get(runtimeState.currentSceneId)
  if (!ctx || ctx.status !== 'playing') return { sceneContexts, runtimeState }

  const newShotIndex = Math.min(ctx.shotIndex + 1, 2)
  const newContexts = new Map(sceneContexts)
  newContexts.set(ctx.sceneId, { ...ctx, shotIndex: newShotIndex })

  return {
    sceneContexts: newContexts,
    runtimeState: { ...runtimeState, currentShotIndex: newShotIndex },
  }
}

// ─── completeScene ───────────────────────────────────

/**
 * 标记当前场景完成
 */
export function completeScene(
  sceneContexts: Map<string, SceneRuntimeContext>,
  runtimeState: RuntimeState
): { sceneContexts: Map<string, SceneRuntimeContext>; runtimeState: RuntimeState } {
  if (!runtimeState.currentSceneId) {
    return { sceneContexts, runtimeState }
  }

  const ctx = sceneContexts.get(runtimeState.currentSceneId)
  if (!ctx) return { sceneContexts, runtimeState }

  const newContexts = new Map(sceneContexts)
  newContexts.set(ctx.sceneId, transitionSceneStatus(ctx, 'completed'))

  // 找下一场景
  const sceneIds = Array.from(sceneContexts.keys())
  const currentIndex = sceneIds.indexOf(ctx.sceneId)
  const nextSceneId = currentIndex < sceneIds.length - 1 ? sceneIds[currentIndex + 1] : null

  return {
    sceneContexts: newContexts,
    runtimeState: {
      ...runtimeState,
      currentSceneId: nextSceneId,
      currentShotIndex: 0,
      completedScenes: runtimeState.completedScenes + 1,
    },
  }
}
