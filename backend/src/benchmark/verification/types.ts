/**
 * Verification Engine — Type Definitions
 *
 * P0-T008 — Verification Engine MVP
 *
 * Defines VerifiedItem and VerificationReport types for
 * Before/After ADI comparison, dimension breakdowns,
 * improvement attribution, and confidence scoring.
 */

/** 验证条目 — 单个已验证的 Action 任务 */
export interface VerifiedItem {
  id: string;
  actionPlanId: string;
  actionStepId: string;
  title: string;
  status: 'completed' | 'pending' | 'skipped';
  /** 该任务完成的 ADI 贡献（completed 时自动计算） */
  adiContribution: number;
  details: string;
}

/** 验证报告 — 完整 Before/After 对比评估 */
export interface VerificationReport {
  id: string;
  entityId: string;
  entityName: string;

  // Before / After
  beforeAdi: number;
  afterAdi: number;
  deltaAdi: number;
  improvementRate: number;

  // 子维度变化
  dimensionChanges: {
    coverage: { before: number; after: number; delta: number };
    share: { before: number; after: number; delta: number };
    position: { before: number; after: number; delta: number };
  };

  // Action 完成情况
  totalActions: number;
  completedActions: number;
  skippedActions: number;
  pendingActions: number;
  completionRate: number;

  // 详表
  verifiedItems: VerifiedItem[];

  // 可解释性（原因分解）
  improvementBreakdown: {
    label: string;
    contribution: number;
    detail: string;
  }[];

  // 剩余问题
  remainingIssues: {
    scenarioId: string;
    scenarioName: string;
    gap: number;
    priority: 'high' | 'medium' | 'low';
  }[];

  // 元数据
  confidence: number;
  verifiedAt: string;
}
