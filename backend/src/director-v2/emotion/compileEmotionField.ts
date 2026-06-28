// ============================================================
// compileEmotionField.ts — Emotion Rendering Engine
// Phase 5: 情绪 = 运行时系统变量
//
// 消费 NarrativeIR + ShotGraph + TimelineGraph，
// 生成逐秒 EmotionKeyframe 叠加层。
//
// 关键设计：
// - overlay system（不修改输入结构）
// - emotion = function of (shot tension, emotion color, lighting, rhythm)
// - 为 Phase 6 音画同步提供 audioIntensity 接口
//
// 铁律：
// - 不修改 IR / ShotGraph / TimelineGraph
// - 不存 prompt/image/video 结果
// ============================================================

import { v4 as uuid } from 'uuid'
import type { NarrativeIR } from '../../types/narrative/ir/NarrativeIR.js'
import type { ShotGraph, ShotNode } from '../../types/cinematic/ShotGraph.js'
import type { TimelineGraph, RhythmBeat } from '../../types/cinematic/TimelineGraph.js'
import type { EmotionField, EmotionKeyframe } from '../../types/cinematic/EmotionField.js'

// ─── 情绪映射常量 ─────────────────────────────────────

/** emotion color → 色调映射 */
const COLOR_MAP: Record<string, 'warm' | 'cool' | 'neutral'> = {
  'fear': 'cool',
  'dread': 'cool',
  'angst': 'cool',
  'sad': 'cool',
  'melancholy': 'cool',
  'grief': 'cool',
  'calm': 'neutral',
  'peace': 'neutral',
  'neutral': 'neutral',
  'joy': 'warm',
  'happy': 'warm',
  'hope': 'warm',
  'excite': 'warm',
  'tension': 'warm',
  'rising': 'warm',
  'climax': 'warm',
  'burst': 'warm',
  'intense': 'warm',
  'rising-tension': 'warm',
  'climax-building': 'warm',
}

/** emotion color → lighting shift baseline */
const LIGHTING_MAP: Record<string, number> = {
  'fear': 0.2,
  'dread': 0.15,
  'angst': 0.25,
  'sad': 0.3,
  'melancholy': 0.3,
  'grief': 0.15,
  'calm': 0.5,
  'peace': 0.6,
  'neutral': 0.5,
  'joy': 0.8,
  'happy': 0.85,
  'hope': 0.7,
  'excite': 0.9,
  'tension': 0.4,
  'rising': 0.5,
  'climax': 0.6,
  'burst': 0.7,
  'intense': 0.5,
  'rising-tension': 0.4,
  'climax-building': 0.5,
}

/** emotion color → audio intensity baseline */
const AUDIO_MAP: Record<string, number> = {
  'fear': 0.6,
  'dread': 0.7,
  'angst': 0.5,
  'sad': 0.3,
  'melancholy': 0.3,
  'grief': 0.2,
  'calm': 0.1,
  'peace': 0.1,
  'neutral': 0.2,
  'joy': 0.4,
  'happy': 0.5,
  'hope': 0.3,
  'excite': 0.8,
  'tension': 0.7,
  'rising': 0.6,
  'climax': 0.9,
  'burst': 0.9,
  'intense': 0.8,
  'rising-tension': 0.6,
  'climax-building': 0.7,
}

// ─── 辅助：在给定时间戳找到活跃的 shot ──────────────
function findActiveShot(
  shots: ShotNode[],
  timeMs: number,
): ShotNode | null {
  return shots.find(s => timeMs >= s.timing.inPoint && timeMs < s.timing.outPoint) || null
}

// ─── 辅助：在给定时间戳找到活跃的 rhythm beat ───────
function findBeatAtTime(
  beats: RhythmBeat[],
  shots: ShotNode[],
  timeS: number,
): RhythmBeat | null {
  const timeMs = timeS * 1000
  for (let bi = 0; bi < beats.length; bi++) {
    const shot = shots.find(s => s.id === beats[bi].shotId)
    if (!shot) continue
    if (timeMs >= shot.timing.inPoint && timeMs < shot.timing.outPoint) {
      return beats[bi]
    }
  }
  return null
}

