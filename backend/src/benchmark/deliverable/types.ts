/**
 * Deliverable Report — Type Definitions
 *
 * P1-C: Deliverable Center
 *
 * The DeliverableReport aggregates data from:
 * - DiscoveryReport (opportunities, scenarios, ADI)
 * - ActionPlan (actions, statuses)
 * - VerificationReport (before/after ADI, improvements)
 *
 * It serves as the final deliverable — a comprehensive brand health report
 * that can be exported as Markdown or JSON.
 */

/** 执行摘要 */
export interface ExecutiveSummary {
  currentAdi: number;
  adiChange: number;            // Before → After 变化
  completionRate: number;       // Action Plan 完成率
  topOpportunities: number;     // 待处理的高优先级机会数
  overallHealth: 'good' | 'fair' | 'poor';
  confidence: number;
}

/** 发现汇总 — 单个场景得分 */
export interface ScenarioScore {
  name: string;
  score: number;
  trend: string;
}

/** 发现汇总 */
export interface Findings {
  industry: string;
  entityName: string;
  coverageCount: number;
  totalScenarios: number;
  topScenarios: ScenarioScore[];
  bottomScenarios: ScenarioScore[];
}

/** 机会 — 单个机会条目 */
export interface OpportunityItem {
  scenarioId: string;
  scenarioName: string;
  gap: number;
  priority: string;
  expectedAdiGain: number;
  suggestion: string;
}

/** 机会汇总 */
export interface Opportunities {
  high: number;
  medium: number;
  low: number;
  totalExpectedGain: number;    // 所有机会的预期收益总和
  items: OpportunityItem[];
}

/** 行动 — 单个行动条目 */
export interface ActionItem {
  title: string;
  status: string;
  expectedImpact: number;
  actualImpact: number | null;
}

/** 行动汇总 */
export interface Actions {
  total: number;
  completed: number;
  inProgress: number;
  skipped: number;
  pending: number;
  estimatedGain: number;       // 已完成的预期收益总和
  actualGain: number;          // Verification 确认的实际收益
  items: ActionItem[];
}

/** 验证 — 分解条目 */
export interface BreakdownItem {
  label: string;
  contribution: number;
}

/** 验证 — 剩余问题 */
export interface RemainingIssue {
  scenario: string;
  gap: number;
  priority: string;
}

/** 验证结果 */
export interface Verification {
  beforeAdi: number;
  afterAdi: number;
  deltaAdi: number;
  improvementRate: number;
  breakdown: BreakdownItem[];
  remainingIssues: RemainingIssue[];
}

/** 下一步建议 — 单条 */
export interface RecommendationItem {
  scenarioId: string;
  scenarioName: string;
  gap: number;
  priority: string;
  expectedAdiGain: number;
}

/** 完整交付报告 */
export interface DeliverableReport {
  id: string;
  projectId: string;
  projectName: string;
  generatedAt: string;

  // Executive Summary
  executiveSummary: ExecutiveSummary;

  // Findings — 发现汇总
  findings: Findings;

  // Opportunities — 机会汇总
  opportunities: Opportunities;

  // Actions — 行动汇总
  actions: Actions;

  // Verification — 验证结果（可为 null）
  verification: Verification | null;

  // Next Recommendations
  nextRecommendations: RecommendationItem[];
}
