/**
 * runtime/state-machine.ts — Phase 4 运行时状态机
 *
 * 职责：定义 Runtime 核心状态类型和状态转换
 *   - RuntimeState: 全局运行时状态快照
 *   - SceneRuntimeStatus: 场景执行状态
 *   - 状态转换是纯函数（不存储副作用）
 *
 * 宪法：
 *   1. 状态类型与业务逻辑分离
 *   2. 不包含任何执行逻辑
 *   3. 状态转换函数是纯 deterministic
 */

// ─── 全局运行时状态 ─────────────────────────────────────

export interface RuntimeState {
  /** 当前播放的场景 ID */
  currentSceneId: string | null
  /** 当前播放的 shot 索引 */
  currentShotIndex: number
  /** 累计播放时间（抽象帧空间） */
  playbackTime: number
  /** 当前强度 0-1 */
  intensity: number
  /** 当前情绪标签 */
  emotionState: string
  /** 当前镜头状态 */
  cameraState: string
  /** 总场景数 */
  totalScenes: number
  /** 已完成的场景数 */
  completedScenes: number
}

// ─── 场景运行时上下文 ──────────────────────────────────

export type SceneRuntimeStatus = 'idle' | 'playing' | 'paused' | 'completed'

export interface SceneRuntimeContext {
  sceneId: string
  status: SceneRuntimeStatus
  /** 当前场景内的 shot 索引 */
  shotIndex: number
  /** 场景内累计时间 */
  sceneTime: number
  /** 当场景的 intensity（来自 executionPlan） */
  baseIntensity: number
  /** 当场景的 speedFactor */
  speedFactor: number
}

// ─── 常量 ───────────────────────────────────────────────

export const INITIAL_RUNTIME_STATE: RuntimeState = {
  currentSceneId: null,
  currentShotIndex: 0,
  playbackTime: 0,
  intensity: 0.3,
  emotionState: 'neutral',
  cameraState: 'idle',
  totalScenes: 0,
  completedScenes: 0,
}

export const INITIAL_SCENE_CONTEXT: Omit<SceneRuntimeContext, 'sceneId' | 'baseIntensity' | 'speedFactor'> = {
  status: 'idle',
  shotIndex: 0,
  sceneTime: 0,
}

// ─── 状态转换辅助 ──────────────────────────────────────

/**
 * 创建新的 SceneRuntimeContext（纯函数）
 */
export function createSceneContext(
  sceneId: string,
  baseIntensity: number,
  speedFactor: number
): SceneRuntimeContext {
  return {
    sceneId,
    status: 'idle',
    shotIndex: 0,
    sceneTime: 0,
    baseIntensity,
    speedFactor,
  }
}

/**
 * 初始化全局 RuntimeState（纯函数）
 */
export function createRuntimeState(
  firstSceneId: string | null,
  totalScenes: number
): RuntimeState {
  return {
    currentSceneId: firstSceneId,
    currentShotIndex: 0,
    playbackTime: 0,
    intensity: 0.3,
    emotionState: 'neutral',
    cameraState: 'idle',
    totalScenes,
    completedScenes: 0,
  }
}

/**
 * 场景状态转换为新状态（纯函数）
 */
export function transitionSceneStatus(
  ctx: SceneRuntimeContext,
  newStatus: SceneRuntimeStatus
): SceneRuntimeContext {
  return { ...ctx, status: newStatus }
}

export default {
  createSceneContext,
  createRuntimeState,
  transitionSceneStatus,
  INITIAL_RUNTIME_STATE,
  INITIAL_SCENE_CONTEXT,
}
