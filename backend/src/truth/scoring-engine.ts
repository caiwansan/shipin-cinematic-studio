/**
 * truth/scoring-engine.ts — 结果评分引擎
 *
 * Phase 7, Rule 5: 评分必须是确定性的
 * 同一结果永远返回相同分数
 */

import type { ExecutionResult, TruthScore } from './truth-model.js'

/**
 * 评估完整性：输出是否包含所有必要字段
 */
function evaluateCompleteness(result: ExecutionResult): number {
  if (!result.output) return 0
  const output = result.output

  let score = 0
  if (output.url || output.imageUrl || output.videoUrl) score += 0.4
  if (output.prompt || output.text || output.content) score += 0.3
  if (typeof output.success === 'boolean') score += 0.2
  if (output.seed !== undefined || output.duration) score += 0.1

  return Math.min(score, 1)
}

/**
 * 评估正确性：是否有错误/异常信号
 */
function evaluateCorrectness(result: ExecutionResult): number {
  if (!result.output) return 0

  const output = result.output

  if (output.success === false) return 0
  if (output.error) return 0.2

  // 有输出且无明显错误
  if (output.url || output.imageUrl || output.videoUrl || output.content) return 1
  if (output.text || output.prompt) return 0.8

  return 0.5
}

/**
 * 评估稳定性：低延迟、可预期的结果加分
 */
function evaluateStability(result: ExecutionResult): number {
  // 延迟越短越稳定
  const latencyScore = Math.max(0, 1 - result.latency / 30000)
  // 成本比高 = 不稳定信号
  const costPenalty = Math.min(0.2, result.cost * 0.05)

  return Math.max(0, Math.min(1, latencyScore - costPenalty))
}

export function scoreResult(result: ExecutionResult): TruthScore {
  return {
    completeness: evaluateCompleteness(result),
    correctness: evaluateCorrectness(result),
    stability: evaluateStability(result),
    costEfficiency: 1 / (result.cost + 1),
  }
}
