/**
 * Style Memory Graph v5
 *
 * 跨 project 风格记忆存储。
 * 核心修改 vs 你的原始设计：
 * - attention-weighted 聚合（不是简单加权平均）
 * - 保留所有 project 节点，不做衰减删除
 * - 每次新 project 加入时计算风格迁移向量
 */

import type {
  StyleMemoryGraph,
  StyleNode,
  StyleTransition,
  StyleRunVector,
  StyleAggregationResult,
} from './types.js'

// ============================================================
// 常量
// ============================================================

const DECAY_CONSTANT = 0.15       // time decay factor
const MAX_NODES = 100             // 最大节点数（防内存泄漏）
const VECTOR_DIM = 3

// ============================================================
// 全局存储
// ============================================================

let memoryGraph: StyleMemoryGraph = {
  nodes: [],
  edges: [],
  lastUpdated: Date.now(),
}

// ============================================================
// CRUD
// ============================================================

export function getMemoryGraph(): StyleMemoryGraph {
  return memoryGraph
}

export function clearMemoryGraph(): void {
  memoryGraph = { nodes: [], edges: [], lastUpdated: Date.now() }
}

/**
 * 添加一个 project 的风格节点
 */
export function addStyleNode(vector: StyleRunVector): StyleNode {
  const node: StyleNode = {
    projectId: vector.projectId,
    timestamp: Date.now(),
    strength: vector.strength,
    visualBiasVector: [...vector.visual],
    cameraBiasVector: [...vector.camera],
    emotionBiasVector: [...vector.emotion],
    sourceSnapshot: {
      biasRound: 0,
      slackConsumed: 0,
      avgSlackInfluence: 0,
      constraintCount: 0,
    },
  }

  // 如果上一个节点存在，计算迁移向量
  if (memoryGraph.nodes.length > 0) {
    const lastNode = memoryGraph.nodes[memoryGraph.nodes.length - 1]
    const edge: StyleTransition = {
      fromProjectId: lastNode.projectId,
      toProjectId: vector.projectId,
      deltaVisual: vector.visual.map((v, i) => v - (lastNode.visualBiasVector[i] ?? 0)),
      deltaCamera: vector.camera.map((v, i) => v - (lastNode.cameraBiasVector[i] ?? 0)),
      deltaEmotion: vector.emotion.map((v, i) => v - (lastNode.emotionBiasVector[i] ?? 0)),
      transitionTime: Date.now(),
    }
    memoryGraph.edges.push(edge)
  }

  memoryGraph.nodes.push(node)
  memoryGraph.lastUpdated = Date.now()

  // 防内存泄漏
  if (memoryGraph.nodes.length > MAX_NODES) {
    memoryGraph.nodes = memoryGraph.nodes.slice(-MAX_NODES)
    memoryGraph.edges = memoryGraph.edges.slice(-MAX_NODES + 1)
  }

  return node
}

// ============================================================
// 聚合
// ============================================================

/**
 * attention-weighted 风格聚合
 *
 * 和简单加权平均的关键区别：
 * - 权重 = softmax(age * decay + strength * attentionBoost)
 * - attentionBoost: 与当前 project 风格距离越近的节点，权重越高
 * - 旧项目的风格信号不会完全衰减到零，如果与当前方向一致会被 attention 增强
 */
