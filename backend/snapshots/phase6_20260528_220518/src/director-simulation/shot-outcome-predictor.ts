/**
 * Director Simulation Layer — Shot Outcome Predictor
 *
 * 对单个镜头进行预测：
 * - 情绪表达效果
 * - 镜头语言合理性
 * - 观众参与度
 */

import { type DirectorIntentState } from '../cognition-loop/director-intent-state.js'

// ============================================================
// Shot Prediction
// ============================================================

export interface ShotPrediction {
  shotId: string
  predictedEmotion: string
  audienceEngagementScore: number  // 0-1
  cinematicQualityScore: number    // 0-1
  riskFlags: ShotRiskFlag[]
  recommended: 'go' | 'adjust' | 'redesign'
}

export interface ShotRiskFlag {
  type: 'emotion_gap' | 'camera_mismatch' | 'visual_mismatch' | 'composition_error'
  severity: number
  suggestion: string
}

/**
 * 预测单镜头表现
 */
export function predictShotOutcome(
  intentState: DirectorIntentState,
  shot: any,
): ShotPrediction {
  const riskFlags: ShotRiskFlag[] = []
  let engagementScore = 0.7
  let qualityScore = 0.75

  // 1. 镜头类型 → 情绪匹配检查
  const emotionShotMapping: Record<string, string[]> = {
    close_up: ['紧张', '恐惧', '愤怒', '悲伤', '浪漫'],
    extreme_close_up: ['恐惧', '惊讶'],
    medium: ['快乐', '惊讶', '中性'],
    wide: ['快乐', '孤独', '希望', '悲伤'],
  }

  const validShots = emotionShotMapping[shot.shotType] || ['中性']
  if (!validShots.includes(intentState.globalEmotion)) {
    riskFlags.push({
      type: 'emotion_gap',
      severity: 6,
      suggestion: `"${shot.shotType}"不适合表达"${intentState.globalEmotion}"情绪，建议改用${validShots[0]}`,
    })
    engagementScore -= 0.2
    qualityScore -= 0.15
  }

  // 2. 运镜方式合理性
  if (shot.cameraMotion === 'handheld') {
    if (intentState.constraints.handheldOnly) {
      engagementScore += 0.1
    } else if (intentState.globalEmotion === '快乐' || intentState.globalEmotion === '浪漫') {
      riskFlags.push({
        type: 'camera_mismatch',
        severity: 4,
        suggestion: '对于积极情绪，手持运镜可能降低画面美感',
      })
      qualityScore -= 0.1
    }
  }

  // 3. 焦段与景别匹配
  const lensShotMatch: Record<string, string[]> = {
    '24mm': ['wide', 'full'],
    '35mm': ['medium', 'wide'],
    '50mm': ['medium', 'medium_close_up'],
    '85mm': ['close_up', 'medium_close_up'],
    '135mm': ['extreme_close_up', 'close_up'],
  }

  const validLenses = lensShotMatch[shot.lens] || ['medium']
  if (!validLenses.includes(shot.shotType)) {
    riskFlags.push({
      type: 'composition_error',
      severity: 3,
      suggestion: `${shot.lens}焦段与${shot.shotType}景别匹配度低`,
    })
    qualityScore -= 0.08
  }

  // 4. 评分归一化
  engagementScore = Math.max(0, Math.min(1, engagementScore))
  qualityScore = Math.max(0, Math.min(1, qualityScore))

  // 推荐决策
  let recommended: 'go' | 'adjust' | 'redesign' = 'go'
  const highRiskCount = riskFlags.filter(r => r.severity >= 6).length
  if (highRiskCount > 1 || engagementScore < 0.4) recommended = 'redesign'
  else if (riskFlags.length > 0 || qualityScore < 0.6) recommended = 'adjust'

  return {
    shotId: shot.shotId || `shot_${Math.random().toString(36).slice(2, 8)}`,
    predictedEmotion: intentState.globalEmotion,
    audienceEngagementScore: engagementScore,
    cinematicQualityScore: qualityScore,
    riskFlags,
    recommended,
  }
}
