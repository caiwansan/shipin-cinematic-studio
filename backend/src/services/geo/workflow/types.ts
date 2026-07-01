// ============================================================
// GEO Workflow — Types
// SSOT for all workflow state definitions.
// ============================================================

export type GeoWorkflowStep =
  | 'brand_created'
  | 'discovery_completed'
  | 'ai_presence_checked'
  | 'explain_viewed'
  | 'recommendation_viewed'
  | 'action_plan_started'
  | 'action_plan_completed'
  | 'verification_passed';

export interface WorkflowState {
  projectId: string;
  projectName: string;
  currentStep: GeoWorkflowStep;
  nextStep: GeoWorkflowStep | null;
  stepLabel: string;         // 当前步骤描述
  nextStepLabel: string;     // 下一步描述（或 null）
  progress: number;          // 0-100
  continueUrl: string;       // 下一步的 URL
  canVerify: boolean;        // 是否可以执行 Verification
  completed: boolean;        // 是否已完成全部步骤
  completedSteps: string[];  // 已完成的步骤名称
  remainingSteps: string[];  // 未完成的步骤名称
}

export interface DashboardMission {
  todayProgress: {
    totalSteps: number;
    completedSteps: number;
    progressPercent: number;
    steps: Array<{ label: string; done: boolean; icon: string }>;
  };
  continueJourney: {
    projectId: string;
    projectName: string;
    currentStep: string;
    nextStep: string;
    nextStepUrl: string;
    canContinue: boolean;
  } | null;
  prioritizedProjects: Array<{
    id: string;
    name: string;
    priority: number;        // 越大越紧急
    priorityLabel: string;   // "需验证" / "需优化" / "需分析" / "已完成"
    status: string;
    adi: number;
    currentStep: string;
    continueUrl: string;
  }>;
  recentActivities: Array<{
    type: string;
    label: string;
    projectName: string;
    timestamp: string;
    relativeTime: string;
  }>;
  systemHealth: {
    aiPresenceCount: number;  // Visible+Partial 的平台数
    aiPresenceTotal: number;  // 总平台数
    lastScanAt: string;
    lastScanRelative: string;
    apiHealthy: boolean;
  };
}
