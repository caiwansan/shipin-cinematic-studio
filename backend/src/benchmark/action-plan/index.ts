/**
 * Action Plan Engine — 统一导出
 *
 * P0-T007 — Action Plan Engine
 *
 * 将 Opportunity → ActionPlan 的完整引擎
 */

export { ActionPlanService, actionPlanService } from './action-plan-service';
export type { ActionPlan, ActionStep, ActionPlanTemplate, ActionPlanMatchCondition, ActionPlanResult } from './types';
export { ACTION_PLAN_TEMPLATES, getTemplate, getTemplateOpportunityTypes } from './templates';
