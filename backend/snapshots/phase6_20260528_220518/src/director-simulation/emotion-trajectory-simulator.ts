/**
 * Director Simulation Layer — Emotion Trajectory Simulator
 *
 * 模拟整集情绪走势：
 * - 是否有断点
 * - 是否有爆点
 * - 是否节奏过平
 * - 整体漂移风险
 */

import { type DirectorIntentState } from '../cognition-loop/director-intent-state.js'

// ============================================================
// Trajectory Simulation
// ============================================================

export interface EmotionTrajectory {
  episodeId: string
  emotionCurve: EmotionPoint[]
  tensionPeaks: TensionPeak[]
  flatZones: FlatZone[]
  driftRisk: number     // 0-1
  overallRhythmScore: number  // 0-1
  summary: string
}

export interface EmotionPoint {
  sceneIndex: number
  emotion: string
  intensity: number   // 1-10
  tension: number     // 1-10
}

export interface TensionPeak {
  sceneIndex: number
  type: 'hook' | 'climax' | 'reversal'
  intensity: number
}

export interface FlatZone {
  startScene: number
  endScene: number
  duration: number     // 连续平缓场景数
  risk: 'warning' | 'critical'
}

/**
 * 模拟整集情绪轨迹
 */
export function simulateEmotionTrajectory(
  intentState: DirectorIntentState,
  scenePlans: any[],
): EmotionTrajectory {
  const curve: EmotionPoint[] = []
  const peaks: TensionPeak[] = []
  const flatZones: FlatZone[] = []
  let driftRisk = 0.1

  // 生成情绪曲线
  scenePlans.forEach((scene, index) => {
    const intensityVariation = Math.sin((index / scenePlans.length) * Math.PI * 2) * 3
    const baseIntensity = 5 + intensityVariation
    const baseTension = 4 + Math.sin((index / scenePlans.length) * Math.PI) * 4

    curve.push({
      sceneIndex: index + 1,
      emotion: scene.primaryMood || intentState.globalEmotion,
      intensity: Math.min(10, Math.max(1, Math.round(baseIntensity))),
      tension: Math.min(10, Math.max(1, Math.round(baseTension))),
    })
  })

  // 检测张力高峰
  for (let i = 1; i < curve.length - 1; i++) {
    const prev = curve[i - 1]
    const curr = curve[i]
    const next = curve[i + 1]

    if (curr.tension > prev.tension && curr.tension > next.tension && curr.tension >= 7) {
      peaks.push({
        sceneIndex: curr.sceneIndex,
        type: curr.tension >= 9 ? 'climax' : curr.tension >= 7 ? 'hook' : 'reversal',
        intensity: curr.tension,
      })
    }
  }

  // 检测平缓区域
  let flatStart = -1
  for (let i = 0; i < curve.length; i++) {
    if (curve[i].tension <= 4 && curve[i].intensity <= 4) {
      if (flatStart === -1) flatStart = i
    } else {
      if (flatStart !== -1 && (i - flatStart) >= 3) {
        flatZones.push({
          startScene: flatStart + 1,
          endScene: i,
          duration: i - flatStart,
          risk: (i - flatStart) >= 5 ? 'critical' : 'warning',
        })
      }
      flatStart = -1
    }
  }

  // 计算漂移风险
  const totalScenes = scenePlans.length
  const emotionDistinct = new Set(curve.map(c => c.emotion)).size
  if (emotionDistinct <= 2 && totalScenes > 4) {
    driftRisk += 0.3  // 情绪太单一
  }
  if (peaks.length === 0 && totalScenes > 3) {
    driftRisk += 0.4  // 没有高峰
  }
  driftRisk = Math.min(1, driftRisk)

  // 整体节奏评分
  const hasPeaks = peaks.length > 0 ? 0.3 : 0
  const noCriticalFlats = flatZones.filter(f => f.risk === 'critical').length === 0 ? 0.3 : 0
  const goodEmotionRange = emotionDistinct >= 3 ? 0.2 : 0
  const notTooFlat = driftRisk < 0.5 ? 0.2 : 0
  const overallRhythmScore = Math.min(1, hasPeaks + noCriticalFlats + goodEmotionRange + notTooFlat)

  return {
    episodeId: intentState.episodeId,
    emotionCurve: curve,
    tensionPeaks: peaks,
    flatZones,
    driftRisk,
    overallRhythmScore,
    summary: `共${totalScenes}个场景，${peaks.length}个张力高峰，${flatZones.length}个平缓区域，节奏评分${(overallRhythmScore * 100).toFixed(0)}分`,
  }
}
