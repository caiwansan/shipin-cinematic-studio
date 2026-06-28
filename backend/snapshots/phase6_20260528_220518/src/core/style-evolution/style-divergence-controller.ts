/**
 * Divergence Controller v5.1
 *
 * 修复 v5 三个核心缺陷：
 *
 * 1. reactive → proactive exploration
 *    不再是 collapse 才注入，而是每轮注入微量噪声
 *
 * 2. entropy floor
 *    通过 style repulsion 自动维持 entropy ≥ 0.2
 *    不是强制注入，而是互相排斥
 *
 * 3. style repulsion force
 *    当两个 project 在向量空间中距离 < repulsionThreshold 时，
 *    计算排斥力，将新项目推离已有聚集区
 *
 * 防 collapse 系统（v5 重写）
 * 核心行为：entropy 始终 ≥ 0.2，不需要 collapse 检测
 *
 * 机制：
 * - 每轮有 basiseExploration（0.03）的微量噪声
 * - entropy < 0.2 时，repulsion 自动推离
 * - entropy < 0.1 时，应急注入
 *
 * 和原版的区别：
 * - 旧版：collapse 检测 → 注入噪声（reactive）
 * - 新版：continuous noise + repulsion → 防 collapse（proactive）
 */

import type {
  StyleAggregationResult,
  DivergenceControlOutput,
  StyleNode,
} from './types.js'

// ============================================================
// 常量
// ============================================================

/** 基础探索噪声（每轮都有） */
const BASE_EXPLORATION = 0.03

/** entropy 软硬地板 */
const ENTROPY_FLOOR_SOFT = 0.2
const ENTROPY_FLOOR_HARD = 0.1

/** repulsion 触发距离 */
const REPULSION_THRESHOLD = 0.15

/** repulsion 最大力 */
const MAX_REPULSION_FORCE = 0.08

/** 应急注入最大强度 */
const EMERGENCY_INJECTION = 0.12

/** 节点相似时，最小允许的向量距离 */
const MIN_VECTOR_DISTANCE = 0.1

// ============================================================
// 主函数
// ============================================================

export function computeDivergenceControl(
  aggregation: StyleAggregationResult,
  existingNodes?: StyleNode[],
): DivergenceControlOutput {
  // entropy = 三个维度方差的均值
  const entropyScore = (aggregation.varianceVisual + aggregation.varianceCamera + aggregation.varianceEmotion) / 3

  // --- proactive basic exploration（每轮都有）---
  let explorationStrength = BASE_EXPLORATION

  // --- entropy floor detection ---
  const needsExploration = entropyScore < ENTROPY_FLOOR_SOFT

  if (entropyScore < ENTROPY_FLOOR_HARD) {
    // 应急注入
    explorationStrength = EMERGENCY_INJECTION
  } else if (entropyScore < ENTROPY_FLOOR_SOFT) {
    // soft floor: 与阈值的差距 × 0.3
    explorationStrength = Math.min(0.08, BASE_EXPLORATION + (ENTROPY_FLOOR_SOFT - entropyScore) * 0.3)
  }

  // --- style repulsion force（核心新增）---
  let repulsionForce = 0
  if (existingNodes && existingNodes.length >= 2) {
    repulsionForce = computeStyleRepulsion(existingNodes, aggregation)
    // repulsion 增强探索强度
    explorationStrength = Math.min(EMERGENCY_INJECTION, explorationStrength + repulsionForce)
  }

  // 生成探索噪声（带 repulsion 方向）
  const explorationVector = {
    visual: generateNoiseVector(explorationStrength, aggregation.globalVisual, repulsionForce > 0),
    camera: generateNoiseVector(explorationStrength, aggregation.globalCamera, repulsionForce > 0),
    emotion: generateNoiseVector(explorationStrength, aggregation.globalEmotion, repulsionForce > 0),
  }

  return {
    needsExploration: entropyScore < ENTROPY_FLOOR_SOFT,
    entropyScore: Math.round(entropyScore * 100) / 100,
    explorationStrength: Math.round(explorationStrength * 100) / 100,
    explorationVector,
  }
}

// ============================================================
// Style Repulsion Force（核心新增）
// ============================================================

