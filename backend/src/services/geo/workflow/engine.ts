// ============================================================
// GEO WorkflowEngine — 计算品牌工作流状态
// SSOT: 所有品牌的工作流状态由此引擎计算。
// ============================================================

import type { WorkflowState, GeoWorkflowStep } from './types.js';

export class WorkflowEngine {
  /**
   * Step definitions: order, label, URL pattern
   */
  private static STEP_ORDER: GeoWorkflowStep[] = [
    'brand_created',
    'discovery_completed',
    'ai_presence_checked',
    'explain_viewed',
    'recommendation_viewed',
    'action_plan_started',
    'action_plan_completed',
    'verification_passed',
  ];

  private static STEP_LABELS: Record<GeoWorkflowStep, string> = {
    brand_created: '创建品牌',
    discovery_completed: '完成发现分析',
    ai_presence_checked: 'AI 可见度检查',
    explain_viewed: '查看解释',
    recommendation_viewed: '查看建议',
    action_plan_started: '开始行动方案',
    action_plan_completed: '完成行动方案',
    verification_passed: '通过验证',
  };

  private static STEP_ICONS: Record<GeoWorkflowStep, string> = {
    brand_created: '🏢',
    discovery_completed: '🔍',
    ai_presence_checked: '📡',
    explain_viewed: '💡',
    recommendation_viewed: '📋',
    action_plan_started: '🚀',
    action_plan_completed: '✅',
    verification_passed: '✓',
  };

  private static PROGRESS_PER_STEP = 100 / 8; // 12.5 per step

  /**
   * 计算单个品牌的工作流状态
   * 根据 project.config 中的字段推断当前处于哪个阶段
   */
  getState(project: any): WorkflowState {
    const config = project.config || {};
    const completedSteps = this.computeCompletedSteps(project, config);
    const currentStep = this.determineCurrentStep(completedSteps);
    const remainingSteps = this.computeRemainingSteps(completedSteps);
    const nextStep = remainingSteps.length > 0 ? remainingSteps[0] as GeoWorkflowStep : null;
    const completed = remainingSteps.length === 0;

    return {
      projectId: project.id,
      projectName: project.name,
      currentStep,
      nextStep,
      stepLabel: WorkflowEngine.STEP_LABELS[currentStep],
      nextStepLabel: nextStep ? WorkflowEngine.STEP_LABELS[nextStep] : '已完成',
      progress: Math.round(completedSteps.length * WorkflowEngine.PROGRESS_PER_STEP),
      continueUrl: this.getContinueUrl(project.id, nextStep),
      canVerify: this.canVerify(project, config),
      completed,
      completedSteps,
      remainingSteps,
    };
  }

  /**
   * 获取所有品牌的工作流状态列表，按优先级排序
   * 排序：Waiting Verification > Need Action > Need Action Plan > Need Discovery > Completed
   */
  getAllStates(projects: any[]): WorkflowState[] {
    const states = projects.map((p) => this.getState(p));

    // Sort by priority (lower number = higher priority)
    states.sort((a, b) => {
      const pa = this.getPriorityValue(a);
      const pb = this.getPriorityValue(b);
      return pa - pb;
    });

    return states;
  }

  /**
   * 获取优先级标签
   */
  getPriorityLabel(state: WorkflowState): string {
    const pv = this.getPriorityValue(state);
    switch (pv) {
      case 1: return '需验证';
      case 2: return '需优化';
      case 3: return '需行动';
      case 4: return '需分析';
      default: return '已完成';
    }
  }

  /**
   * 获取优先级数字（越小越紧急）
   * 1 = 需要 Verification（最优先）
   * 2 = 需要继续 Action
   * 3 = 需要 Action Plan
   * 4 = 需要 Discovery
   * 5 = 已完成
   */
  getPriorityValue(state: WorkflowState): number {
    if (state.completed) return 5;
    if (state.canVerify) return 1;
    if (state.currentStep === 'action_plan_started') return 2;
    if (state.currentStep === 'action_plan_completed') return 2;
    if (state.currentStep === 'discovery_completed' || state.currentStep === 'ai_presence_checked') return 3;
    if (state.currentStep === 'explain_viewed' || state.currentStep === 'recommendation_viewed') return 3;
    return 4;
  }

