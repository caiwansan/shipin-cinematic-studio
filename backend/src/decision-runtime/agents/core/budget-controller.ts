/**
 * budget-controller.ts — Phase AG-2.6: Compensation Budget Controller
 *
 * ═══════════════════════════════════════════════════════════════
 * 给 AG-2.5 的补偿机制加"刹车系统"
 *
 * 解决的问题：
 *   补偿机制已触发 → 但缺乏自限 → 会变成"无限查询补洞"
 *   表现：coverageGap=true → 补偿 → 噪声 ↑ → confidence ↓ → 再补偿
 *   结果：retrieval feedback loop drift
 *
 * 设计原则：
 *   1. 补偿必须被预算限制（maxRounds / maxQueries / decayFactor）
 *   2. 系统稳定性必须可观测（evidenceEntropy / compensationDepth / confidenceVolatility）
 *   3. 预算用尽时静默降级（不触发更多补偿）
 *
 * 不做：
 *   ❌ 动态预算调整（当前保持静态默认值）
 *   ❌ 基于 session 的预算管理
 *   ❌ 用户可配置预算（以后加）
 *
 * @phase decision-runtime / ag-2.6
 */

// ============================================================
// 1. Budget Model
// ============================================================

export interface CompensationBudget {
  /** 最多补偿轮数 */
  maxRounds: number
  /** 每轮最大 query 数 */
  maxQueries: number
  /** 每轮查询数衰减系数（0.6 表示下一轮减少 40%） */
  decayFactor: number
}

export const DEFAULT_COMPENSATION_BUDGET: CompensationBudget = {
  maxRounds: 1,
  maxQueries: 3,
  decayFactor: 0.6,
}

// ============================================================
// 2. Runtime State
// ============================================================

export interface CompensationState {
  round: number
  queriesUsed: number
  budget: CompensationBudget
  exhausted: boolean
}

export function createCompensationState(budget: CompensationBudget = DEFAULT_COMPENSATION_BUDGET): CompensationState {
  return {
    round: 0,
    queriesUsed: 0,
    budget,
    exhausted: false,
  }
}

// ============================================================
// 3. Guard Clause — 是否应该进行补偿
// ============================================================

export function shouldCompensate(state: CompensationState): boolean {
  if (state.exhausted) {
    console.log(`[BudgetController] 预算已耗尽 (round=${state.round}/${state.budget.maxRounds}) — 跳过补偿`)
    return false
  }

  if (state.round >= state.budget.maxRounds) {
    console.log(`[BudgetController] 已达最大补偿轮数 (${state.budget.maxRounds}) — 跳过补偿`)
    state.exhausted = true
    return false
  }

  return true
}

// ============================================================
// 4. 计算当前轮可用查询数
// ============================================================

export function computeAllowedQueries(state: CompensationState): number {
  const maxQueries = state.budget.maxQueries
  const decayed = Math.round(maxQueries * Math.pow(state.budget.decayFactor, state.round))
  const allowed = Math.max(decayed, 1) // 至少保留 1 条

  return allowed
}

// ============================================================
// 5. 执行补偿并更新状态
// ============================================================

export interface CompensationAdvice {
  allowed: boolean
  allowedQueryCount: number
  queries: string[]
  state: CompensationState
}

export function advanceCompensation(
  state: CompensationState,
  candidateQueries: string[],
): CompensationAdvice {
  if (!shouldCompensate(state)) {
    return {
      allowed: false,
      allowedQueryCount: 0,
      queries: [],
      state,
    }
  }

  const allowedCount = computeAllowedQueries(state)
  const selectedQueries = candidateQueries.slice(0, allowedCount)

  state.round++
  state.queriesUsed += selectedQueries.length

  if (state.round >= state.budget.maxRounds) {
    state.exhausted = true
  }

  console.log(`[BudgetController] 轮${state.round}: 允许 ${selectedQueries.length}/${candidateQueries.length} 条查询 (衰减=${state.budget.decayFactor})`)

  return {
    allowed: true,
    allowedQueryCount: selectedQueries.length,
    queries: selectedQueries,
    state,
  }
}

// ============================================================
// 6. 系统稳定性信号
// ============================================================

export interface StabilitySignal {
  compensationDepth: number    // 实际使用的补偿轮数
  compensationRatio: number    // 补偿证据 / 总证据比例
  queriesPerRound: number[]    // 每轮查询数
  exhausted: boolean           // 是否预算耗尽
}

export function computeStabilitySignal(
  state: CompensationState,
  compensatedEvidenceCount: number,
  totalEvidenceCount: number,
): StabilitySignal {
  return {
    compensationDepth: state.round,
    compensationRatio: totalEvidenceCount > 0
      ? Math.round((compensatedEvidenceCount / totalEvidenceCount) * 1000) / 1000
      : 0,
    queriesPerRound: [state.queriesUsed], // 简化版，仅跟踪总查询数
    exhausted: state.exhausted,
  }
}
