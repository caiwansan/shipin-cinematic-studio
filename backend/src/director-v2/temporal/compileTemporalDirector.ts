// ============================================================
// compileTemporalDirector.ts — Temporal Director Engine
// Phase 4: ShotGraph → TimelineGraph（时间节奏生成器）
//
// 核心逻辑：
// 1. 遍历 ShotGraph，为每个 shot 计算节奏节拍
// 2. 基于 camera movement + intent weight + shot duration 推断 cut type
// 3. 基于情绪变化检测序列断点（tension drop > 阈值）
// 4. 生成全局情绪/张力曲线
//
// 铁律：
// - 不修改 ShotGraph
// - 不引用 NarrativeIR
// - 节奏由"时间结构"驱动，非镜头质量
// ============================================================

import { v4 as uuid } from 'uuid'
import type { ShotGraph, ShotNode } from '../../types/cinematic/ShotGraph.js'
import type {
  TimelineGraph,
  Sequence,
  RhythmBeat,
  CutType,
} from '../../types/cinematic/TimelineGraph.js'

// ─── 常量 ─────────────────────────────────────────────
const SEQUENCE_BREAK_TENSION_DROP = 0.4   // 张力下降 > 0.4 触发序列分割
const MIN_BEATS_PER_SEQUENCE = 2           // 最少 2 拍才构成一个序列

// ─── Emotion value from shot ─────────────────────────
// 简单映射：从 emotional color / lighting mood 推算 0-1
function getEmotionValue(shot: ShotNode): number {
  const emotion = shot.emotionColor.toLowerCase()
  if (emotion.includes('fear') || emotion.includes('angst') || emotion.includes('dread')) return 0.2
  if (emotion.includes('sad') || emotion.includes('melancholy') || emotion.includes('grief')) return 0.3
  if (emotion.includes('calm') || emotion.includes('peace') || emotion.includes('neutral')) return 0.5
  if (emotion.includes('joy') || emotion.includes('happy') || emotion.includes('hope')) return 0.7
  if (emotion.includes('excite') || emotion.includes('tension') || emotion.includes('rising')) return 0.8
  if (emotion.includes('climax') || emotion.includes('burst') || emotion.includes('intense')) return 0.9
  // Fallback: lighting mood
  const light = shot.lighting.mood
  if (light === 'low-key' || light === 'chiaroscuro' || light === 'neon-noir') return 0.3
  if (light === 'natural' || light === 'golden-hour') return 0.6
  if (light === 'high-key') return 0.8
  return 0.5
}

// ─── Tension value from shot ─────────────────────────
function getTensionValue(shot: ShotNode): number {
  const base = shot.camera.intensity
  const movementBonus = (
    shot.camera.movement === 'handheld-shake' ||
    shot.camera.movement === 'dolly-zoom' ||
    shot.camera.movement === 'whip-pan'
  ) ? 0.3 : 0

  const contrastBonus = shot.lighting.contrast * 0.2
  const depthTension = (1 - shot.composition.depth) * 0.2  // 浅景深 = 更高张力

  return Math.min(1, Math.round((base + movementBonus + contrastBonus + depthTension) * 10) / 10)
}

// ─── Cut type inference ──────────────────────────────
function inferCutType(
  curr: ShotNode,
  next: ShotNode | null,
  tensionDelta: number,
): CutType {
  if (!next) return 'fade'  // 最后一个镜头淡出

  // Dramatic 变化
  if (tensionDelta < -0.5) return 'smash-cut'   // 张力骤降
  if (tensionDelta > 0.5) return 'jump-cut'     // 张力骤升

  // Movement 连续性
  if (curr.camera.movement === next.camera.movement) {
    if (curr.camera.type === next.camera.type) return 'invisible-cut'
    return 'match-cut'
  }

  // Camera type 变化
  if (curr.camera.type !== next.camera.type) {
    if (curr.camera.type === 'extreme-wide' && next.camera.type === 'closeup') return 'smash-cut'
    return 'hard-cut'
  }

  // Default
  if (tensionDelta > 0.2) return 'jump-cut'
  if (tensionDelta < -0.2) return 'fade'
  return 'hard-cut'
}

// ─── Rhythm weight ───────────────────────────────────
function getRhythmWeight(shot: ShotNode): number {
  const movementWeight: Record<string, number> = {
    'static': 0.2,
    'pan': 0.3,
    'tilt': 0.3,
    'push-in': 0.5,
    'pull-out': 0.4,
    'tracking': 0.4,
    'dolly-zoom': 0.9,
    'crane-up': 0.5,
    'crane-down': 0.5,
    'handheld-shake': 0.8,
    'whip-pan': 0.9,
    'steady-cam': 0.3,
  }
  const base = movementWeight[shot.camera.movement] || 0.3
  return Math.min(1, Math.round((base + shot.camera.intensity * 0.5) * 10) / 10)
}

