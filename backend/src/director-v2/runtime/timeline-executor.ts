/**
 * runtime/timeline-executor.ts — Phase 4 时间线执行器
 *
 * 职责：从 SceneRuntimeContext + RuntimeState 推导当前帧的
 *   活动 shot、插值后的镜头参数、插值后的情绪状态
 *
 * 宪法：
 *   1. 纯 deterministic（输入→输出，无副作用）
 *   2. 不修改输入对象
 *   3. 提供插值建议（上层决定是否使用）
 */

import type { SceneTimeline, TimelineShot, EmotionPoint, CameraKeyframe } from '../timeline/scene-timeline.js'
import type { SceneRuntimeContext, RuntimeState } from './state-machine.js'

// ─── 类型 ─────────────────────────────────────────────────

export interface ActiveRenderFrame {
  shot: TimelineShot | null
  camera: CameraKeyframe | null
  emotion: EmotionPoint | null
  shotIndex: number
}

export interface InterpolatedFrame {
  shot: TimelineShot | null
  camera: InterpolatedCamera | null
  emotion: InterpolatedEmotion | null
}

export interface InterpolatedCamera {
  shot: string
  movement: string
  lens: string
  framing: string
}

export interface InterpolatedEmotion {
  emotion: string
  valence: number
  arousal: number
}

// ─── executeTimeline ───────────────────────────────────

/**
 * 从当前 RuntimeState 推导活动帧
 *
 * 返回帧中可能为 null（scene 尚未启动或已结束）
 */
export function executeTimeline(
  sceneRuntime: SceneRuntimeContext,
  runtimeState: RuntimeState,
  timeline: SceneTimeline
): ActiveRenderFrame {
  if (sceneRuntime.status !== 'playing') {
    return { shot: null, camera: null, emotion: null, shotIndex: 0 }
  }

  const shotIndex = Math.min(sceneRuntime.shotIndex, timeline.shots.length - 1)
  const shot = timeline.shots[shotIndex] ?? null
  const camera = timeline.cameraPath[shotIndex] ?? null
  const emotion = timeline.emotionCurve[shotIndex] ?? null

  return { shot, camera, emotion, shotIndex }
}

// ─── interpolateFrame ─────────────────────────────────

/**
 * 插值帧：在 Timeline 关键帧之间平滑过渡
 *
 * t 为 0-1 的插值位置（0=上一个关键帧，1=下一个关键帧）
 * 当 t=1 时自动推进到下一帧
 */
export function interpolateFrame(
  timeline: SceneTimeline,
  shotIndex: number,
  t: number
): InterpolatedFrame {
  const currShot = timeline.shots[shotIndex] ?? null
  const nextShot = timeline.shots[shotIndex + 1] ?? null
  const currCamera = timeline.cameraPath[shotIndex] ?? null
  const currEmotion = timeline.emotionCurve[shotIndex] ?? null

  return {
    shot: currShot,
    camera: currCamera
      ? {
          shot: currCamera.shot,
          movement: currCamera.movement,
          lens: currCamera.lens,
          framing: currCamera.framing,
        }
      : null,
    emotion: currEmotion
      ? {
          emotion: currEmotion.emotion,
          valence: currEmotion.valence,
          arousal: Math.min(1, currEmotion.arousal * (0.8 + t * 0.4)),
        }
      : null,
  }
}

export default { executeTimeline, interpolateFrame }
