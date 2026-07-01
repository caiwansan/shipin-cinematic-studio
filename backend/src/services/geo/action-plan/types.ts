// ============================================================
// Action Plan Types — P0-T007 Action Plan Engine
// ============================================================

export interface ActionPlan {
  id: string;
  projectId: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedMinutes: number;
  expectedImpact: string;   // 如 "预计 +8 ADI"
  estimatedGain: number;    // 0-100
  status: 'todo' | 'running' | 'completed';
  sourceEvidenceIds: string[];
  recommendationId: string;
  explain: string;          // "为什么做这个"
  createdAt: string;
  updatedAt: string;
}

export interface ActionPlanSummary {
  total: number;
  todo: number;
  running: number;
  completed: number;
  totalEstimatedGain: number;   // 所有 Plan 预估收益之和
}

export interface ActionPlanResult {
  projectId: string;
  plans: ActionPlan[];
  summary: ActionPlanSummary;
}
