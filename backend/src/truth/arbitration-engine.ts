/**
 * truth/arbitration-engine.ts — 多 Provider 仲裁引擎
 *
 * Phase 7, Rule 2: truth 必须经过仲裁
 * Phase 7, Rule 4: 系统必须解析出唯一规范结果
 */

import { scoreResult } from './scoring-engine.js'
import { aggregateScore } from './truth-model.js'
import type { ExecutionResult, TruthEntry, TruthScore } from './truth-model.js'

export interface ArbitrationResult {
  winner: ExecutionResult
  score: TruthScore
  allScored: Array<{ result: ExecutionResult; score: TruthScore; total: number }>
}

/**
 * 仲裁多 provider 结果，返回唯一胜出者
 * Phase 7, Rule 2: 仲裁是确定性的 — 相同输入永远产生相同胜出者
 */
export async function arbitrate(results: ExecutionResult[]): Promise<ArbitrationResult> {
  if (results.length === 0) {
    throw new Error('[truth/arbitrate] 无可用结果进行仲裁')
  }

  if (results.length === 1) {
    const score = scoreResult(results[0])
    return {
      winner: results[0],
      score,
      allScored: [{ result: results[0], score, total: aggregateScore(score) }],
    }
  }

  const allScored = results.map(r => {
    const score = scoreResult(r)
    return { result: r, score, total: aggregateScore(score) }
  })

  // 按总分降序排序，确定胜出者
  allScored.sort((a, b) => b.total - a.total)

  const winner = allScored[0]

  console.log(`[truth/arbitrate] 🏆 winner: provider=${winner.result.provider}, ` +
    `model=${winner.result.model}, totalScore=${winner.total.toFixed(3)}`)

  return {
    winner: winner.result,
    score: winner.score,
    allScored,
  }
}
