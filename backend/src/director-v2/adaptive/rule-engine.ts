/**
 * adaptive/rule-engine.ts — Phase 6 确定性规则引擎（主路径）
 *
 * 职责：从 Runtime Metrics 中检测关键叙事异常
 *   - emotion drift：情绪偏离预期曲线
 *   - pacing imbalance：节奏过快/过慢
 *   - scene stagnation：场景强度无变化
 *   - intensity threshold：超出或低于阈值
 *
 * 输出：触发列表 + 严重度分数
 *
 * 宪法：
 *   1. 纯 deterministic（无 LLM）
 *   2. 不修改任何状态
 *   3. 仅做检测，不做决策
 */

import type { PlaybackControllerState } from '../runtime/playback-controller.js'

// ─── 类型 ─────────────────────────────────────────────────

export interface RuleTrigger {
  ruleId: string
  name: string
  severity: number        // 0-1
  description: string
  target: 'scene' | 'timeline' | 'pacing'
  currentValue?: number
  threshold?: number
}

export interface RuleEngineOutput {
  triggers: RuleTrigger[]
  maxSeverity: number      // 集合中的最高严重度
  hasCriticalTrigger: boolean  // severity > 0.7
}

// ─── 规则检测阈值 ───────────────────────────────────────

const CONFIG = {
  emotionDriftThreshold: 0.5,      // 实际与预期 valence 偏差 > 0.5
  pacingTooFast: 1.6,             // speedFactor > 1.6
  pacingTooSlow: 0.4,             // speedFactor < 0.4（仅极慢场景触发）
  stagnationFrames: 6,            // 连续 tick 强度无变化
  intensityTooLow: 0.1,          // 强度持续 < 0.1
  intensityTooHigh: 0.95,        // 强度 > 0.95 且无 rest scene
}

// ─── 内部状态 ──────────────────────────────────────────

interface StagnationTracker {
  sceneId: string
  unchangedCount: number
  lastIntensity: number
}

const stagnationTrackers = new Map<string, StagnationTracker>()

// ─── analyze ──────────────────────────────────────────

/**
 * 主分析入口：从当前 runtime state 检测所有规则
 */
export function analyze(currentState: PlaybackControllerState, expectedEmotionValence?: number): RuleEngineOutput {
  const triggers: RuleTrigger[] = []
  const rs = currentState.runtimeState

  // 1. Emotion Drift
  if (expectedEmotionValence !== undefined) {
    const drift = Math.abs(rs.intensity - expectedEmotionValence)
    if (drift > CONFIG.emotionDriftThreshold) {
      triggers.push({
        ruleId: 'emotion_drift',
        name: 'Emotion Drift',
        severity: Math.min(1, drift / 1.5),
        description: `实际强度 ${rs.intensity.toFixed(2)} 偏离预期 ${expectedEmotionValence.toFixed(2)}（偏差 ${drift.toFixed(2)}）`,
        target: 'scene',
        currentValue: rs.intensity,
        threshold: CONFIG.emotionDriftThreshold,
      })
    }
  }

  // 2. Pacing imbalance（从场景上下文的 speedFactor）
  // 仅对非开场、已完成场景数量 > 0 的阶段检测 pacing
  const sceneCtx = currentState.sceneContexts?.[rs.currentSceneId ?? '']
  if (sceneCtx && rs.completedScenes > 0) {
    if (sceneCtx.speedFactor > CONFIG.pacingTooFast) {
      triggers.push({
        ruleId: 'pacing_too_fast',
        name: 'Pacing Too Fast',
        severity: Math.min(1, (sceneCtx.speedFactor - CONFIG.pacingTooFast) / 0.5),
        description: `speedFactor ${sceneCtx.speedFactor.toFixed(2)} 超过阈值 ${CONFIG.pacingTooFast}`,
        target: 'pacing',
        currentValue: sceneCtx.speedFactor,
        threshold: CONFIG.pacingTooFast,
      })
    }
    if (sceneCtx.speedFactor < CONFIG.pacingTooSlow) {
      triggers.push({
        ruleId: 'pacing_too_slow',
        name: 'Pacing Too Slow',
        severity: Math.min(1, (CONFIG.pacingTooSlow - sceneCtx.speedFactor) / 0.3),
        description: `speedFactor ${sceneCtx.speedFactor.toFixed(2)} 低于阈值 ${CONFIG.pacingTooSlow}`,
        target: 'pacing',
        currentValue: sceneCtx.speedFactor,
        threshold: CONFIG.pacingTooSlow,
      })
    }
  }

  // 3. Scene Stagnation（强度连续不变）
  if (rs.currentSceneId) {
    const tracker = stagnationTrackers.get(rs.currentSceneId) ?? {
      sceneId: rs.currentSceneId,
      unchangedCount: 0,
      lastIntensity: -1,
    }

    if (Math.abs(rs.intensity - tracker.lastIntensity) < 0.01) {
      tracker.unchangedCount++
    } else {
      tracker.unchangedCount = 0
    }
    tracker.lastIntensity = rs.intensity
    stagnationTrackers.set(rs.currentSceneId, tracker)

    if (tracker.unchangedCount >= CONFIG.stagnationFrames) {
      triggers.push({
        ruleId: 'scene_stagnation',
        name: 'Scene Stagnation',
        severity: Math.min(1, tracker.unchangedCount / 8),
        description: `场景 ${rs.currentSceneId} 连续 ${tracker.unchangedCount} 帧强度无变化`,
        target: 'scene',
        currentValue: tracker.unchangedCount,
        threshold: CONFIG.stagnationFrames,
      })
    }
  }

  // 4. Intensity threshold
  if (rs.intensity <= CONFIG.intensityTooLow && rs.completedScenes > 0) {
    triggers.push({
      ruleId: 'intensity_too_low',
      name: 'Intensity Too Low',
      severity: 0.5,
      description: `当前强度 ${rs.intensity.toFixed(2)} 低于阈值 ${CONFIG.intensityTooLow}`,
      target: 'scene',
      currentValue: rs.intensity,
      threshold: CONFIG.intensityTooLow,
    })
  }
  if (rs.intensity >= CONFIG.intensityTooHigh) {
    triggers.push({
      ruleId: 'intensity_too_high',
      name: 'Intensity Too High (no rest)',
      severity: 0.6,
      description: `当前强度 ${rs.intensity.toFixed(2)} 过高，需 rest scene`,
      target: 'pacing',
      currentValue: rs.intensity,
      threshold: CONFIG.intensityTooHigh,
    })
  }

  const maxSeverity = triggers.length > 0
    ? Math.max(...triggers.map(t => t.severity))
    : 0

  return {
    triggers,
    maxSeverity,
    hasCriticalTrigger: triggers.some(t => t.severity > 0.7),
  }
}

/** 重置停滞检测状态（场景切换时调用） */
export function resetStagnation(sceneId?: string): void {
  if (sceneId) {
    stagnationTrackers.delete(sceneId)
  } else {
    stagnationTrackers.clear()
  }
}

export default { analyze, resetStagnation }
