/**
 * Discovery Report — Type Definitions
 *
 * P0-T005 — AI Discovery Lab MVP
 *
 * DiscoveryReport aggregates SIE scenario matching results with
 * simulated AI discovery scans to produce a comprehensive assessment
 * of an entity's discoverability across demand scenarios.
 */

/** 发现场景 — 单个 Scenario 的覆盖评估 */
export interface DiscoveryScenario {
  scenarioId: string;
  scenarioName: string;
  industryId: string;
  entityCoverage: boolean;    // 实体是否覆盖此场景
  coverageScore: number;      // 0-100
  confidence: number;         // 0-1
  trend: 'up' | 'stable' | 'down';
}

/** 优化机会 — 完整类型（升级版，与 Opportunity Engine 一致） */
export interface DiscoveryOpportunity {
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

/** 发现报告 — 完整评估报告 */
export interface DiscoveryReport {
  id: string;
  entityId: string;
  entityName: string;
  adi: number;                // 综合 ADI 分 (0-100)
  dimensions: {               // 三维度
    coverage: number;         // Discovery Coverage (0-100)
    share: number;            // Recommendation Share (0-100)
    position: number;         // Position Score (0-100)
  };
  scenarios: DiscoveryScenario[];
  opportunities: DiscoveryOpportunity[];
  generatedAt: string;
}
