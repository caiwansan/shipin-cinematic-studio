/**
 * execution/scene-sequencer.ts — Phase 3 场景执行排序系统
 *
 * 职责：从 StoryBundle 生成每场景的执行计划
 *   - order: 叙事顺序
 *   - durationWeight: 基于 arousal 的场景时长权重
 *   - emotionalWeight: 基于 valence 的情感权重
 *   - cameraIntensity: 基于镜头类型的视觉强度
 *
 * 宪法：
 *   1. 纯 deterministic（不调 LLM）
 *   2. 不修改 StoryBundle / IR / Timeline
 *   3. ExecutionPlan 是 StoryBundle 的派生投影
 */

import type { StoryBundle } from '../story/story-compiler.js'

// ─── 类型 ─────────────────────────────────────────────────

export interface SceneExecutionPlan {
  sceneId: string
  order: number
  durationWeight: number    // 0-1（时长系数 >0.7 应延长播放）
  emotionalWeight: number   // -1 to 1（正=轻松，负=紧张）
  cameraIntensity: number   // 0-1（镜头动感强度）
  triggerCondition?: string // 可选：触发条件描述
}

export interface TransitionRule {
  fromSceneId: string
  toSceneId: string
  transition: 'cut' | 'crossfade' | 'fade_to_black' | 'match_cut'
  timingHint?: string
}

// ─── 镜头强度映射 ────────────────────────────────────────

const CAMERA_INTENSITY_MAP: Record<string, number> = {
  'close-up': 0.8,
  'extreme close-up': 0.9,
  'medium close-up': 0.6,
  'medium shot': 0.5,
  'medium': 0.5,
  'wide shot': 0.3,
  'wide': 0.3,
  'full shot': 0.4,
  'dynamic shot': 0.85,
  'establishing': 0.2,
  'over-shoulder': 0.5,
}

function resolveCameraIntensity(shotType: string): number {
  const key = Object.keys(CAMERA_INTENSITY_MAP).find(
    k => shotType.toLowerCase().includes(k)
  )
  return key ? CAMERA_INTENSITY_MAP[key] : 0.5
}

// ─── 过渡推断 ──────────────────────────────────────────

function inferTransition(arousePrev: number, arouseCurr: number): TransitionRule['transition'] {
  if (arouseCurr > 0.8 && arousePrev < 0.4) return 'fade_to_black'
  if (Math.abs(arouseCurr - arousePrev) > 0.4) return 'crossfade'
  if (arouseCurr < 0.3) return 'fade_to_black'
  return 'cut'
}

// ─── sequenceScenes ────────────────────────────────────

export function sequenceScenes(bundle: StoryBundle): {
  plans: SceneExecutionPlan[]
  transitions: TransitionRule[]
} {
  const plans: SceneExecutionPlan[] = []
  const transitions: TransitionRule[] = []
  const globalArc = bundle.globalArc

  let prevArousal = 0.3

  for (let i = 0; i < bundle.scenes.length; i++) {
    const scene = bundle.scenes[i]
    const emotionPoint = globalArc.emotionCurve[i]
    const ir = scene.ir

    const arousal = emotionPoint?.arousal ?? 0.5
    const valence = emotionPoint?.valence ?? 0
    const cameraIntensity = resolveCameraIntensity(ir.camera?.shotType ?? '')

    plans.push({
      sceneId: scene.scene.id,
      order: i,
      durationWeight: Math.min(1, Math.round((arousal * 1.2) * 100) / 100),
      emotionalWeight: Math.round(valence * 100) / 100,
      cameraIntensity: Math.round(cameraIntensity * 100) / 100,
      triggerCondition: scene.scene.relations
        ? Object.entries(scene.scene.relations)
            .map(([k, v]) => `${k}:${v}`)
            .join(', ')
        : undefined,
    })

    // 过渡规则
    if (i > 0) {
      const prevEmotion = globalArc.emotionCurve[i - 1]
      transitions.push({
        fromSceneId: bundle.scenes[i - 1].scene.id,
        toSceneId: scene.scene.id,
        transition: inferTransition(prevEmotion?.arousal ?? 0.3, arousal),
        timingHint: prevEmotion && arousal > 0.8
          ? 'tension_peak_before_cut'
          : arousal > 0.6
            ? 'rising_action'
            : 'calm_transition',
      })
    }

    prevArousal = arousal
  }

  return { plans, transitions }
}

export default { sequenceScenes }
