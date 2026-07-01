/**
 * Opportunity Engine — 统一导出
 *
 * P0-T006 — Opportunity Engine (First Edition)
 */

export { OpportunityService, opportunityService } from './opportunity-service';
export type { Opportunity } from './types';
export { determinePriority, determineEffort } from './priority-rules';
export type { Priority } from './priority-rules';
export { calculateExpectedAdiGain } from './impact-calculator';
export { generateReason } from './reason-generator';
export { getSuggestion, getAllScenarioIds } from './suggestion-map';