  /**
   * 判断是否可以执行 Verification
   */
  private canVerify(project: any, config: any): boolean {
    // 有 action plan 数据且至少有一个 action_plan_completed，但没有 verification_passed
    const hasActionPlans = config.actionPlans && Array.isArray(config.actionPlans) && config.actionPlans.length > 0;
    const allCompleted = hasActionPlans && config.actionPlans.every((ap: any) => ap.status === 'completed');
    const hasVerificationPassed = config.verifications && Array.isArray(config.verifications) &&
      config.verifications.some((v: any) => v.status === 'PASS');

    return allCompleted && !hasVerificationPassed;
  }

  /**
   * 推断已完成 steps
   */
  private computeCompletedSteps(project: any, config: any): string[] {
    const completed: string[] = [];

    // brand_created — always done if project exists
    completed.push('brand_created');

    // discovery_completed — ADI > 0 或 scanRecords.length > 0
    const adi = project.config?.adi ?? config.adi ?? 0;
    const scanRecords = config.scanRecords || [];
    const hasDiscovery = adi > 0 || (Array.isArray(scanRecords) && scanRecords.length > 0) ||
      !!project.discoveryReportId || !!config.discoveryReportId;
    if (hasDiscovery) {
      completed.push('discovery_completed');
    }

    // ai_presence_checked — project.config 中有 presence 数据
    const hasPresence = config.presence && (Array.isArray(config.presence) || typeof config.presence === 'object') &&
      Object.keys(config.presence).length > 0;
    if (hasPresence) {
      completed.push('ai_presence_checked');
    }

    // explain_viewed — 暂不追踪，默认 pass
    completed.push('explain_viewed');
    // recommendation_viewed — 暂不追踪，默认 pass
    completed.push('recommendation_viewed');

    // action_plan_started — config.actionPlans 有 running 或 completed 状态的
    const actionPlans = config.actionPlans || [];
    if (Array.isArray(actionPlans) && actionPlans.length > 0) {
      const hasRunningOrCompleted = actionPlans.some((ap: any) =>
        ap.status === 'running' || ap.status === 'completed'
      );
      if (hasRunningOrCompleted) {
        completed.push('action_plan_started');
      }

      // action_plan_completed — config.actionPlans 全部 completed
      const allCompleted = actionPlans.length > 0 && actionPlans.every((ap: any) => ap.status === 'completed');
      if (allCompleted) {
        completed.push('action_plan_completed');
      }
    }

    // verification_passed — config.verifications 有 PASS 状态的
    const verifications = config.verifications || [];
    if (Array.isArray(verifications) && verifications.some((v: any) => v.status === 'PASS')) {
      completed.push('verification_passed');
    }

    return completed;
  }

  /**
   * 确定当前 step（已完成的 steps 里的最后一个）
   */
  private determineCurrentStep(completedSteps: string[]): GeoWorkflowStep {
    if (completedSteps.length === 0) return 'brand_created';

    // Find the last completed step in the defined order
    const order = WorkflowEngine.STEP_ORDER;
    let currentIdx = 0;
    for (const step of completedSteps) {
      const idx = order.indexOf(step as GeoWorkflowStep);
      if (idx >= currentIdx) {
        currentIdx = idx;
      }
    }
    return order[currentIdx];
  }

  /**
   * 计算 remaining steps
   */
  private computeRemainingSteps(completedSteps: string[]): string[] {
    return WorkflowEngine.STEP_ORDER.filter(
      (step) => !completedSteps.includes(step)
    );
  }

  /**
   * 获取下一步的 URL
   */
  private getContinueUrl(projectId: string, nextStep: GeoWorkflowStep | null): string {
    // BrandOverview is a single-page workspace — all steps land here
    // with an optional query param for auto-scrolling/activating the right section
    const tabMap: Partial<Record<GeoWorkflowStep, string>> = {
      brand_created: 'overview',
      discovery_completed: 'overview',
      ai_presence_checked: 'presence',
      explain_viewed: 'explain',
      recommendation_viewed: 'recommendations',
      action_plan_started: 'action-plans',
      action_plan_completed: 'verification',
      verification_passed: 'overview',
    };

    const tab = nextStep ? tabMap[nextStep] || 'overview' : 'overview';
    return `/workspace/geo/brand/${projectId}?tab=${tab}`;
  }
}
