/**
 * timeline/scene-timeline.ts — Phase 1 时间轴导演系统
 *
 * 职责: DERIVED PROJECTION ONLY
 *   ✅ 从 DirectorIR 推导时间维度
 *   ✅ shot 序列化 + 情绪曲线 + 镜头路径 + 连续性格
 *   ❌ 不修改 DirectorIR schema
 *   ❌ 不调 LLM
 *
 * 宪法：
 *   1. Timeline 是 IR 的派生投影，不嵌入 IR
 *   2. 所有函数是纯 deterministic（与 IR 相同输入永远相同输出）
 *   3. continuity.hash 用于跨场景连续性校验
 *   4. 在 DirectorIR 稳定之前 UI 不应消费此层
 */

import type { DirectorIR } from '../prompt/director-ir.js'

// ─── 类型 ─────────────────────────────────────────────────────────

export interface SceneTimeline {
  sceneId: string
  shots: TimelineShot[]
  emotionCurve: EmotionPoint[]
  cameraPath: CameraKeyframe[]
  continuity: ContinuityGraph
}

export interface TimelineShot {
  t: number                    // 时间索引（抽象帧空间）
  shotId: string
  subjectState: unknown        // 角色状态快照
  action: string
  intensity: number            // 强度 0-1
}

export interface EmotionPoint {
  t: number
  emotion: string
  valence: number              // -1 ~ 1（情感正负）
  arousal: number              // 0 ~ 1（情感强度）
}

export interface CameraKeyframe {
  t: number
  shot: string
  movement: string
  lens: string
  framing: string              // 构图类型
}

export interface ContinuityGraph {
  characterLock: unknown[]
  locationLock: string
  stateHash: string
}

// ─── 情绪基准映射（基于 DirectorIR.action.emotion） ────────────

const EMOTION_BASELINE: Record<string, { valence: number; arousal: number }> = {
  'neutral, composed': { valence: 0, arousal: 0.2 },
  'curious, attentive': { valence: 0.2, arousal: 0.5 },
  'casual, composed': { valence: 0.1, arousal: 0.2 },
  'urgent, panicked': { valence: -0.5, arousal: 0.9 },
  'aggressive, determined': { valence: -0.4, arousal: 0.85 },
  'sad, melancholic': { valence: -0.6, arousal: 0.3 },
  'joyful, cheerful': { valence: 0.7, arousal: 0.6 },
  'focused, curious': { valence: 0.3, arousal: 0.5 },
  'expressive, engaged': { valence: 0.4, arousal: 0.6 },
  'calm, patient': { valence: 0.1, arousal: 0.1 },
  'fearful, desperate': { valence: -0.7, arousal: 0.8 },
}

const DEFAULT_EMOTION = { valence: 0, arousal: 0.2 }

// ─── 镜头映射规则（基于 DirectorIR.camera） ───────────────────

function inferFraming(shotType: string): string {
  if (/close.up/i.test(shotType)) return 'tight'
  if (/medium/i.test(shotType)) return 'center'
  if (/wide|full|establishing/i.test(shotType)) return 'wide'
  if (/over.shoulder|over_shoulder/i.test(shotType)) return 'offset'
  if (/aerial|bird/i.test(shotType)) return 'top-down'
  return 'center'
}

// ─── compileSceneTimeline（核心入口） ──────────────────────────

/**
 * 从 DirectorIR 推导 SceneTimeline
 *
 * 这是纯 deterministic 投影：相同 IR → 永远相同 Timeline
 * timeline 是演出层（projection），不修改 IR
 */
export function compileSceneTimeline(ir: DirectorIR, sceneId = 'scene_0'): SceneTimeline {
  return {
    sceneId,
    shots: buildTimelineShots(ir),
    emotionCurve: buildEmotionCurve(ir),
    cameraPath: buildCameraPath(ir),
    continuity: buildContinuityGraph(ir),
  }
}

// ─── buildTimelineShots ──────────────────────────────────────

export function buildTimelineShots(ir: DirectorIR): TimelineShot[] {
  const characters = ir.characters ?? []

  // 从 action/emotion 推导强度
  const emotionBase = EMOTION_BASELINE[ir.action?.emotion] ?? DEFAULT_EMOTION
  const baseIntensity = Math.min(1, emotionBase.arousal * 0.8 + 0.2)

  return [
    {
      t: 0,
      shotId: 'shot_0',
      subjectState: characters,
      action: ir.action?.description || 'idle',
      intensity: Math.round(baseIntensity * 100) / 100,  // clamp to 2 decimals
    },
    {
      t: 1,
      shotId: 'shot_1',
      subjectState: characters,
      action: 'development phase',
      intensity: Math.min(1, baseIntensity + 0.3),
    },
    {
      t: 2,
      shotId: 'shot_2',
      subjectState: characters,
      action: 'conflict escalation',
      intensity: Math.min(1, baseIntensity + 0.7),
    },
  ]
}

// ─── buildEmotionCurve ─────────────────────────────────────

export function buildEmotionCurve(ir: DirectorIR): EmotionPoint[] {
  const base = EMOTION_BASELINE[ir.action?.emotion] ?? DEFAULT_EMOTION

  // 3-point curve: setup → development → peak
  return [
    {
      t: 0,
      emotion: ir.action?.emotion || 'neutral',
      valence: base.valence,
      arousal: Math.min(1, base.arousal),
    },
    {
      t: 1,
      emotion: 'rising tension',
      valence: Math.max(-1, base.valence - 0.2),
      arousal: Math.min(1, base.arousal + 0.3),
    },
    {
      t: 2,
      emotion: 'peak',
      valence: Math.max(-1, base.valence - 0.6),
      arousal: Math.min(1, base.arousal + 0.5),
    },
  ]
}

// ─── buildCameraPath ───────────────────────────────────────

export function buildCameraPath(ir: DirectorIR): CameraKeyframe[] {
  const camera = ir.camera ?? {}
  const shotType = camera.shotType || 'medium'
  const movement = camera.movement || 'static'
  const lens = camera.lens || '50mm'
  const framing = inferFraming(shotType)

  // 3-point camera evolution: establish → approach → intensify
  return [
    {
      t: 0,
      shot: 'establishing',
      movement: 'static',
      lens: '24mm',
      framing: 'wide',
    },
    {
      t: 1,
      shot: shotType,
      movement: movement === 'static' ? 'slow dolly-in' : movement,
      lens: lens,
      framing: framing,
    },
    {
      t: 2,
      shot: /wide|establishing/i.test(shotType) ? 'close-up' : 'extreme close-up',
      movement: 'handheld',
      lens: '85mm',
      framing: 'tight',
    },
  ]
}

// ─── buildContinuityGraph ──────────────────────────────────

export function buildContinuityGraph(ir: DirectorIR): ContinuityGraph {
  return {
    characterLock: ir.characters ?? [],
    locationLock: ir.atmosphere?.location || 'unknown',
    stateHash: computeHash(ir),
  }
}

// ─── 哈希工具（确定性，不依赖 crypto） ────────────────────

/**
 * 轻量 deterministic hash（为了 continuity 校验）
 * 不依赖 Node crypto 模块，仅基于 JSON 字符串
 */
function computeHash(obj: unknown): string {
  try {
    const str = JSON.stringify(obj)
    // 简单的字符和校验（非密码学安全，仅用于 continuity drift 检测）
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash  // Convert to 32bit integer
    }
    return `hash_${Math.abs(hash).toString(36)}`
  } catch {
    return 'hash_unhashable'
  }
}

export default { compileSceneTimeline }