// ─── Overall rhythm for a sequence ──────────────────
function getOverallRhythm(beats: RhythmBeat[]): Sequence['overallRhythm'] {
  if (beats.length === 0) return 'medium'
  const avgWeight = beats.reduce((s, b) => s + b.rhythmWeight, 0) / beats.length
  const variance = beats.reduce((s, b) => s + (b.rhythmWeight - avgWeight) ** 2, 0) / beats.length

  if (variance > 0.08) return 'alternating'
  if (avgWeight > 0.6) return 'fast'
  if (avgWeight < 0.35) return 'slow'
  return 'medium'
}

// ─── 主入口 ──────────────────────────────────────────

/**
 * compileTemporalDirector: 从 ShotGraph 生成 TimelineGraph（时间节奏结构）
 *
 * 流程：
 * 1. 遍历所有 shot，为每个生成 RhythmBeat（cut type / rhythm weight / emotion / tension）
 * 2. 基于 tension 变化检测 sequence 断点
 * 3. 构建全局情绪/张力曲线
 *
 * 可独立运行：输入 ShotGraph，输出 TimelineGraph
 */
export async function compileTemporalDirector(shotGraph: ShotGraph): Promise<TimelineGraph> {
  const sequences: Sequence[] = []
  let currentBeats: RhythmBeat[] = []

  // Step 1: 为每个 shot 生成 RhythmBeat
  for (let si = 0; si < shotGraph.shots.length; si++) {
    const shot = shotGraph.shots[si]
    const nextShot = si < shotGraph.shots.length - 1 ? shotGraph.shots[si + 1] : null

    const emotionValue = getEmotionValue(shot)
    const tensionValue = getTensionValue(shot)
    const prevTension = currentBeats.length > 0
      ? currentBeats[currentBeats.length - 1].tensionValue
      : 0.5
    const tensionDelta = tensionValue - prevTension

    const beat: RhythmBeat = {
      shotId: shot.id,
      duration: shot.timing.duration,
      cutType: inferCutType(shot, nextShot, tensionDelta),
      rhythmWeight: getRhythmWeight(shot),
      emotionValue,
      tensionValue,
    }

    // Step 2: Sequence break 检测
    const shouldBreak = (
      tensionDelta < -SEQUENCE_BREAK_TENSION_DROP &&
      currentBeats.length >= MIN_BEATS_PER_SEQUENCE
    )

    if (shouldBreak) {
      // 保存当前序列
      sequences.push(buildSequence(currentBeats, sequences.length))
      currentBeats = []
    }

    currentBeats.push(beat)
  }

  // 最后一个序列
  if (currentBeats.length > 0) {
    sequences.push(buildSequence(currentBeats, sequences.length))
  }

  // Step 3: 构建 TimelineGraph
  const allBeats = sequences.flatMap(s => s.beats)
  const totalDuration = allBeats.reduce((s, b) => s + b.duration, 0)

  // cut type 分布
  const cutDist: Record<string, number> = {}
  for (const b of allBeats) {
    cutDist[b.cutType] = (cutDist[b.cutType] || 0) + 1
  }

  // rhythm range: 节奏权重标准差
  const avgWeight = allBeats.length > 0
    ? allBeats.reduce((s, b) => s + b.rhythmWeight, 0) / allBeats.length
    : 0.5
  const weightVariance = allBeats.length > 0
    ? allBeats.reduce((s, b) => s + (b.rhythmWeight - avgWeight) ** 2, 0) / allBeats.length
    : 0
  const rhythmRange = Math.min(1, Math.sqrt(weightVariance) * 2)

  const timeline: TimelineGraph = {
    projectId: shotGraph.projectId,
    sequences,
    globalEmotionCurve: allBeats.map(b => b.emotionValue),
    globalTensionCurve: allBeats.map(b => b.tensionValue),
    meta: {
      totalDuration: Math.round(totalDuration * 10) / 10,
      sequenceCount: sequences.length,
      totalBeats: allBeats.length,
      cutTypeDistribution: cutDist as any,
      rhythmRange: Math.round(rhythmRange * 100) / 100,
    },
  }

  return timeline
}

// ─── 辅助：构建 Sequence ────────────────────────────

function buildSequence(beats: RhythmBeat[], idx: number): Sequence {
  const names = [
    'opening', 'rising-tension', 'climax-build', 'climax',
    'falling-action', 'resolution', 'transition',
  ]
  const nameSeq = names[idx % names.length]

  return {
    id: `seq-${idx}`,
    name: nameSeq,
    beats,
    emotionCurve: beats.map(b => b.emotionValue),
    tensionCurve: beats.map(b => b.tensionValue),
    overallRhythm: getOverallRhythm(beats),
    totalDuration: Math.round(beats.reduce((s, b) => s + b.duration, 0) * 10) / 10,
  }
}
