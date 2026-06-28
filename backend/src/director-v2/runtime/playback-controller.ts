/**
 * runtime/playback-controller.ts — Phase 4 Playback Controller
 *
 * 职责：运行时播放控制器的核心类
 *   - start: 初始化运行时并启动第一场景
 *   - tick: 单帧推进（场景内 shot 推进 + 全局状态更新）
 *   - getState: 获取当前运行态快照
 *   - pause/resume: 暂停/恢复
 *   - seek: 跳转到指定 shot
 *   - getAllSceneStates: 所有场景的状态视图
 *
 * 宪法：
 *   1. 不修改 StoryBundle / IR / Timeline / ExecutionPlan
 *   2. 状态存储在类实例内（进程生命周期），上层决定是否持久化
 *   3. tick 操作是 deterministic（相同 deltaTime → 相同推进）
 */

import type { StoryBundle } from '../story/story-compiler.js'
import type { StoryExecutionGraph } from '../execution/story-scheduler.js'
import type { RuntimeState, SceneRuntimeContext } from './state-machine.js'
import { createSceneRuntimes, startScene, tickScene, completeScene, advanceShot } from './scene-runtime-orchestrator.js'
import { executeTimeline } from './timeline-executor.js'
import type { ActiveRenderFrame } from './timeline-executor.js'
import { MemoryKernel, type SceneResult } from '../memory/memory-kernel.js'

// ─── 类型 ─────────────────────────────────────────────────

export interface PlaybackControllerState {
  runtimeState: RuntimeState
  sceneContexts: Record<string, SceneRuntimeContext>
  frame: ActiveRenderFrame | null
  isPlaying: boolean
}

// ─── PlaybackController ──────────────────────────────

export class PlaybackController {
  private sceneContexts: Map<string, SceneRuntimeContext>
  private runtimeState: RuntimeState
  private isPlayingFlag: boolean
  private bundle: StoryBundle
  private executionPlan: StoryExecutionGraph
  private memoryKernel: MemoryKernel

  constructor(bundle: StoryBundle, executionPlan: StoryExecutionGraph) {
    this.bundle = bundle
    this.executionPlan = executionPlan
    this.memoryKernel = new MemoryKernel()

    // 初始化场景记忆
    const init = createSceneRuntimes(executionPlan)
    this.sceneContexts = init.sceneContexts
    this.runtimeState = init.runtimeState
    this.isPlayingFlag = false

    // 注册场景到 MemoryKernel
    for (const scene of bundle.scenes) {
      this.memoryKernel.initScene(scene.scene.id, scene.scene.type)
    }
  }

  /** 启动播放 */
  start(): PlaybackControllerState {
    if (!this.runtimeState.currentSceneId) {
      return this.getControllerState()
    }

    const started = startScene(this.sceneContexts, this.runtimeState, this.runtimeState.currentSceneId)
    this.sceneContexts = started.sceneContexts
    this.runtimeState = started.runtimeState
    this.isPlayingFlag = true

    return this.getControllerState()
  }

  /** 暂停播放 */
  pause(): PlaybackControllerState {
    this.isPlayingFlag = false
    return this.getControllerState()
  }

  /** 恢复播放 */
  resume(): PlaybackControllerState {
    this.isPlayingFlag = true
    return this.getControllerState()
  }

