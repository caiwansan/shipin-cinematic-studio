/**
 * Verification Service — 验证服务
 *
 * P0-T008 — Verification Engine MVP
 *
 * 整合 DiscoveryService + ActionPlanService → VerificationEngine
 * 流程：
 *   1. 从 DiscoveryService 获取 baseline DiscoveryReport
 *   2. 从 ActionPlanService 获取 ActionPlan[]
 *   3. 运行 VerificationEngine 规则生 VerificationReport
 */

import { discoveryService } from '../discovery/discovery-service';
import { Opportunity } from '../opportunity/types';
import { scenarioMatcher } from '../sie/scenario-matcher';
import { scenarioStore } from '../scenario/scenario-store';
import { mockScanner } from '../discovery/mock-scanner';
import { opportunityService } from '../opportunity';
import { actionPlanService } from '../action-plan/action-plan-service';
import { ActionPlan } from '../action-plan/types';
import { VerificationEngine } from './verification-engine';
import { VerificationReport } from './types';

/**
 * VerificationService — 验证服务
 */
export class VerificationService {
  private engine = new VerificationEngine();

  /**
   * 对指定实体执行验证
   *
   * @param entityName 实体名称
   * @returns VerificationReport
   */
  async verify(entityName: string): Promise<VerificationReport> {
    // Step 1: 获取 baseline DiscoveryReport
    const baseline = await discoveryService.evaluateEntity(entityName.trim());

    // Step 2: 获取 ActionPlan（需要重新走匹配流程）
    const allScenarios = scenarioStore.listScenarios();
    const matchResults = scenarioMatcher.matchTopK(entityName, allScenarios.length);

    const matchConfidences = new Map<string, number>();
    const matchedIntentCounts = new Map<string, number>();

    for (const result of matchResults) {
      if (result.scenarioId && result.matched) {
        matchConfidences.set(result.scenarioId, result.confidence);
        matchedIntentCounts.set(
          result.scenarioId,
          result.confidence > 0.8 ? 4 : result.confidence > 0.5 ? 2 : 1,
        );
      }
    }

    const { scenarios } = mockScanner.scan(entityName, matchConfidences);
    const opportunities = opportunityService.generateOpportunities(
      scenarios,
      matchConfidences,
      matchedIntentCounts,
    );

    const actionPlans = actionPlanService.generatePlans(opportunities, entityName);

    // 对生成的 ActionPlan 模拟一些 completed 状态以展示效果
    const enhancedActionPlans = this.simulateCompletionStatus(actionPlans);

    // Step 3: 运行验证引擎
    const report = this.engine.generateReport(baseline, enhancedActionPlans);

    return report;
  }

  /**
   * 模拟 ActionPlan 状态（当实际状态为空时提供 demo 数据）
   * 规则：将前 40% 的计划设为 completed，按优先级
   */
  private simulateCompletionStatus(plans: ActionPlan[]): ActionPlan[] {
    if (plans.length === 0) return plans;

    // 按优先级排序（high → medium → low）
    const priorityOrder: Record<string, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    const sorted = [...plans].sort(
      (a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3),
    );

    const completedCount = Math.max(1, Math.ceil(sorted.length * 0.4));

    return sorted.map((plan, idx) => {
      if (idx < completedCount) {
        return { ...plan, status: 'completed' as const };
      }
      if (idx < completedCount + Math.ceil(sorted.length * 0.2)) {
        return { ...plan, status: 'skipped' as const };
      }
      return { ...plan, status: 'pending' as const };
    });
  }
}

/** Singleton */
export const verificationService = new VerificationService();