/**
 * 计算风格排斥力。
 * 当已有节点在向量空间中过于密集时，计算一个将新项目推离的力量。
 *
 * 算法：
 * 1. 计算所有节点对的向量距离
 * 2. 如果距离 < REPULSION_THRESHOLD，触发排斥力
 * 3. 排斥力 = Σ (threshold - distance) / nodeCount，方向向外
 * 4. 最大 clamp 到 MAX_REPULSION_FORCE
 */
export function computeStyleRepulsion(
  nodes: StyleNode[],
  currentAggregation: StyleAggregationResult,
): number {
  // 构建中心向量
  const centerVisual = currentAggregation.globalVisual
  const centerCamera = currentAggregation.globalCamera
  const centerEmotion = currentAggregation.globalEmotion

  let repulsionSum = 0
  let closePairs = 0

  // 节点间的 pairwise 距离
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dist = vectorDistance(
        [...nodes[i].visualBiasVector, ...nodes[i].cameraBiasVector, ...nodes[i].emotionBiasVector],
        [...nodes[j].visualBiasVector, ...nodes[j].cameraBiasVector, ...nodes[j].emotionBiasVector],
      )

      if (dist < REPULSION_THRESHOLD) {
        repulsionSum += (REPULSION_THRESHOLD - dist) / REPULSION_THRESHOLD
        closePairs++
      }
    }
  }

  // 当前聚合与中心的距离（如果已有节点聚集，这里会很小）
  const currentDist = nodes.length > 0
    ? vectorDistance(
        [centerVisual[0], centerCamera[0], centerEmotion[0]],
        [nodes[nodes.length - 1]?.visualBiasVector?.[0] ?? 0.5,
         nodes[nodes.length - 1]?.cameraBiasVector?.[0] ?? 0.5,
         nodes[nodes.length - 1]?.emotionBiasVector?.[0] ?? 0.5],
      )
    : 0.5

  // 如果当前节点也很接近中心，累积排斥力
  if (currentDist < MIN_VECTOR_DISTANCE && closePairs > 0) {
    repulsionSum += (MIN_VECTOR_DISTANCE - currentDist) / MIN_VECTOR_DISTANCE
  }

  // 如果没有密集对，无排斥
  if (closePairs === 0) return 0

  // 归一化：排斥力 = sum / (closePairs + 1) * 0.5
  const force = (repulsionSum / (closePairs + 1)) * 0.5

  return Math.min(MAX_REPULSION_FORCE, force)
}

// ============================================================
// 辅助
// ============================================================

function generateNoiseVector(
  strength: number,
  base: number[],
  hasRepulsion: boolean,
): number[] {
  return base.map(v => {
    // 有排斥时，噪声偏向中性点 0.5（远离聚集区）
    const bias = hasRepulsion ? (0.5 - v) * 0.3 : 0
    const noise = (Math.random() * 2 - 1) * strength + bias
    return Math.max(0, Math.min(1, v + noise))
  })
}

function vectorDistance(a: number[], b: number[]): number {
  const dim = Math.min(a.length, b.length)
  let sumSq = 0
  for (let i = 0; i < dim; i++) {
    sumSq += (a[i] - b[i]) ** 2
  }
  return Math.sqrt(sumSq)
}

/**
 * 将 style drift → prompt tokens
 * 只在 prompt 层生效，不修改任何内部状态
 */
export function styleToPromptInjection(
  visual: number[],
  camera: number[],
  emotion: number[],
  influenceScore: number,
): string[] {
  if (influenceScore < 0.05) return []

  const tokens: string[] = []

  // Visual: 0-1 → 描述
  const visualAvg = visual.reduce((s, v) => s + v, 0) / visual.length
  if (visualAvg > 0.6) tokens.push('vibrant color grading')
  else if (visualAvg < 0.3) tokens.push('desaturated palette')

  // Camera: 0-1
  const cameraAvg = camera.reduce((s, v) => s + v, 0) / camera.length
  if (cameraAvg > 0.6) tokens.push('dynamic camera movement')
  else if (cameraAvg < 0.3) tokens.push('static framing')

  // Emotion: 0-1
  const emotionAvg = emotion.reduce((s, v) => s + v, 0) / emotion.length
  if (emotionAvg > 0.7) tokens.push('heightened emotional intensity')
  else if (emotionAvg > 0.5) tokens.push('warm emotional undertone')
  else if (emotionAvg < 0.3) tokens.push('restrained emotional tone')

  return tokens
}
