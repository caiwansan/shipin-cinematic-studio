/**
 * Style Evolution Engine v5 — 主入口
 *
 * 整合 StyleVectorizer + StyleMemoryGraph + DivergenceController
 * 单个导出函数供 routes 调用。
 */

import type {
  StyleVectorizationInput,
  StyleRunVector,
  StyleAggregationResult,
  DivergenceControlOutput,
  StyleInjectionSignal,
  StyleEvolutionAPIOutput,
} from './types.js'
import { vectorizeStyleRun } from './style-vectorizer.js'
import { addStyleNode, aggregateStyles, getMemoryGraph } from './style-memory-graph.js'
import { computeDivergenceControl, styleToPromptInjection } from './style-divergence-controller.js'

// ============================================================
// 主函数 — 一步完成 v5 全流程
// ============================================================

export function runStyleEvolution(
  input: StyleVectorizationInput,
): {
  vector: StyleRunVector
  aggregation: StyleAggregationResult
  divergence: DivergenceControlOutput
  injection: StyleInjectionSignal
  apiOutput: StyleEvolutionAPIOutput
} {
  // 1. 向量化
  const vector = vectorizeStyleRun(input)

  // 2. 存储到 memory graph（先存，这样 aggregation 包括了本项目前）
  addStyleNode(vector)

  // 3. 跨 project 聚合（含 attention）
  const aggregation = aggregateStyles(input.projectId, vector)

  // 4. divergence 检测 + 探索注入（含 style repulsion）
  const graph = getMemoryGraph()
  const divergence = computeDivergenceControl(aggregation, graph.nodes)

  // 5. 确定最终注入信号
  // 使用探索后的向量（或原始聚合向量）
  const finalVisual = divergence.needsExploration
    ? divergence.explorationVector.visual
    : aggregation.globalVisual
  const finalCamera = divergence.needsExploration
    ? divergence.explorationVector.camera
    : aggregation.globalCamera
  const finalEmotion = divergence.needsExploration
    ? divergence.explorationVector.emotion
    : aggregation.globalEmotion

  // 6. 计算 influence score
  const influenceScore = computeInfluenceScore(vector, aggregation, divergence)

  // 7. 生成 prompt injection tokens
  const promptTokens = styleToPromptInjection(finalVisual, finalCamera, finalEmotion, influenceScore)

  const injection: StyleInjectionSignal = {
    active: promptTokens.length > 0,
    influenceScore: Math.round(influenceScore * 100) / 100,
    styleDrift: {
      visual: Math.round((finalVisual.reduce((s, v) => s + v, 0) / finalVisual.length - 0.5) * 100) / 100,
      camera: Math.round((finalCamera.reduce((s, v) => s + v, 0) / finalCamera.length - 0.5) * 100) / 100,
      emotion: Math.round((finalEmotion.reduce((s, v) => s + v, 0) / finalEmotion.length - 0.5) * 100) / 100,
    },
    promptTokens,
  }

  const apiOutput: StyleEvolutionAPIOutput = {
    projectStyleVector: {
      visual: vector.visual,
      camera: vector.camera,
      emotion: vector.emotion,
    },
    globalStyleVector: {
      visual: finalVisual,
      camera: finalCamera,
      emotion: finalEmotion,
    },
    styleInfluenceScore: injection.influenceScore,
    styleDrift: injection.styleDrift,
    divergenceStatus: {
      entropyScore: divergence.entropyScore,
      collapsed: divergence.needsExploration,
      explorationInjected: divergence.explorationStrength > 0,
    },
  }

  return { vector, aggregation, divergence, injection, apiOutput }
}

// ============================================================
// 辅助
// ============================================================

/**
 * influence score = 当前 project 向量与全局聚合向量的差异 × confidence
 * - 差异越大 → influence 越大（新风格信号强）
 * - 差异越小 → influence 越小（与已有风格一致）
 * - confidence 放大可信项目的影响
 */
function computeInfluenceScore(
  vector: StyleRunVector,
  aggregation: StyleAggregationResult,
  divergence: DivergenceControlOutput,
): number {
  // 差异度：当前与全局的曼哈顿距离
  const diffVisual = vector.visual.reduce((s, v, i) => s + Math.abs(v - (aggregation.globalVisual[i] ?? 0.5)), 0) / vector.visual.length
  const diffCamera = vector.camera.reduce((s, v, i) => s + Math.abs(v - (aggregation.globalCamera[i] ?? 0.5)), 0) / vector.camera.length
  const diffEmotion = vector.emotion.reduce((s, v, i) => s + Math.abs(v - (aggregation.globalEmotion[i] ?? 0.5)), 0) / vector.emotion.length

  const avgDiff = (diffVisual + diffCamera + diffEmotion) / 3

  // base influence = 0.1 + avgDiff * confidence
  const base = 0.1 + avgDiff * aggregation.confidence * 0.5

  // 如果注入了探索噪声，额外提升 influence
  const explorationBoost = divergence.explorationStrength * 0.5

  const result = base + explorationBoost

  // clamp [0.05, 0.4]
  return Math.max(0.05, Math.min(0.4, result))
}

/**
 * 清空记忆（用于测试）
 */
export function clearStyleMemory(): void {
  const { clearMemoryGraph } = require('./style-memory-graph.js')
  clearMemoryGraph()
}
