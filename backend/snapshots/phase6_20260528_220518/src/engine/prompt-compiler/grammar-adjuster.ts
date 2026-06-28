/**
 * grammar-adjuster.ts — Director Layer v6.7 语法自适应调整器
 *
 * 基于反馈数据做轻量 grammar 权重调整。
 * 不修改编译器本身，只修改 model-grammar 的 emphasis 权重。
 *
 * 设计原则：
 *   1. 规则驱动 — 不调 AI
 *   2. 阈值触发 — successRate < 0.7 时才调整
 *   3. 可逆 — 每次调整记录 log，可回滚
 *   4. 零 AI 依赖
 */

import { type SupportedModel } from './model-grammar.js'
import { type VPIRQualityScore } from './vp-ir-quality-schema.js'

// ============================================================
// 自适应调整结果
// ============================================================

export interface GrammarAdjustment {
  model: SupportedModel
  timestamp: number
  adjustments: string[]
  reason: string
}

// ============================================================
// 调整规则
// ============================================================

/**
 * 根据 VP-IR 质量评分调整 grammar 权重
 * 返回调整操作列表
 */
export function evaluateGrammarAdjustments(
  model: SupportedModel,
  scores: VPIRQualityScore[],
): GrammarAdjustment | null {
  const adjustments: string[] = []
  const reasons: string[] = []

  // 计算当前模型的平均成功率
  const modelScores = scores
  if (modelScores.length === 0) return null

  const avgSuccessRate =
    modelScores.reduce((sum, s) => sum + s.successRate, 0) / modelScores.length
  const avgStability =
    modelScores.reduce((sum, s) => sum + (s.stabilityScore || 0), 0) / modelScores.length

  // 规则 1: 成功率低于 0.7 → 增加约束严格性
  if (avgSuccessRate < 0.7) {
    adjustments.push('enforce_camera_specificity')  // 强制更多镜头细节
    adjustments.push('enforce_lighting_direction')   // 强制光源方向
    reasons.push(`成功率 ${(avgSuccessRate * 100).toFixed(0)}% < 70%，增加结构化约束`)
  }

  // 规则 2: 稳定度低于 0.6 → 减少自由度
  if (avgStability < 0.6) {
    adjustments.push('reduce_action_variance')  // 限制动作描述变化
    adjustments.push('standardize_subject_format')  // 标准化主体描述
    reasons.push(`稳定度 ${(avgStability * 100).toFixed(0)}% < 60%，减少描述自由度`)
  }

  // 规则 3: 平均延迟 > 5000ms → 压缩 prompt 长度
  const avgLatency =
    modelScores.reduce((sum, s) => sum + s.avgLatencyMs, 0) / modelScores.length
  if (avgLatency > 5000) {
    adjustments.push('compress_temporal_narrative')  // 压缩时序描述
    reasons.push(`平均延迟 ${avgLatency.toFixed(0)}ms > 5000ms，压缩 prompt 长度`)
  }

  // 规则 4: 用户采纳率低于 0.5 → 增加风格多样性
  const avgAcceptance = modelScores
    .filter((s) => s.acceptanceRate !== undefined)
    .reduce((sum, s) => sum + (s.acceptanceRate || 0), 0) /
    Math.max(1, modelScores.filter((s) => s.acceptanceRate !== undefined).length)

  if (avgAcceptance < 0.5 && modelScores.filter((s) => s.acceptanceRate !== undefined).length > 0) {
    adjustments.push('increase_style_variety')
    reasons.push(`采纳率 ${(avgAcceptance * 100).toFixed(0)}% < 50%，增加风格多样性`)
  }

  if (adjustments.length === 0) return null

  return {
    model,
    timestamp: Date.now(),
    adjustments,
    reason: reasons.join('; '),
  }
}

/**
 * 记录调整历史
 */
const adjustmentHistory: GrammarAdjustment[] = []

export function recordAdjustment(adjustment: GrammarAdjustment): void {
  adjustmentHistory.push(adjustment)
  console.log(`[GrammarAdjust] ${adjustment.model}: ${adjustment.reason}`)
}

export function getAdjustmentHistory(): GrammarAdjustment[] {
  return Array.from(adjustmentHistory)
}
