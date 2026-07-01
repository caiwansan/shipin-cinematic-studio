// ============================================================
// WalkthroughEngine — 实时计算当前引导状态
// RC1-T003 — SSOT: 所有 Walkthrough 状态由本引擎计算
// 禁止：localStorage、page-level 引导逻辑、Tour 引导
// ============================================================

import { UserProgressRepository } from './repository.js';
import { WorkflowEngine } from '../workflow/engine.js';

export interface GuideInfo {
  step: 'discovery' | 'explain' | 'action_plan' | 'verification' | null;
  message: string;
  nextAction: string;
  nextUrl: string;
}

export interface WalkthroughState {
  showWelcomeCard: boolean;
  activeGuide: GuideInfo | null;
  dismissed: boolean;
  completed: boolean;
}

const GUIDE_MAP: Record<string, GuideInfo> = {
  discovery: {
    step: 'discovery',
    message: '品牌已创建！开始 AI 发现扫描，了解品牌的 AI 可见度现状。',
    nextAction: 'Run Discovery',
    nextUrl: '/workspace/geo/discovery',
  },
  explain: {
    step: 'explain',
    message: '发现扫描已完成！查看 AI 可见度解释，了解得分背后的原因。',
    nextAction: 'Open Explainability',
    nextUrl: '/workspace/geo/brand/',
  },
  action_plan: {
    step: 'action_plan',
    message: '解释已查看！开始制定行动方案，提升品牌的 AI 可见度。',
    nextAction: 'Generate Action Plan',
    nextUrl: '/workspace/geo/brand/',
  },
  verification: {
    step: 'verification',
    message: '行动方案已就绪！运行验证以确认改进效果。',
    nextAction: 'Run Verification',
    nextUrl: '/workspace/geo/brand/',
  },
};

export class WalkthroughEngine {
  constructor(
    private repo: UserProgressRepository,
    private workflowEngine: WorkflowEngine,
  ) {}

  /**
   * 获取当前 Walkthrough 状态
   * getState 逻辑：
   * 1. 从 repo 查当前进度
   * 2. 如果 completed 或 dismissed → showWelcomeCard: false, activeGuide: null
   * 3. 如果 Brand == 0 → showWelcomeCard: true
   * 4. 否则查第一个品牌（按创建时间倒序）的 WorkflowState
   * 5. 如果 progress.completed && projects.length > 0 → 不再触发
   */
  async getState(userId: string, projects: any[]): Promise<WalkthroughState> {
    // 1. 查当前持久化进度
    const progress = await this.repo.findByUserId(userId);

    // 2. 如果已 dismissed 或 completed，不显示任何引导
    if (progress?.dismissed) {
      return { showWelcomeCard: false, activeGuide: null, dismissed: true, completed: false };
    }
    if (progress?.completed) {
      return { showWelcomeCard: false, activeGuide: null, dismissed: false, completed: true };
    }

    // 3. Brand == 0 → Welcome Card
    if (!projects || projects.length === 0) {
      return {
        showWelcomeCard: true,
        activeGuide: null,
        dismissed: false,
        completed: false,
      };
    }

    // 4. 有品牌 → 查第一个品牌的工作流状态
    const activeProjects = projects.filter((p: any) => !p.deletedAt);
    if (activeProjects.length === 0) {
      return { showWelcomeCard: true, activeGuide: null, dismissed: false, completed: false };
    }

    // 按创建时间倒序取第一个品牌
    const sorted = [...activeProjects].sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const firstProject = sorted[0];
    const workflowState = this.workflowEngine.getState(firstProject);

    // 根据 WorkflowState 推导 activeGuide
    const completedSteps = workflowState.completedSteps;
    const guide = this.computeActiveGuide(completedSteps, firstProject.id, firstProject.name);

    // 如果已完成全部且不应该再有 guide，自动标记 complete
    if (workflowState.completed && !guide) {
      await this.repo.markCompleted(userId);
      return { showWelcomeCard: false, activeGuide: null, dismissed: false, completed: true };
    }

    return {
      showWelcomeCard: false,
      activeGuide: guide,
      dismissed: false,
      completed: false,
    };
  }

  /**
   * 根据已完成的 steps 推导当前应显示的 Guide
   */
  private computeActiveGuide(
    completedSteps: string[],
    projectId: string,
    projectName: string,
  ): GuideInfo | null {
    // brand_created → discovery
    if (
      completedSteps.includes('brand_created') &&
      !completedSteps.includes('discovery_completed')
    ) {
      const guide = { ...GUIDE_MAP.discovery };
      return guide;
    }

    // discovery_completed → explain
    if (
      completedSteps.includes('discovery_completed') &&
      !completedSteps.includes('explain_viewed')
    ) {
      const guide = { ...GUIDE_MAP.explain };
      guide.nextUrl = `/workspace/geo/brand/${projectId}`;
      return guide;
    }

    // explain_viewed → action_plan
    if (
      completedSteps.includes('explain_viewed') &&
      !completedSteps.includes('action_plan_started')
    ) {
      const guide = { ...GUIDE_MAP.action_plan };
      guide.nextUrl = `/workspace/geo/brand/${projectId}`;
      return guide;
    }

    // action_plan_started or recommendation_viewed → verification
    if (
      (completedSteps.includes('action_plan_started') ||
        completedSteps.includes('recommendation_viewed') ||
        completedSteps.includes('action_plan_completed')) &&
      !completedSteps.includes('verification_passed')
    ) {
      const guide = { ...GUIDE_MAP.verification };
      guide.nextUrl = `/workspace/geo/brand/${projectId}`;
      return guide;
    }

    // verification_passed → 完成，无 guide
    if (completedSteps.includes('verification_passed')) {
      return null;
    }

    // 兜底：无匹配 guide
    return null;
  }

  /**
   * Dismiss Walkthrough
   */
  async dismiss(userId: string): Promise<void> {
    await this.repo.markDismissed(userId);
  }

  /**
   * Complete Walkthrough
   */
  async complete(userId: string): Promise<void> {
    await this.repo.markCompleted(userId);
  }

  /**
   * Restart Walkthrough（重置为初始状态）
   */
  async restart(userId: string): Promise<WalkthroughState> {
    await this.repo.restart(userId);
    return {
      showWelcomeCard: true,
      activeGuide: null,
      dismissed: false,
      completed: false,
    };
  }
}
