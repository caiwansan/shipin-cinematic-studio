/**
 * execution/pacing-controller.ts — Phase 3 故事节奏控制器
 *
 * 职责：从 GlobalArc 推导节奏向量
 *   - pacingCurve: 每场景的速度因子（影响播放速度/镜头切换频率）
 *   - globalIntensityCurve: 全局强度曲线
 *   - restPoint: 节奏"呼气点"（低强度场景用于缓冲）
 *
 * 宪法：
 *   1. 纯 deterministic
 *   2. 不修改任何输入结构
 *   3. 节奏建议是参考值，执行端可以覆盖
 */

import type { StoryBundle } from '../story/story-compiler.js'

// ─── 类型 ─────────────────────────────────────────────────

export interface PacingControllerOutput {
  pacingCurve: PacingPoint[]
  globalIntensityCurve: number[]
  restPoints: string[]    // sceneId 列表（节奏缓冲点）
  speedFactors: SpeedFactor[]
}

export interface PacingPoint {
  sceneId: string
  sceneIndex: number
  intensity: number         // -1 to 1（基于 valence × arousal）
  speedFactor: number       // 1.0 = 正常，<1 = 慢速，>1 = 快速
}

export interface SpeedFactor {
  sceneId: string
  factor: number
  reason: string           // trace 来源
}

// ─── computePacing ──────────────────────────────────────

export function computePacing(bundle: StoryBundle): PacingControllerOutput {
  const globalArc = bundle.globalArc
  const pacingCurve: PacingPoint[] = []
  const restPoints: string[] = []
  const speedFactors: SpeedFactor[] = []

  for (let i = 0; i < bundle.scenes.length; i++) {
    const scene = bundle.scenes[i]
    const emotionPoint = globalArc.emotionCurve[i]
    const valence = emotionPoint?.valence ?? 0
    const arousal = emotionPoint?.arousal ?? 0.5

    // intensity = valence × arousal（负值 → 紧张高强度；正值 → 轻松低强度但情绪正面）
    const intensity = Math.round((valence * arousal) * 100) / 100

    // speedFactor: 高 arousal → 快节奏
    let speedFactor = 1.0
    let reason = 'normal pacing'
    if (arousal > 0.8) {
      speedFactor = 1.5
      reason = `high arousal (${arousal}) → fast cutting rate`
    } else if (arousal > 0.6) {
      speedFactor = 1.2
      reason = `medium arousal (${arousal}) → slightly accelerated`
    } else if (arousal < 0.3) {
      speedFactor = 0.8
      reason = `low arousal (${arousal}) → slow, contemplative`
    }

    pacingCurve.push({
      sceneId: scene.scene.id,
      sceneIndex: i,
      intensity,
      speedFactor,
    })

    speedFactors.push({ sceneId: scene.scene.id, factor: speedFactor, reason })

    // rest point 检测：低 arousal 场景 = 节奏缓冲
    if (arousal < 0.35 && valence >= 0) {
      restPoints.push(scene.scene.id)
    }
  }

  // global intensity curve
  const globalIntensityCurve = globalArc.emotionCurve.map(
    p => Math.round(Math.abs(p.valence) * p.arousal * 10) / 10
  )

  return {
    pacingCurve,
    globalIntensityCurve,
    restPoints,
    speedFactors,
  }
}

export default { computePacing }
