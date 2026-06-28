/**
 * Feedback Bias Layer v4
 *
 * 让系统"记住自己的创造偏好"——slack 反馈不回写 physics field，
 * 只更新 soft bias layer，带 decay memory 和强制 clamp。
 *
 * 核心规则：
 * 1. 不直接回写 constraintField / resolvedConstraintField
 * 2. 只更新 biasLayer.entries（key → accumulatedBias）
 * 3. bias(t) = bias(t-1) * 0.9 + slackFeedback * 0.1
 * 4. maxBias = 0.2（防止发散）
 * 5. identity 不参与偏置累积
 */

import type {
  FeedbackBiasLayer,
  FeedbackInput,
  BiasEntry,
  BiasAdjustedField,
} from './types.js'

// ============================================================
// 常量
// ============================================================

const DECAY_FACTOR = 0.9          // 衰减率
const LEARNING_RATE = 0.1         // 学习率（新反馈权重）
const MAX_BIAS = 0.2              // 最大偏置
const IDENTITY_KEY = 'characterIdentity'  // 不参与偏置的约束

// ============================================================
// 存储
// ============================================================

/**
 * 按 projectId 存储的偏置层
 * 所有操作通过函数进行，保持可控
 */
const biasStore = new Map<string, FeedbackBiasLayer>()

// ============================================================
// CRUD
// ============================================================

/**
 * 获取或创建项目偏置层
 */
export function getOrCreateBiasLayer(projectId: string): FeedbackBiasLayer {
  let layer = biasStore.get(projectId)
  if (!layer) {
    layer = {
      projectId,
      entries: [],
      lastRoundTimestamp: Date.now(),
      totalFeedbackRounds: 0,
    }
    biasStore.set(projectId, layer)
  }
  return layer
}

/**
 * 获取偏置层（只读）
 */
export function getBiasLayer(projectId: string): FeedbackBiasLayer | null {
  return biasStore.get(projectId) ?? null
}

/**
 * 清除项目偏置层
 */
export function clearBiasLayer(projectId: string): void {
  biasStore.delete(projectId)
}

/**
 * 清除所有偏置层
 */
export function clearAllBiasLayers(): void {
  biasStore.clear()
}

// ============================================================
// 核心函数
// ============================================================

/**
 * 记录一次反馈，更新偏置层
 *
 * 规则：
 * - slackInfluenceScore 越高 → 该维度 cameraFreedom 偏置减弱（slack 已被使用）
 * - shotPerturbations 各维度均值 → 偏置方向
 * - identity 不参与累积
 */
export function recordFeedback(input: FeedbackInput): FeedbackBiasLayer {
  const layer = getOrCreateBiasLayer(input.projectId)

  // 计算各维度的反馈信号
  const avgCameraDrift = input.shotPerturbations.reduce((s, p) => s + p.cameraDrift, 0) / Math.max(input.shotPerturbations.length, 1)
  const avgTimingShift = input.shotPerturbations.reduce((s, p) => s + Math.abs(p.timingShift), 0) / Math.max(input.shotPerturbations.length, 1)
  const avgInfluence = input.slackInfluenceScores.reduce((s, i) => s + i.score, 0) / Math.max(input.slackInfluenceScores.length, 1)

  // 偏置信号：
  // - cameraFreedom: 高 cameraDrift → 偏置上升（运镜自由度偏多）
  // - temporalFlexibility: 高 timingShift → 偏置上升（节奏变化偏多）
  // - visualConsistency: 高 influence → 偏置下降（约束已充分满足）
  // - colorPaletteFidelity: 低 influence → 偏置上升（可释放更多空间）
  const signals: Record<string, number> = {
    cameraFreedom: avgCameraDrift - 0.05,
    temporalFlexibility: avgTimingShift - 0.03,
    visualConsistency: 0.05 - avgInfluence,
    colorPaletteFidelity: 0.03 - avgInfluence * 0.5,
  }

  for (const [key, signal] of Object.entries(signals)) {
    // identity 跳过
    if (key === IDENTITY_KEY) continue

    // 找到或创建 entry
    let entry = layer.entries.find(e => e.key === key)
    if (!entry) {
      entry = { key, totalRounds: 0, accumulatedBias: 0, currentBias: 0, lastUpdated: Date.now() }
      layer.entries.push(entry)
    }

    // decay + 学习：bias(t) = bias(t-1) * 0.9 + signal * 0.1
    const decayed = entry.currentBias * DECAY_FACTOR
    const learned = signal * LEARNING_RATE
    const newBias = decayed + learned

    // clamp
    entry.currentBias = Math.max(-MAX_BIAS, Math.min(MAX_BIAS, Math.round(newBias * 100) / 100))
    entry.accumulatedBias = Math.round((entry.accumulatedBias + signal) * 100) / 100
    entry.totalRounds++
    entry.lastUpdated = Date.now()
  }

  layer.lastRoundTimestamp = Date.now()
  layer.totalFeedbackRounds++

  return layer
}

/**
 * 将偏置层应用到下一个轮次的 constraintField
 *
 * 规则：
 * - 只影响 soft / soft_hard 约束
 * - hard 约束 clamp 到 0 偏置
 * - max 偏置 ±0.2
 */
export function applyBiasToField(
  rawField: Record<string, { weight: number; mode: string; description?: string }>,
  projectId: string,
): BiasAdjustedField {
  const layer = biasStore.get(projectId)

  if (!layer || layer.entries.length === 0) {
    return {
      projectId,
      adjustedWeights: Object.fromEntries(
        Object.entries(rawField).map(([k, v]) => [k, v.weight]),
      ),
      biasApplied: false,
      totalRounds: 0,
    }
  }

  const adjustedWeights: Record<string, number> = {}

  for (const [key, entry] of Object.entries(rawField)) {
    const biasEntry = layer.entries.find(e => e.key === key)
    const bias = biasEntry?.currentBias ?? 0

    // identity: 不应用偏置
    if (key === IDENTITY_KEY || entry.mode === 'hard') {
      adjustedWeights[key] = entry.weight
      continue
    }

    // soft / soft_hard: 应用偏置
    const adjusted = Math.max(0.1, Math.min(1.0, entry.weight + bias))
    adjustedWeights[key] = Math.round(adjusted * 100) / 100
  }

  return {
    projectId,
    adjustedWeights,
    biasApplied: true,
    totalRounds: layer.totalFeedbackRounds,
  }
}

/**
 * 获取偏置层状态报告（用于 API 展示）
 */
export function getBiasReport(projectId: string): {
  hasBias: boolean
  rounds: number
  entries: Array<{ key: string; currentBias: number; totalRounds: number }>
} {
  const layer = biasStore.get(projectId)
  if (!layer) {
    return { hasBias: false, rounds: 0, entries: [] }
  }

  return {
    hasBias: layer.entries.length > 0,
    rounds: layer.totalFeedbackRounds,
    entries: layer.entries.map(e => ({
      key: e.key,
      currentBias: e.currentBias,
      totalRounds: e.totalRounds,
    })),
  }
}
