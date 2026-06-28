/**
 * governance/cost/cost-controller.ts — 成本治理层（NON-BLOCKING）
 *
 * Phase 5 Hotfix: 仅估算成本，budget check 仅 log warning
 */

interface CostPayload {
  taskType?: string
}

interface CostRuntime {
  budgetLimit?: number
  userId?: string
}

const BASE_COST_MAP: Record<string, number> = {
  image: 1,
  video: 10,
  llm: 0.5,
  tts: 0.2,
  frame: 0.5,
  export: 2,
}

export function estimateCost(payload: CostPayload): number {
  const taskType = payload.taskType || 'llm'
  return BASE_COST_MAP[taskType] ?? 1
}

export function assertBudget(runtime: CostRuntime, cost: number): void {
  if (runtime.budgetLimit !== undefined && runtime.budgetLimit !== null) {
    if (cost > runtime.budgetLimit) {
      // NON-BLOCKING: 仅 log warning
      console.warn(
        `[governance/cost] ⚠️ 预算超限: cost=${cost}, budgetLimit=${runtime.budgetLimit} — execution continues`
      )
      return
    }
  }
}