export function aggregateStyles(
  currentProjectId?: string,
  currentVector?: StyleRunVector,
): StyleAggregationResult {
  if (memoryGraph.nodes.length === 0) {
    return emptyAggregation()
  }

  const now = Date.now()
  const ages = memoryGraph.nodes.map(n => (now - n.timestamp) / 1000 / 3600) // 小时
  const maxAge = Math.max(1, ...ages)

  // 计算 attention 权重
  const rawWeights = memoryGraph.nodes.map((node, i) => {
    const ageDecay = Math.exp(-DECAY_CONSTANT * (ages[i] / maxAge))
    const strengthFactor = node.strength

    // attention boost: 如果提供了当前向量，计算余弦相似度
    let attentionBoost = 0
    if (currentVector) {
      attentionBoost = cosineSimilarity(
        [...node.visualBiasVector, ...node.cameraBiasVector, ...node.emotionBiasVector],
        [...currentVector.visual, ...currentVector.camera, ...currentVector.emotion],
      )
      // 映射到 [0.5, 1.5]
      attentionBoost = 0.5 + Math.max(0, attentionBoost) * 0.5
    } else {
      attentionBoost = 0.8
    }

    // 排除当前 project（避免自引用）
    const isCurrent = currentProjectId && node.projectId === currentProjectId
    return isCurrent ? 0 : ageDecay * strengthFactor * attentionBoost
  })

  // softmax
  const expWeights = rawWeights.map(w => Math.exp(w))
  const sumExp = expWeights.reduce((s, v) => s + v, 0) || 1
  const normalizedWeights = expWeights.map(w => w / sumExp)

  // 加权聚合
  const globalVisual = weightedAverage(memoryGraph.nodes.map(n => n.visualBiasVector), normalizedWeights)
  const globalCamera = weightedAverage(memoryGraph.nodes.map(n => n.cameraBiasVector), normalizedWeights)
  const globalEmotion = weightedAverage(memoryGraph.nodes.map(n => n.emotionBiasVector), normalizedWeights)

  // 各维度方差 — v5.1: 改用 pairwise dispersion（比 variance from mean 更真实）
  const varianceVisual = computePairwiseDispersion(memoryGraph.nodes.map(n => n.visualBiasVector))
  const varianceCamera = computePairwiseDispersion(memoryGraph.nodes.map(n => n.cameraBiasVector))
  const varianceEmotion = computePairwiseDispersion(memoryGraph.nodes.map(n => n.emotionBiasVector))

  return {
    globalVisual,
    globalCamera,
    globalEmotion,
    varianceVisual,
    varianceCamera,
    varianceEmotion,
    nodeCount: memoryGraph.nodes.length,
    confidence: Math.min(1, memoryGraph.nodes.length / 10),
  }
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 计算向量集合的 pairwise dispersion（两两距离均值）
 * 代替 variance from mean——两个分离的簇即使各自内部方差为零，dispersion 也很大
 */
function computePairwiseDispersion(
  vectors: number[][],
): number {
  if (vectors.length < 2) return 0.5
  let totalDist = 0
  let pairs = 0
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      let d = 0
      for (let k = 0; k < Math.min(vectors[i].length, vectors[j].length); k++) {
        d += (vectors[i][k] - vectors[j][k]) ** 2
      }
      totalDist += Math.sqrt(d)
      pairs++
    }
  }
  // 归一化：最大可能距离 ≈ sqrt(3) ≈ 1.73
  const maxDist = Math.sqrt(3)
  return Math.max(0, Math.min(1, totalDist / pairs / maxDist))
}

function weightedAverage(
  vectors: number[][],
  weights: number[],
): number[] {
  const dim = vectors[0]?.length ?? VECTOR_DIM
  const result: number[] = []
  for (let d = 0; d < dim; d++) {
    let sum = 0
    for (let i = 0; i < vectors.length; i++) {
      sum += (vectors[i][d] ?? 0.5) * (weights[i] ?? 0)
    }
    result.push(Math.max(0, Math.min(1, sum)))
  }
  return result
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0)
  const normA = Math.sqrt(a.reduce((s, v) => s + v * v, 0))
  const normB = Math.sqrt(b.reduce((s, v) => s + v * v, 0))
  if (normA === 0 || normB === 0) return 0
  return dot / (normA * normB)
}

function emptyAggregation(): StyleAggregationResult {
  return {
    globalVisual: [0.5, 0.5, 0.5],
    globalCamera: [0.5, 0.5, 0.5],
    globalEmotion: [0.5, 0.5, 0.5],
    varianceVisual: 0.5,
    varianceCamera: 0.5,
    varianceEmotion: 0.5,
    nodeCount: 0,
    confidence: 0,
  }
}
