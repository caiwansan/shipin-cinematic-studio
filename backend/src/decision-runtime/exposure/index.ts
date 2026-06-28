/**
 * exposure/index.ts — Phase A-5
 *
 * 统一导出
 */

export type {
  ExecuteContractRequest,
  ExecuteContractResponse,
  TraceContractResponse,
  ReplayContractRequest,
  ReplayContractResponse,
  TraceSummary,
  ListTracesContractResponse,
  StatsContractResponse,
} from './exposure-contract.js'

export { createDecisionExposure } from './decision-exposure.js'
export type {
  DecisionExposure,
  ExecuteRequest,
  ExecuteResponse,
  TraceQueryResponse,
  ReplayRequest,
  ExecutionMode,
} from './decision-exposure.js'

export { registerDecisionRoutes } from './decision-routes.js'