  /** 单帧推进（仅在播放状态有效） */
  tick(deltaTime = 1.0): PlaybackControllerState {
    if (!this.isPlayingFlag || !this.runtimeState.currentSceneId) {
      return this.getControllerState()
    }

    const currentCtx = this.sceneContexts.get(this.runtimeState.currentSceneId)

    // 当前场景未播放 → 自动启动
    if (currentCtx && currentCtx.status === 'idle') {
      const started = startScene(this.sceneContexts, this.runtimeState, this.runtimeState.currentSceneId)
      this.sceneContexts = started.sceneContexts
      this.runtimeState = started.runtimeState
    }

    // 消费 tick 到 MemoryKernel
    // 构建轻量 state 供 memory 消费（避免帧推导开销）
    const sceneCtxMap: Record<string, SceneRuntimeContext> = {}
    for (const [k, v] of this.sceneContexts) sceneCtxMap[k] = v
    this.memoryKernel.consumeTick({
      runtimeState: this.runtimeState,
      sceneContexts: sceneCtxMap,
      frame: null,
      isPlaying: this.isPlayingFlag,
    })

    // tick
    const ticked = tickScene(this.sceneContexts, this.runtimeState, deltaTime)
    this.sceneContexts = ticked.sceneContexts
    this.runtimeState = ticked.runtimeState

    // 场景结束 → 自动完成
    const ctx = this.sceneContexts.get(this.runtimeState.currentSceneId!)
    if (ctx && ctx.shotIndex >= 2) {
      const completedSceneId = this.runtimeState.currentSceneId!

      // 记录场景结果到 MemoryKernel
      const sceneResult: SceneResult = {
        sceneId: completedSceneId,
        sceneType: 'auto',
        intensity: this.runtimeState.intensity,
        speedFactor: ctx.speedFactor ?? 1.0,
        completed: true,
        totalShots: 3,
        executedShots: ctx.shotIndex + 1,
        durationTicks: ctx.sceneTime,
      }
      this.memoryKernel.consumeSceneResult(sceneResult)

      // 记录因果链
      const completedScene = this.bundle.scenes.find(s => s.scene.id === completedSceneId)
      if (completedScene?.scene.relations) {
        for (const [relType, relatedId] of Object.entries(completedScene.scene.relations)) {
          const linkType = relType === 'causedBy' ? 'caused_by'
            : relType === 'resolves' ? 'resolves'
            : 'continues'
          this.memoryKernel.recordCausalLink(relatedId, completedSceneId, linkType as any, 0, `${completedSceneId} ${relType} ${relatedId}`)
        }
      }

      const completed = completeScene(this.sceneContexts, this.runtimeState)
      this.sceneContexts = completed.sceneContexts
      this.runtimeState = completed.runtimeState

      // 有下一场景 → 自动启动
      if (this.runtimeState.currentSceneId) {
        const nextStart = startScene(this.sceneContexts, this.runtimeState, this.runtimeState.currentSceneId)
        this.sceneContexts = nextStart.sceneContexts
        this.runtimeState = nextStart.runtimeState
      } else {
        this.isPlayingFlag = false
      }
    }

    return this.getControllerState()
  }

  /** 跳转到指定 scene 的指定 shot */
  seek(sceneId: string, shotIndex: number): PlaybackControllerState {
    const ctx = this.sceneContexts.get(sceneId)
    if (!ctx) return this.getControllerState()

    this.sceneContexts.set(sceneId, { ...ctx, shotIndex })
    this.runtimeState = {
      ...this.runtimeState,
      currentSceneId: sceneId,
      currentShotIndex: shotIndex,
    }

    return this.getControllerState()
  }

  /** 强制推进镜头 */
  nextShot(): PlaybackControllerState {
    const advanced = advanceShot(this.sceneContexts, this.runtimeState)
    this.sceneContexts = advanced.sceneContexts
    this.runtimeState = advanced.runtimeState
    return this.getControllerState()
  }

  /** 获取全局运行时快照 */
  getControllerState(): PlaybackControllerState {
    const currentScene = this.runtimeState.currentSceneId
      ? this.bundle.scenes.find(s => s.scene.id === this.runtimeState.currentSceneId)
      : null

    const frame = currentScene && this.runtimeState.currentSceneId
      ? executeTimeline(
          this.sceneContexts.get(this.runtimeState.currentSceneId)!,
          this.runtimeState,
          currentScene.timeline
        )
      : null

    const sceneContexts: Record<string, SceneRuntimeContext> = {}
    for (const [key, value] of this.sceneContexts) {
      sceneContexts[key] = value
    }

    return {
      runtimeState: this.runtimeState,
      sceneContexts,
      frame,
      isPlaying: this.isPlayingFlag,
    }
  }

  /** 获取 MemoryKernel（供 Adaptive Kernel 消费） */
  getMemoryKernel(): MemoryKernel {
    return this.memoryKernel
  }
}

export default PlaybackController
