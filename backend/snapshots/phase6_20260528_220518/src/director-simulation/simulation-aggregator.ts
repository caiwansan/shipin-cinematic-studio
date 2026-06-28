/**
 * Director Simulation Layer — Simulation Aggregator & Gatekeeper
 *
 * 汇总所有预演结果，生成总评分和决策。
 * 决策规则：
 *   > 0.85 → GO
 *   0.6 - 0.85 → FIX before execute
 *   < 0.6 → BLOCK & replan
 */

import { type ScenePreSimulation } from './scene-pre-simulator.js'
import { type ShotPrediction } from './shot-outcome-predictor.js'
import { type EmotionTrajectory } from './emotion-trajectory-simulator.js'
import { type ContinuityRiskReport } from './continuity-risk-engine.js'

// ============================================================
// Aggregated Simulation
// ============================================================

export interface AggregatedSimulation {
  sceneId: string
  overallSuccessScore: number  // 0-1
  decision: 'GO' | 'FIX' | 'BLOCK'
  primaryRisks: AggregatedRisk[]
  recommendedFixes: string[]
  detailByModule: {
    scenePreSim: ScenePreSimulation
    shotPredictions: ShotPrediction[]
    emotionTrajectory: EmotionTrajectory
    continuityRisk: ContinuityRiskReport
  }
}

export interface AggregatedRisk {
  source: 'scene' | 'shot' | 'emotion' | 'continuity'
  type: string
  severity: number
  description: string
}

/**
 * 汇总所有预演模块结果，生成总评分和决策
 */
export function aggregateSimulation(
  sceneId: string,
  sceneSim: ScenePreSimulation,
  shotPredictions: ShotPrediction[],
  trajectory: EmotionTrajectory,
  continuity: ContinuityRiskReport,
): AggregatedSimulation {
  const allRisks: AggregatedRisk[] = []
  const fixes: string[] = []

  // 汇总风险
  for (const fp of sceneSim.expectedFailurePoints) {
    allRisks.push({
      source: 'scene',
      type: fp.type,
      severity: fp.severity,
      description: fp.description,
    })
  }

  for (const sp of shotPredictions) {
    for (const rf of sp.riskFlags) {
      allRisks.push({
        source: 'shot',
        type: rf.type,
        severity: rf.severity,
        description: rf.suggestion,
      })
    }
    if (sp.recommended !== 'go') {
      fixes.push(`镜头${sp.shotId}: ${sp.recommended === 'redesign' ? '重新设计' : '调整'}`)
    }
  }

  for (const fz of trajectory.flatZones) {
    allRisks.push({
      source: 'emotion',
      type: 'flat_zone',
      severity: fz.risk === 'critical' ? 8 : 5,
      description: `场景${fz.startScene}-${fz.endScene}连续${fz.duration}个场景节奏平缓`,
    })
  }

  for (const ri of continuity.riskItems) {
    allRisks.push({
      source: 'continuity',
      type: ri.type,
      severity: ri.severity,
      description: ri.description,
    })
    if (ri.severity >= 6) {
      fixes.push(`连续性: ${ri.description}`)
    }
  }

  // 计算总评分
  const weights = {
    sceneSuccess: 0.25,
    shotQuality: 0.25,
    emotionRhythm: 0.25,
    continuity: 0.25,
  }

  const avgShotScore = shotPredictions.length > 0
    ? shotPredictions.reduce((s, p) => s + (p.audienceEngagementScore + p.cinematicQualityScore) / 2, 0) / shotPredictions.length
    : 0.7

  const rawScore =
    sceneSim.successProbability * weights.sceneSuccess +
    avgShotScore * weights.shotQuality +
    trajectory.overallRhythmScore * weights.emotionRhythm +
    (1 - continuity.continuityRiskScore) * weights.continuity

  const highSeverityPenalty = allRisks.filter(r => r.severity >= 7).length * 0.08
  const overallSuccessScore = Math.max(0, Math.min(1, rawScore - highSeverityPenalty))

  // 决策
  let decision: 'GO' | 'FIX' | 'BLOCK' = 'GO'
  const blockReasons = allRisks.filter(r => r.severity >= 8)
  const fixReasons = allRisks.filter(r => r.severity >= 5 && r.severity < 8)

  if (blockReasons.length > 0 || overallSuccessScore < 0.4) {
    decision = 'BLOCK'
  } else if (fixReasons.length > 0 || overallSuccessScore < 0.85) {
    decision = 'FIX'
  }

  // 对高严重度问题添加修复建议
  if (blockReasons.length > 0) {
    fixes.unshift('⚠️ 阻止性风险，需要重新制片规划')
  }

  return {
    sceneId,
    overallSuccessScore,
    decision,
    primaryRisks: allRisks.sort((a, b) => b.severity - a.severity).slice(0, 5),
    recommendedFixes: fixes,
    detailByModule: {
      scenePreSim: sceneSim,
      shotPredictions,
      emotionTrajectory: trajectory,
      continuityRisk: continuity,
    },
  }
}

/**
 * Simulation Gatekeeper — 强制执行
 * 所有 Scene/Shot 必须通过 simulation 才能进入 execution
 */
export function gatekeepSimulation(
  simulations: AggregatedSimulation[],
): { passed: AggregatedSimulation[]; blocked: AggregatedSimulation[]; fixRequired: AggregatedSimulation[] } {
  const passed: AggregatedSimulation[] = []
  const blocked: AggregatedSimulation[] = []
  const fixRequired: AggregatedSimulation[] = []

  for (const sim of simulations) {
    if (sim.decision === 'GO') passed.push(sim)
    else if (sim.decision === 'BLOCK') blocked.push(sim)
    else fixRequired.push(sim)
  }

  return { passed, blocked, fixRequired }
}
