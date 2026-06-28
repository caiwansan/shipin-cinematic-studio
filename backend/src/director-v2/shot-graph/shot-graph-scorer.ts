/**
 * shot-graph-scorer.ts — Shot Graph Quality Metrics
 *
 * 5 维度评分（0-1）：
 *   - Shot Clarity Score — 每个 shot 意图明确程度
 *   - Spatial Consistency Score — 空间绑定清晰度
 *   - Action Atomicity Score — 动作单一性
 *   - Camera Stability Score — 镜头单一性
 *   - VFX Physicality Score — 特效物理可视化程度
 */

import type { ShotGraph, ShotNode } from './shot-graph-schema.js'

export interface ShotGraphScores {
  overall: number
  dimensions: {
    shotClarity: number
    spatialConsistency: number
    actionAtomicity: number
    cameraStability: number
    vfxPhysicality: number
  }
  perShot: {
    id: string
    scores: ShotScores
  }[]
}

export interface ShotScores {
  clarity: number
  spatial: number
  atomicity: number
  camera: number
  vfx: number
}

// ============================================================
// Scoring Functions
// ============================================================

function scoreShotClarity(shot: ShotNode): number {
  let score = 0.5

  // 意图明确
  if (shot.intent && shot.intent.length > 2) score += 0.15

  // action 不是默认/空
  if (shot.action.length > 8) score += 0.15
  else if (shot.action.length > 4) score += 0.08

  // subject 有具体描述
  if (shot.subject.length >= 1) score += 0.1
  if (shot.subject.some(s => s.length > 4)) score += 0.1

  return Math.min(score, 1)
}

function scoreSpatialConsistency(shot: ShotNode): number {
  let score = 0.4

  const spatialFrame = shot.spatialFrame
  if (!spatialFrame || spatialFrame === 'default scene') return 0.2

  if (spatialFrame.length > 3) score += 0.15
  if (spatialFrame.length > 8) score += 0.15

  // 包含具体地点词
  if (/山|谷|崖|岸|城|村|殿|庙|塔|楼|台|洞|林|原|漠|海|湖|河|场/.test(spatialFrame)) score += 0.15
  if (/殿|庙|塔|楼|台|洞|谷|崖|林/.test(spatialFrame)) score += 0.15 // 更具体

  return Math.min(score, 1)
}

function scoreActionAtomicity(shot: ShotNode): number {
  const action = shot.action

  if (!action || action.length === 0) return 0

  // 禁止的连接词
  const connectors = [/然后/, /接着/, /随后/, /与此同时/, /并 /, /且 /, /同时/]
  let violations = 0
  for (const c of connectors) {
    if (c.test(action)) violations++
  }

  // 禁止的多动作组合
  const multiAction = /(?:和|与)同时|一边.*一边|一方面.*另一方面/
  if (multiAction.test(action)) violations++

  return Math.max(0, 1 - violations * 0.3)
}

function scoreCameraStability(shot: ShotNode): number {
  let score = 0.5

  const cameraType = shot.camera.type
  if (!cameraType || cameraType.length < 2) return 0.2

  // 单一镜头类型（无"/"分隔）
  if (cameraType.includes('/')) score -= 0.2

  // 是否真实镜头类型
  const validTypes = ['aerial', 'low-angle', 'close-up', 'wide', 'over-shoulder', 'medium', 'establishing', 'subjective']
  if (validTypes.some(t => cameraType.includes(t))) score += 0.3

  // 运动描述
  if (shot.camera.movement && shot.camera.movement.length > 2) score += 0.2

  return Math.min(Math.max(score, 0), 1)
}

function scoreVFXPhysicality(shot: ShotNode): number {
  if (!shot.vfx || shot.vfx.length === 0) return 0.5 // 没有 VFX 算中性

  let score = 0.3
  let hasConcrete = false

  for (const v of shot.vfx) {
    // 物理可视关键词
    if (/颜色|色|光|形|轨迹|方向|向外|扩|散|粒子|火花|烟|尘|雾/.test(v)) {
      score += 0.15
      hasConcrete = true
    }
    // 抽象修辞扣分
    if (/很|非常|十分|特别|超强|无与伦比/.test(v)) {
      score -= 0.1
    }
  }

  if (hasConcrete) score += 0.2

  return Math.min(Math.max(score, 0), 1)
}

// ============================================================
// Main Scorer
// ============================================================

export function scoreShotGraph(graph: ShotGraph): ShotGraphScores {
  const perShot: ShotGraphScores['perShot'] = graph.shots.map(shot => {
    const scores: ShotScores = {
      clarity: scoreShotClarity(shot),
      spatial: scoreSpatialConsistency(shot),
      atomicity: scoreActionAtomicity(shot),
      camera: scoreCameraStability(shot),
      vfx: scoreVFXPhysicality(shot),
    }
    return { id: shot.id, scores }
  })

  // 平均分
  const avg = (key: keyof ShotScores) => {
    const sum = perShot.reduce((s, p) => s + p.scores[key], 0)
    return perShot.length > 0 ? sum / perShot.length : 0
  }

  const dimensions = {
    shotClarity: avg('clarity'),
    spatialConsistency: avg('spatial'),
    actionAtomicity: avg('atomicity'),
    cameraStability: avg('camera'),
    vfxPhysicality: avg('vfx'),
  }

  const overall = Object.values(dimensions).reduce((s, v) => s + v, 0) / 5

  return { overall, dimensions, perShot }
}
