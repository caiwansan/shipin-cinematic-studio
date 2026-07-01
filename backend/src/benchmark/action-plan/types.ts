/**
 * Action Plan Engine — Type Definitions
 *
 * P0-T007 — Action Plan Engine
 *
 * Defines ActionStep and ActionPlan types used to transform
 * Optimization Opportunities into concrete, actionable plans.
 */

/** 行动步骤 — 单个可执行步骤 */
export interface ActionStep {
  id: string;
  title: string;
  description: string;
  order: number;
}

/** 行动方案 — 针对一个 Opportunity 的完整行动计划 */
export interface ActionPlan {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedImpact: number;       // 预计 ADI 提升
  estimatedEffort: 'easy' | 'medium' | 'hard';
  estimatedTime: string;         // 如 "15 min", "1 hour", "2 hours"
  steps: ActionStep[];
  relatedOpportunityId: string;
  relatedScenarioId: string;
  status: 'pending' | 'completed' | 'skipped' | 'later';
  tags: string[];
}

/** Action Plan 模板 — 用于匹配和生成 ActionPlan */
export interface ActionPlanTemplate {
  templateId: string;
  title: string;
  description: string;
  steps: ActionStep[];
  estimatedEffort: 'easy' | 'medium' | 'hard';
  estimatedTime: string;
  tags: string[];
  matchCondition: ActionPlanMatchCondition;
}

/** 模板匹配条件 */
export interface ActionPlanMatchCondition {
  opportunityType: string;
  scenarioMatch?: string[];
}

/** Action Plan 输出包装 */
export interface ActionPlanResult {
  actionPlans: ActionPlan[];
  totalImpact: number;
  summary: string;
}
