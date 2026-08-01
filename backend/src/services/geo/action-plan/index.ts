// ============================================================
// Action Plan Engine — P0-T007
// Exports: ActionPlan, ActionPlanResult, ActionPlanEngine (singleton)
// ============================================================

export type { ActionPlan } from './types.js'
export type { ActionPlanResult } from './types.js'
export type { ActionPlanSummary } from './types.js'
export { ActionPlanBuilder } from './builder.js'
export { ActionPlanEngine } from './engine.js'
export { ActionPlanRepository } from './repository.js'

import { ActionPlanBuilder } from './builder.js'
import { ActionPlanEngine } from './engine.js'
import { ActionPlanRepository } from './repository.js'

let engine: ActionPlanEngine | null = null

export function getActionPlanEngine(): ActionPlanEngine {
  if (!engine) {
    engine = new ActionPlanEngine(new ActionPlanBuilder(), new ActionPlanRepository())
  }
  return engine
}
