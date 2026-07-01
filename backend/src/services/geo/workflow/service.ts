// ============================================================
// DashboardMissionService — 聚合 Dashboard 所需数据
// SSOT: 所有 Dashboard 数据通过此服务获取。
// ============================================================

import type { DashboardMission, WorkflowState } from './types.js';
import { WorkflowEngine } from './engine.js';
import { geoScanHistoryRepository } from '../repositories/geo-scan-history.repository.js';
import { verificationResultRepository } from '../repositories/verification-result.repository.js';
import { geoBrandProfileRepository } from '../repositories/geo-brand-profile.repository.js';
import { geoProjectRepository } from '../repositories/geo-project.repository.js';

export class DashboardMissionService {
  constructor(
    private workflowEngine: WorkflowEngine,
    private projectRepo: typeof geoProjectRepository,
    private scanRepo: typeof geoScanHistoryRepository = geoScanHistoryRepository,
    private verificationRepo: typeof verificationResultRepository = verificationResultRepository,
    private brandProfileRepo: typeof geoBrandProfileRepository = geoBrandProfileRepository,
  ) {}

  /**
   * 获取 Dashboard Mission 数据
   */
  async getDashboardMission(userId: string): Promise<DashboardMission> {
    // 1. 加载用户所有品牌项目（未删除的）
    const projects = await this.projectRepo.findMany({ userId, deletedAt: null });

    // 2. 计算每个品牌的 WorkflowState
    const states = this.workflowEngine.getAllStates(projects);
    const projectIds = projects.map((p: any) => p.id);

    // 3. 汇总 todayProgress
    const todayProgress = this.buildTodayProgress(states);

    // 4. 找到 continueJourney（第一个未完成的品牌）
    const continueJourney = this.buildContinueJourney(states, projects);

    // 5. 按优先级排序品牌列表
    const prioritizedProjects = this.buildPrioritizedProjects(states, projects);

    // 6. 从 scan history / verification history 构建 recentActivities
    const recentActivities = await this.buildRecentActivities(projects);

    // 7. 聚合 systemHealth
    const systemHealth = await this.buildSystemHealth(projectIds);

    return {
      todayProgress,
      continueJourney,
      prioritizedProjects,
      recentActivities,
      systemHealth,
    };
  }

  /**
   * 构建 Today's Progress
   */
  private buildTodayProgress(states: WorkflowState[]): DashboardMission['todayProgress'] {
    const steps = [
      { label: 'Brand', key: 'brand_created', icon: '🏢' },
      { label: 'Discovery', key: 'discovery_completed', icon: '🔍' },
      { label: 'AI Presence', key: 'ai_presence_checked', icon: '📡' },
      { label: 'Action Plan', key: 'action_plan_completed', icon: '🚀' },
      { label: 'Verification', key: 'verification_passed', icon: '✓' },
    ];

    // 如果没有任何品牌，所有步骤为未完成
    if (states.length === 0) {
      return {
        totalSteps: 5,
        completedSteps: 0,
        progressPercent: 0,
        steps: steps.map((s) => ({ label: s.label, done: false, icon: s.icon })),
      };
    }

    // 每个步骤，只要有任意一个品牌完成就算该步骤完成
    const completedCount = steps.reduce((count, step) => {
      const someDone = states.some((s) => s.completedSteps.includes(step.key));
      return count + (someDone ? 1 : 0);
    }, 0);

    return {
      totalSteps: 5,
      completedSteps: completedCount,
      progressPercent: Math.round((completedCount / 5) * 100),
      steps: steps.map((s) => ({
        label: s.label,
        done: states.some((st) => st.completedSteps.includes(s.key)),
        icon: s.icon,
      })),
    };
  }

  /**
   * 构建 Continue Journey
   */
  private buildContinueJourney(
    states: WorkflowState[],
    projects: any[],
  ): DashboardMission['continueJourney'] {
    const firstIncomplete = states.find((s) => !s.completed);
    if (!firstIncomplete) return null;

    const project = projects.find((p: any) => p.id === firstIncomplete.projectId);
    const adi = project?.config?.adi ?? 0;

    return {
      projectId: firstIncomplete.projectId,
      projectName: firstIncomplete.projectName,
      currentStep: firstIncomplete.stepLabel,
      nextStep: firstIncomplete.nextStepLabel || '已完成',
      nextStepUrl: firstIncomplete.continueUrl,
      canContinue: true,
    };
  }

  /**
   * 构建排序后的品牌列表
   */
  private buildPrioritizedProjects(
    states: WorkflowState[],
    projects: any[],
  ): DashboardMission['prioritizedProjects'] {
    return states
      .filter((s) => !s.completed)
      .concat(states.filter((s) => s.completed))
      .map((state) => {
        const project = projects.find((p: any) => p.id === state.projectId);
        const adi = project?.config?.adi ?? 0;
        return {
          id: state.projectId,
          name: state.projectName,
          priority: this.workflowEngine.getPriorityValue(state),
          priorityLabel: this.workflowEngine.getPriorityLabel(state),
          status: project?.status || 'draft',
          adi,
          currentStep: state.stepLabel,
          continueUrl: state.continueUrl,
        };
      });
  }

