/**
 * director-economy/index.ts
 *
 * Phase 7 — Director Economy 统一导出
 */
export {
  recordScore,
  getIncentiveRecord,
  listIncentiveRecords,
  getTopDirectors,
  recommendDirectors,
  checkEconomyStability,
} from './incentive-engine.js'
export type {
  IncentiveRecord,
  DirectorRecommendation,
  EconomyStabilityCheck,
} from './incentive-engine.js'
