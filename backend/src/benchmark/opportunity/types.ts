/**
 * Opportunity Engine — Type Definitions
 *
 * P0-T006 — Opportunity Engine (First Edition)
 *
 * Defines the extended Opportunity type used by OpportunityService
 * to produce actionable optimization recommendations.
 */

/** 优化机会 — 完整类型 */
export interface Opportunity {
  id: string;
  scenarioId: string;
  scenarioName: string;
  industryId: string;
  coverageScore: number;         // 当前覆盖率 0-100
  gap: number;                   // 差距 = 100 - coverageScore
  priority: 'high' | 'medium' | 'low';
  expectedAdiGain: number;       // 预计 ADI 提升点数
  reason: string;                // 为什么这个有机会
  suggestion: string;            // 具体优化建议
  effort: 'easy' | 'medium' | 'hard';  // 优化难度
  tags: string[];                // 标签（可选）
}