  /**
   * 构建 Recent Activities
   */
  private async buildRecentActivities(projects: any[]): Promise<DashboardMission['recentActivities']> {
    const activities: Array<{
      type: string;
      label: string;
      projectName: string;
      timestamp: string;
      relativeTime: string;
    }> = [];

    const projectMap = new Map(projects.map((p: any) => [p.id, p.name || 'Unknown']));

    // 收集最近 20 条 scan record
    if (projects.length > 0) {
      const projectIds = projects.map((p: any) => p.id);
      const scans = await this.scanRepo.findMany(
        { where: { projectId: { in: projectIds } } },
        { createdAt: 'desc' as const },
      );
      for (const scan of (scans as any[]).slice(0, 10)) {
        activities.push({
          type: 'scan',
          label: `Discovery scan ${scan.status}`,
          projectName: projectMap.get(scan.projectId) || 'Unknown',
          timestamp: scan.createdAt || scan.updatedAt,
          relativeTime: this.relativeTime(scan.createdAt || scan.updatedAt),
        });
      }
    }

    // 收集最近验证结果
    if (projects.length > 0) {
      const projectIds = projects.map((p: any) => p.id);
      const verifications = await this.verificationRepo.findMany(
        { where: { projectId: { in: projectIds } } },
        { orderBy: { verifiedAt: 'desc' } as any, take: 10 },
      );
      for (const v of (verifications as any[])) {
        activities.push({
          type: 'verification',
          label: v.status === 'PASS' ? `Verification passed (+${v.deltaAdi || 0} ADI)` : `Verification ${v.status}`,
          projectName: projectMap.get(v.projectId) || 'Unknown',
          timestamp: v.createdAt,
          relativeTime: this.relativeTime(v.createdAt),
        });
      }
    }

    // 添加品牌创建事件
    for (const project of projects) {
      activities.push({
        type: 'brand_created',
        label: `Brand ${project.name} created`,
        projectName: project.name,
        timestamp: project.createdAt,
        relativeTime: this.relativeTime(project.createdAt),
      });
    }

    // 按时间排序
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return activities.slice(0, 20);
  }

  /**
   * 构建 System Health
   */
  private async buildSystemHealth(projectIds: string[]): Promise<DashboardMission['systemHealth']> {
    let aiPresenceCount = 0;
    let aiPresenceTotal = 0;
    let lastScanAt = '';
    let lastScanRelative = '';

    // 从 BrandProfile 获取 presence 数据
    for (const pid of projectIds) {
      try {
        const profile = await this.brandProfileRepo.findFirst({ projectId: pid });
        if (profile) {
          // presence 字段可能存储为 JSON 或已解析
          let presence: any[] = [];
          if (typeof profile.presence === 'string') {
            try { presence = JSON.parse(profile.presence); } catch { presence = []; }
          } else if (Array.isArray(profile.presence)) {
            presence = profile.presence;
          } else if (profile.presence && typeof profile.presence === 'object') {
            presence = Object.values(profile.presence);
          }

          const visible = presence.filter((p: any) =>
            p.visibility === 'visible' || p.visibility === 'partial'
          );
          aiPresenceCount += visible.length;
          aiPresenceTotal += presence.length;
        }
      } catch {
        // Skip if no profile found
      }
    }

    // 获取最后扫描时间
    if (projectIds.length > 0) {
      try {
        const lastScan = await this.scanRepo.findFirst(
          { projectId: { in: projectIds } },
          { createdAt: 'desc' },
        );
        if (lastScan) {
          lastScanAt = lastScan.createdAt;
          lastScanRelative = this.relativeTime(lastScan.createdAt);
        }
      } catch {
        // No scans yet
      }
    }

    return {
      aiPresenceCount,
      aiPresenceTotal,
      lastScanAt,
      lastScanRelative: lastScanRelative || '—',
      apiHealthy: true,
    };
  }

  /**
   * 计算相对时间
   */
  private relativeTime(dateStr: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return `${diffSec}秒前`;
    if (diffMin < 60) return `${diffMin}分钟前`;
    if (diffHour < 24) return `${diffHour}小时前`;
    if (diffDay < 30) return `${diffDay}天前`;
    return `${Math.floor(diffDay / 30)}月前`;
  }

  /**
   * 获取 Workflow 优先级值（供外部使用）
   */
  getPriorityValue(state: WorkflowState): number {
    return this.workflowEngine.getPriorityValue(state);
  }
}
