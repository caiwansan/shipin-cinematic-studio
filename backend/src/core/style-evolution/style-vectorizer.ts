/**
 * Style Vectorizer v5
 *
 * 将 v4 bias / slack / deformation 数据转化为三维风格向量。
 *
 * 设计原则：
 * - 输入 = 系统已有的观测数据（不新建传感器）
 * - 输出 = 语义可解释的三维向量（visual / camera / emotion）
 * - 所有值 clamp 到 [0, 1]
 */

import type {
  StyleVectorizationInput,
  StyleRunVector,
} from './types.js'

// ============================================================
// 常量
// ============================================================

/** 向量维度 */
const VECTOR_DIM = 3

/** bias key → 向量维度的映射 */
const BIAS_MAP: Record<string, 'visual' | 'camera' | 'emotion'> = {
  visualConsistency: 'visual',
  colorPaletteFidelity: 'visual',
  cameraFreedom: 'camera',
  cameraMotion: 'camera',
  temporalFlexibility: 'emotion',
  emotionalIntensity: 'emotion',
}

/** drift dimension → 向量维度的映射 */
const DRIFT_MAP: Record<string, 'visual' | 'camera' | 'emotion'> = {
  cameraDrift: 'camera',
  timingShift: 'emotion',
  compositionDrift: 'visual',
  emotionalIntensity: 'emotion',
}

// ============================================================
// 向量化主函数
// ============================================================

export function vectorizeStyleRun(
  input: StyleVectorizationInput,
): StyleRunVector {
  const visual: number[] = []
  const camera: number[] = []
  const emotion: number[] = []

  // --- 1. bias 信号 ---
  for (const entry of input.biasEntries) {
    const dim = BIAS_MAP[entry.key]
    if (!dim) continue
    // bias 是 [-0.2, 0.2]，映射到 [0, 1]：0.5 + bias * 2.5
    // 这样 neutral bias → 0.5，max bias → 1.0，min → 0.0
    const signal = Math.max(0, Math.min(1, 0.5 + entry.currentBias * 2.5))
    if (dim === 'visual') visual.push(signal)
    else if (dim === 'camera') camera.push(signal)
    else if (dim === 'emotion') emotion.push(signal)
  }

  // --- 2. slack influence 信号 ---
  if (input.slackInfluenceScores.length > 0) {
    const avgSlack = input.slackInfluenceScores.reduce((s, v) => s + v, 0) / input.slackInfluenceScores.length
    slackSignalToVector(avgSlack, visual, camera, emotion)
  }

  // --- 3. prompt 变形统计 ---
  const d = input.promptDeformationStats
  for (const [key, val] of Object.entries(d.driftDimensions)) {
    const dim = DRIFT_MAP[key]
    if (!dim) continue
    const signal = Math.max(0, Math.min(1, Math.abs(val) * 3))
    if (dim === 'visual') visual.push(signal)
    else if (dim === 'camera') camera.push(signal)
    else if (dim === 'emotion') emotion.push(signal)
  }

  return {
    projectId: input.projectId,
    visual: normalizeVector(visual) || [0.5, 0.5, 0.5],
    camera: normalizeVector(camera) || [0.5, 0.5, 0.5],
    emotion: normalizeVector(emotion) || [0.5, 0.5, 0.5],
    strength: computeStrength(input),
  }
}

// ============================================================
// 辅助函数
// ============================================================

/** Slack influence → vector injection */
function slackSignalToVector(
  avgSlack: number,
  visual: number[],
  camera: number[],
  emotion: number[],
): void {
  // 高 slack influence → 视觉约束松弛，色彩/构图自由度上升
  visual.push(Math.max(0, Math.min(1, 0.3 + avgSlack * 1.5)))
  // 高 slack → 运镜自由度上升
  camera.push(Math.max(0, Math.min(1, 0.3 + avgSlack * 1.2)))
  // 高 slack → 情绪强度略微下降
  emotion.push(Math.max(0, Math.min(1, 0.5 - avgSlack * 0.3)))
}

/** 将多值向量归一化为固定维度的均值向量 */
function normalizeVector(values: number[]): number[] {
  if (values.length === 0) return [0.5, 0.5, 0.5]
  if (values.length === 1) return [values[0], values[0], values[0]]

  const avg = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length
  // 用 variance 扩散到 3 维：avg ± variance * 0.5
  const spread = Math.sqrt(variance) * 0.5
  return [
    Math.max(0, Math.min(1, avg - spread)),
    Math.max(0, Math.min(1, avg)),
    Math.max(0, Math.min(1, avg + spread)),
  ]
}

/** 计算节点强度（0-1） */
function computeStrength(input: StyleVectorizationInput): number {
  const factors = [
    Math.min(1, input.slackInfluenceScores.length / 10),
    Math.min(1, input.biasRound / 5),
    input.slackConsumed,
  ]
  return factors.reduce((s, v) => s + v, 0) / factors.length
}
