/**
 * Director Simulation Layer — Continuity Risk Engine
 *
 * 预测连续性风险：
 * - 角色外观漂移
 * - 场景空间冲突
 * - 时间线错误
 * - 光影不一致
 */

import { type DirectorIntentState, type SceneIntent } from '../cognition-loop/director-intent-state.js'

// ============================================================
// Continuity Risk
// ============================================================

export interface ContinuityRiskReport {
  continuityRiskScore: number  // 0-1
  riskItems: ContinuityRiskItem[]
  summary: string
}

export interface ContinuityRiskItem {
  type: 'character_appearance' | 'scene_geometry' | 'timeline_error' | 'lighting_shift'
  severity: number       // 1-10
  description: string
  betweenScenes: [number, number]
}

/**
 * 预测连续性风险
 */
export function predictContinuityRisks(
  intentState: DirectorIntentState,
  sceneIntents: SceneIntent[],
  totalScenes: number,
): ContinuityRiskReport {
  const riskItems: ContinuityRiskItem[] = []

  // 1. 角色一致性检查
  const characterCount = Object.keys(intentState.characterStates).length
  if (characterCount > 2 && totalScenes > 5) {
    riskItems.push({
      type: 'character_appearance',
      severity: 6,
      description: `${characterCount}个角色跨${totalScenes}个场景，存在外观漂移风险`,
      betweenScenes: [1, totalScenes],
    })
  }

  // 2. 场景空间连续性
  for (let i = 1; i < sceneIntents.length; i++) {
    const prevScene = sceneIntents[i - 1]
    const currScene = sceneIntents[i]

    // 时间跳跃检查
    if (prevScene.timeOfDay !== currScene.timeOfDay) {
      riskItems.push({
        type: 'timeline_error',
        severity: 4,
        description: `场景${i}到场景${i+1}时间从${prevScene.timeOfDay}跳至${currScene.timeOfDay}，需确认是否合理`,
        betweenScenes: [i, i + 1],
      })
    }

    // 天气突变
    if (prevScene.weather !== currScene.weather) {
      riskItems.push({
        type: 'lighting_shift',
        severity: 3,
        description: `天气从${prevScene.weather}变为${currScene.weather}，需确认过渡合理`,
        betweenScenes: [i, i + 1],
      })
    }
  }

  // 3. 整体一致性评分
  const highRiskCount = riskItems.filter(r => r.severity >= 6).length
  const mediumRiskCount = riskItems.filter(r => r.severity >= 4 && r.severity < 6).length
  const continuityScore = Math.min(1, (highRiskCount * 0.3 + mediumRiskCount * 0.15))

  return {
    continuityRiskScore: continuityScore,
    riskItems,
    summary: `连续性检查: ${riskItems.length}个风险项，${highRiskCount}个高风险，${mediumRiskCount}个中风险`,
  }
}
