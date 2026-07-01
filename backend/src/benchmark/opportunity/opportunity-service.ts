/**
 * Opportunity Service — 整合引擎
 *
 * P0-T006 — Opportunity Engine (First Edition)
 *
 * 接收 DiscoveryScenario[] → 通过规则引擎 → 输出 Opportunity[]
 *
 * 引擎流水线：
 *   1. 优先级判定 (priority-rules.ts)
 *   2. 难度判定 (priority-rules.ts → determineEffort)
 *   3. Expected ADI Gain 计算 (impact-calculator.ts)
 *   4. 原因生成 (reason-generator.ts)
 *   5. 建议映射 (suggestion-map.ts)
 *   6. 组装 Opportunity[]，按 priority+gap 排序
 */

import { Opportunity } from './types';
import { DiscoveryScenario } from '../discovery/types';
import { determinePriority, determineEffort, Priority } from './priority-rules';
import { calculateExpectedAdiGain } from './impact-calculator';
import { generateReason } from './reason-generator';
import { getSuggestion } from './suggestion-map';
import { scenarioStore } from '../scenario/scenario-store';

// 行业场景数基准 — 用于评估竞争对手覆盖情况
const INDUSTRY_SCENARIO_COUNTS: Record<string, number> = {
  brand: 5,
  product: 5,
  hotel: 5,
  ecommerce: 5,
  restaurant: 5,
};

export class OpportunityService {
  /**
   * 从 DiscoveryScenario[] 生成 Opportunity[]
   *
   * @param scenarios   发现场景列表
   * @param matchConfidences scenarioId → confidence 映射（用于判断竞争对手数）
   * @param matchedIntentCounts scenarioId → 匹配到的需求表达数（用于需求热度）
   */
  generateOpportunities(
    scenarios: DiscoveryScenario[],
    matchConfidences: Map<string, number>,
    matchedIntentCounts: Map<string, number>,
  ): Opportunity[] {
    const opportunities: Opportunity[] = [];
    const totalIndustryScenarios = new Map<string, number>();

    // 统计各行业的场景总数
    for (const s of scenarios) {
      totalIndustryScenarios.set(
        s.industryId,
        (totalIndustryScenarios.get(s.industryId) ?? 0) + 1,
      );
    }

    for (const scenario of scenarios) {
      const gap = 100 - scenario.coverageScore;

      // 仅 gap > 15 才标记为机会（减少噪音）
      if (gap <= 15) continue;

      // 同一行业有多少个 matching 场景（近似估算竞争对手覆盖密度）
      const industryTotal = totalIndustryScenarios.get(scenario.industryId) ?? 1;
      const matchedInIndustry = scenarios.filter(
        s => s.industryId === scenario.industryId && matchConfidences.has(s.scenarioId),
      ).length;
      const competitorCount = matchedInIndustry;  // 该行业匹配到的场景数

      const matchedIntentCount = matchedIntentCounts.get(scenario.scenarioId) ?? 0;

      // 1. 优先级判定
      const priority: Priority = determinePriority(scenario, competitorCount, matchedIntentCount);

      // 2. 难度判定
      const effort = determineEffort(scenario.scenarioId);

      // 3. Expected ADI Gain 计算
      const expectedAdiGain = calculateExpectedAdiGain(gap, priority, effort);

      // 4. 原因生成
      const reason = generateReason(scenario, competitorCount, matchedIntentCount);

      // 5. 建议映射
      const suggestion = getSuggestion(scenario.scenarioId);

      // 6. 标签生成
      const tags = this.generateTags(scenario, priority, effort);

      opportunities.push({
        id: `opp-${scenario.scenarioId}-${Date.now()}`,
        scenarioId: scenario.scenarioId,
        scenarioName: scenario.scenarioName,
        industryId: scenario.industryId,
        coverageScore: scenario.coverageScore,
        gap,
        priority,
        expectedAdiGain,
        reason,
        suggestion,
        effort,
        tags,
      });
    }

    // 按 priority 排序（high first），同优先级按 gap 降序
    const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

    opportunities.sort((a, b) => {
      const pa = priorityOrder[a.priority];
      const pb = priorityOrder[b.priority];
      if (pa !== pb) return pa - pb;
      return b.gap - a.gap;
    });

    return opportunities;
  }

  /**
   * 生成标签
   */
  private generateTags(
    scenario: DiscoveryScenario,
    priority: Priority,
    effort: 'easy' | 'medium' | 'hard',
  ): string[] {
    const tags: string[] = [];

    tags.push(`priority:${priority}`);
    tags.push(`effort:${effort}`);
    if (scenario.trend === 'down') tags.push('trend:declining');
    if (scenario.trend === 'up') tags.push('trend:improving');
    if (scenario.coverageScore < 20) tags.push('critical');
    if (scenario.coverageScore >= 80) tags.push('near-full');

    return tags;
  }
}

/** Singleton */
export const opportunityService = new OpportunityService();
