/**
 * truth/truth-model.ts — Truth 模型定义
 *
 * Phase 7, Rule 1: execution ≠ truth
 * Truth 是经仲裁后的规范结果，与原生 execution 解耦
 */

export interface ExecutionResult {
  output: any
  provider: string
  model: string
  latency: number
  cost: number
}

export interface TruthScore {
  /** 输出完整性 (0-1) */
  completeness: number
  /** 输出正确性 (0-1) */
  correctness: number
  /** 执行稳定性 (0-1) */
  stability: number
  /** 成本效率 (0-1) */
  costEfficiency: number
}

export interface TruthEntry {
  taskId: string
  winner: ExecutionResult
  score: TruthScore
  allResults: ExecutionResult[]
  timestamp: number
}

/** 综合分权重 */
export const SCORE_WEIGHTS = {
  completeness: 0.3,
  correctness: 0.3,
  stability: 0.2,
  costEfficiency: 0.2,
} as const

export function aggregateScore(score: TruthScore): number {
  return (
    score.completeness * SCORE_WEIGHTS.completeness +
    score.correctness * SCORE_WEIGHTS.correctness +
    score.stability * SCORE_WEIGHTS.stability +
    score.costEfficiency * SCORE_WEIGHTS.costEfficiency
  )
}