// ─── 逐秒情绪计算 ─────────────────────────────────────
function computeKeyframe(
  t: number,
  shots: ShotNode[],
  beats: RhythmBeat[],
  globalTone: number,
  globalTension: number,
): EmotionKeyframe {
  const shot = findActiveShot(shots, t * 1000)
  const beat = findBeatAtTime(beats, shots, t)

  // 基础值
  const baseEmotion = shot?.emotionColor || 'neutral'
  const baseLighting = LIGHTING_MAP[baseEmotion] ?? 0.5
  const baseAudio = AUDIO_MAP[baseEmotion] ?? 0.2
  const colorTemp = COLOR_MAP[baseEmotion] ?? 'neutral'

  // 张力修正
  const tension = beat?.tensionValue ?? 0.5
  const tensionContribution = (tension - 0.5) * 0.4  // -0.2 ~ +0.2
  const rhythmContribution = beat ? (beat.rhythmWeight - 0.3) * 0.3 : 0

  // 对比度：张力高 → 高对比
  const contrast = Math.min(1, Math.max(0, 0.5 + tensionContribution * 2))

  // 饱和度：基调亮 → 高饱和
  const saturation = Math.min(1, Math.max(0, 0.5 + (baseLighting - 0.5) * 0.6))

  // 镜头能量：张力 + 节奏
  const cameraEnergy = Math.min(1, Math.max(0, tension * 0.6 + (beat?.rhythmWeight ?? 0.3) * 0.4))

  // lightingShift = 基值 + 张力修正 + 基调修正
  const lightingShift = Math.min(1, Math.max(0,
    baseLighting + tensionContribution + (globalTone - 0.5) * 0.2,
  ))

  // 音频强度 = 情绪基值 + 张力贡献
  const audioIntensity = Math.min(1, Math.max(0,
    baseAudio + tensionContribution + rhythmContribution,
  ))

  return {
    t,
    lightingShift: Math.round(lightingShift * 100) / 100,
    colorTemperature: colorTemp,
    contrast: Math.round(contrast * 100) / 100,
    saturation: Math.round(saturation * 100) / 100,
    cameraEnergy: Math.round(cameraEnergy * 100) / 100,
    audioIntensity: Math.round(audioIntensity * 100) / 100,
  }
}

// ─── 全局情绪汇总 ─────────────────────────────────────
function computeGlobalValues(
  ir: NarrativeIR,
  timeline: TimelineGraph,
): { globalTone: number; globalTension: number; globalIntimacy: number; globalInstability: number } {
  // 从 IR 的 globalTone 和 timeline 的全局张力取
  const toneFromIR = ir.globalTone === 'neutral' ? 0.5
    : ir.globalTone.includes('dark') || ir.globalTone.includes('tragic') ? 0.3
    : ir.globalTone.includes('light') || ir.globalTone.includes('hopeful') ? 0.7
    : 0.5

  const globalTension = timeline.globalTensionCurve.length > 0
    ? timeline.globalTensionCurve.reduce((a, b) => a + b, 0) / timeline.globalTensionCurve.length
    : 0.5

  const globalTone = (toneFromIR + (1 - globalTension) * 0.5) / 1.5
  const globalIntimacy = timeline.sequences.length > 0
    ? 1 - (timeline.sequences.length / Math.max(1, timeline.meta.totalBeats)) * 2
    : 0.5
  const globalInstability = timeline.globalTensionCurve.length > 0
    ? Math.sqrt(timeline.globalTensionCurve.reduce((a, b) => a + b * b, 0) / timeline.globalTensionCurve.length)
    : 0.3

  return {
    globalTone: Math.round(Math.min(1, Math.max(0, globalTone)) * 100) / 100,
    globalTension: Math.round(Math.min(1, Math.max(0, globalTension)) * 100) / 100,
    globalIntimacy: Math.round(Math.min(1, Math.max(0, globalIntimacy)) * 100) / 100,
    globalInstability: Math.round(Math.min(1, Math.max(0, globalInstability)) * 100) / 100,
  }
}

// ─── 情绪动态范围 ─────────────────────────────────────
function computeDynamicRange(curve: EmotionKeyframe[]): number {
  if (curve.length < 2) return 0
  const shifts = curve.map(k => k.lightingShift)
  const avg = shifts.reduce((a, b) => a + b, 0) / shifts.length
  const variance = shifts.reduce((a, b) => a + (b - avg) ** 2, 0) / shifts.length
  return Math.min(1, Math.sqrt(variance) * 3)
}

// ─── 主入口 ──────────────────────────────────────────

/**
 * compileEmotionField: 从 NarrativeIR + ShotGraph + TimelineGraph
 * 生成 EmotionField（逐秒情绪调制参数）
 *
 * 关键设计：
 * - overlay system：不修改任何输入结构
 * - 逐秒 keyframe：每秒计算 lightingShift / colorTemperature / contrast / saturation / cameraEnergy / audioIntensity
 * - audioIntensity 为 Phase 6 音画同步提供接口
 *
 * 可独立运行：输入 IR + ShotGraph + Timeline → 输出 EmotionField
 */
export async function compileEmotionField(
  ir: NarrativeIR,
  shotGraph: ShotGraph,
  timeline: TimelineGraph,
): Promise<EmotionField> {
  const totalSeconds = Math.ceil(timeline.meta.totalDuration)

  // Step 1: 全局情绪
  const globals = computeGlobalValues(ir, timeline)

  // Step 2: 收集所有 rhythm beat（用于时间查询）
  const allBeats = timeline.sequences.flatMap(s => s.beats)

  // Step 3: 逐秒 keyframe
  const curve: EmotionKeyframe[] = []
  for (let t = 0; t < totalSeconds; t++) {
    curve.push(computeKeyframe(t, shotGraph.shots, allBeats, globals.globalTone, globals.globalTension))
  }

  const dynamicRange = computeDynamicRange(curve)

  return {
    projectId: ir.projectId,
    globalTone: globals.globalTone,
    globalTension: globals.globalTension,
    globalIntimacy: globals.globalIntimacy,
    globalInstability: globals.globalInstability,
    curve,
    meta: {
      totalDuration: totalSeconds,
      keyframeCount: curve.length,
      dynamicRange: Math.round(dynamicRange * 100) / 100,
    },
  }
}
