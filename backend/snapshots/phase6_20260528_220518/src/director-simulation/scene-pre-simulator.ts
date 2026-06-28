/**
 * Director Simulation Layer — Scene Pre-Simulator
 *
 * 对每个 scene 做"未生成预演"，预测：
 * - success_probability
 * - emotional_alignment_score
 * - visual_coherence_score
 * - continuity_risk
 * - expected_failure_points
 */

import { type DirectorIntentState } from '../cognition-loop/director-intent-state.js'

// ============================================================
// Scene Pre-Simulation
// ============================================================

export interface ScenePreSimulation {
  sceneId: string
  sceneName: string
  successProbability: number       // 0-1
  emotionalAlignmentScore: number  // 0-1
  visualCoherenceScore: number     // 0-1
  continuityRisk: 'low' | 'medium' | 'high'
  expectedFailurePoints: FailurePoint[]
  detail: string
}

export interface FailurePoint {
  type: 'lighting_mismatch' | 'emotion_underdelivery' | 'camera_instability' | 'character_drift' | 'scene_conflict'
  severity: number  // 1-10
  description: string
}

/**
 * 模拟单个场景的生成质量
 */
export function simulateScene(
  intentState: DirectorIntentState,
  sceneBlueprint: any,
  shotPlan: any[],
): ScenePreSimulation {
  const failurePoints: FailurePoint[] = []
  let successProbability = 0.85
  let emotionalScore = 0.8
  let visualScore = 0.8

  // 1. 检查场景情绪与全局情绪是否一致
  const sceneMood = sceneBlueprint.primaryMood || intentState.globalEmotion
  if (sceneMood !== intentState.globalEmotion) {
    emotionalScore -= 0.15
    successProbability -= 0.08
    failurePoints.push({
      type: 'emotion_underdelivery',
      severity: 4,
      description: `场景情绪"${sceneMood}"与全局情绪"${intentState.globalEmotion}"不完全一致`,
    })
  }

  // 2. 检查镜头复杂度
  if (shotPlan.length > 8) {
    visualScore -= 0.1
    successProbability -= 0.05
    failurePoints.push({
      type: 'camera_instability',
      severity: 3,
      description: '镜头过多(>8)，可能存在运镜不稳定风险',
    })
  }

  // 3. 检查约束冲突
  const constraints = intentState.constraints
  if (constraints.handheldOnly && shotPlan.some(s => s.cameraMotion === 'static')) {
    failurePoints.push({
      type: 'camera_instability',
      severity: 7,
      description: '导演要求手持运镜但脚本包含静态镜头',
    })
    visualScore -= 0.25
    successProbability -= 0.15
  }

  if (constraints.lowLightOnly && shotPlan.some(s => s.lighting === 'high_key')) {
    failurePoints.push({
      type: 'lighting_mismatch',
      severity: 6,
      description: '导演要求低光但脚本包含高调光',
    })
    visualScore -= 0.2
    successProbability -= 0.12
  }

  // 4. 检查角色数量
  const characterCount = Object.keys(intentState.characterStates).length
  if (characterCount > 3 && shotPlan.length < 5) {
    failurePoints.push({
      type: 'character_drift',
      severity: 5,
      description: `${characterCount}个角色挤在${shotPlan.length}个镜头中，角色区分度有风险`,
    })
    visualScore -= 0.1
    successProbability -= 0.08
  }

  // 连续性风险评估
  let continuityRisk: 'low' | 'medium' | 'high' = 'low'
  const highSeverityCount = failurePoints.filter(f => f.severity >= 6).length
  if (highSeverityCount >= 2) continuityRisk = 'high'
  else if (highSeverityCount >= 1) continuityRisk = 'medium'

  return {
    sceneId: sceneBlueprint.sceneId || 'unknown',
    sceneName: sceneBlueprint.sceneName || '未命名场景',
    successProbability: Math.max(0, Math.min(1, successProbability)),
    emotionalAlignmentScore: Math.max(0, Math.min(1, emotionalScore)),
    visualCoherenceScore: Math.max(0, Math.min(1, visualScore)),
    continuityRisk,
    expectedFailurePoints: failurePoints,
    detail: `场景预演: ${failurePoints.length}个风险点，${continuityRisk}连续性风险`,
  }
}
