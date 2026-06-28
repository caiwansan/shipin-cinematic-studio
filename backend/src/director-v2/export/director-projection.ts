/**
 * export/director-projection.ts — 语义投影层
 *
 * 职责：将 director-v2 Runtime 执行结果"投影"为 studio-v2 兼容的语义提示。
 * 这不是转换层（不生成 media assets），而是建议层（hints only）。
 *
 * 宪法：
 *   - 不修改 IR/Timeline/ExecutionPlan
 *   - 不生成最终媒体资产
 *   - 不调用 studio-v2 pipeline
 */

import type { PlaybackControllerState } from '../runtime/playback-controller.js'

// ─── 类型 ─────────────────────────────────────────────────

export interface DirectorProjection {
  sessionId: string
  projectedAt: number
  totalScenes: number
  completedScenes: number
  scenes: SceneHint[]
  summary: string
}

export interface SceneHint {
  sceneId: string
  suggestedTitle: string | null
  pacingHint: 'slow' | 'normal' | 'fast'
  emotionalTone: string
  shotPriority: string[]
  suggestedAssetCategories: string[]
  timing: {
    durationSeconds: number
    shotCount: number
  }
}

// ─── 情感色调 → 推荐资产类别映射 ──────────────────────

const TONE_TO_ASSETS: Record<string, string[]> = {
  dark: ['low_light_scene', 'shadow_effect', 'deep_bg_music'],
  bright: ['high_key_lighting', 'warm_filter', 'upbeat_music'],
  tense: ['rapid_cut', 'shaky_cam', 'intense_soundtrack'],
  calm: ['long_take', 'soft_lighting', 'ambient_sound'],
  sad: ['cool_filter', 'slow_motion', 'melancholic_music'],
  joyful: ['warm_filter', 'fast_pan', 'cheerful_music'],
  neutral: ['balanced_lighting', 'standard_cut', 'neutral_bg'],
}

// ─── Projection Engine ───────────────────────────────

/**
 * 从 Runtime 状态投影为 studio 可消费的语义提示
 */
export function projectRuntimeToStudioHints(
  state: PlaybackControllerState,
  sessionId: string,
): DirectorProjection {
  const state_ = state.runtimeState
  const sceneCount = state_.totalScenes
  const completed = state_.completedScenes

  // 生成每一场景的提示
  const scenes: SceneHint[] = []

  for (const ctxKey of Object.keys(state.sceneContexts)) {
    const ctx = state.sceneContexts[ctxKey]
    if (!ctx) continue

    // 从 intensity 推导情感色调
    const intensity = ctx.baseIntensity ?? 0.5
    const emotionalTone = intensity > 0.7 ? 'tense'
      : intensity > 0.5 ? 'dark'
      : intensity > 0.3 ? 'calm'
      : 'neutral'

    // 从 speedFactor 推导节奏
    const speed = ctx.speedFactor ?? 1.0
    const pacingHint: 'slow' | 'normal' | 'fast' = speed > 1.3 ? 'fast'
      : speed < 0.7 ? 'slow'
      : 'normal'

    // 推导建议资产类别
    const suggestedAssetCategories = TONE_TO_ASSETS[emotionalTone] ?? TONE_TO_ASSETS.neutral

    scenes.push({
      sceneId: ctx.sceneId,
      suggestedTitle: null,
      pacingHint,
      emotionalTone,
      shotPriority: [],
      suggestedAssetCategories,
      timing: {
        durationSeconds: ctx.sceneTime ?? 0,
        shotCount: ctx.shotIndex + 1,
      },
    })
  }

  // 剩余未开始的场景（从 state 推断）
  for (let i = completed; i < sceneCount; i++) {
    const sceneId = `scene_${i}`
    if (!scenes.find(s => s.sceneId === sceneId)) {
      scenes.push({
        sceneId,
        suggestedTitle: null,
        pacingHint: 'normal',
        emotionalTone: 'neutral',
        shotPriority: [],
        suggestedAssetCategories: [...TONE_TO_ASSETS.neutral],
        timing: { durationSeconds: 0, shotCount: 0 },
      })
    }
  }

  // 摘要
  const activeTones = scenes.map(s => s.emotionalTone)
  const dominantTone = mostFrequent(activeTones)
  const summary = `已完成 ${completed}/${sceneCount} 场景 · 主导情绪: ${dominantTone} · 共 ${scenes.length} 场景`

  return {
    sessionId,
    projectedAt: Date.now(),
    totalScenes: sceneCount,
    completedScenes: completed,
    scenes,
    summary,
  }
}

// ─── 辅助 ─────────────────────────────────────────────

function mostFrequent(items: string[]): string {
  const map = new Map<string, number>()
  let maxCount = 0
  let maxItem = items[0] ?? 'neutral'
  for (const item of items) {
    const count = (map.get(item) ?? 0) + 1
    map.set(item, count)
    if (count > maxCount) {
      maxCount = count
      maxItem = item
    }
  }
  return maxItem
}

export default { projectRuntimeToStudioHints }
