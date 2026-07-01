/**
 * Mock Scanner — 模拟 AI 发现扫描结果
 *
 * P0-T005 — AI Discovery Lab MVP
 *
 * MockScanner 接收 entity + scenarioId[]，模拟 AI 发现扫描结果。
 * 所有数据均为模拟生成，不调用任何真实 AI Provider。
 */

import { DiscoveryScenario, DiscoveryOpportunity, DiscoveryReport } from './types';
import { scenarioMatcher } from '../sie/scenario-matcher';
import { scenarioStore } from '../scenario/scenario-store';

/** 生成伪随机数（基于 seed + index，确定性） */
function deterministicRandom(seed: string, index: number, min: number, max: number): number {
  const hash = seed.split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 0) * (index + 1) * 7;
  const normalized = Math.abs(hash % 10000) / 10000;
  return Math.round(min + normalized * (max - min));
}

/** 生成趋势 */
function randomTrend(seed: string, index: number): 'up' | 'stable' | 'down' {
  const val = deterministicRandom(seed, index, 0, 100);
  if (val < 40) return 'up';
  if (val < 70) return 'stable';
  return 'down';
}

/**
 * MockScanner — 模拟 AI 发现扫描
 *
 * 逻辑：
 * - 对于匹配到的场景（confidence > 0），随机 60-90% 覆盖率
 * - 对于未匹配的场景，随机 0-30% 覆盖率
 * - ADI 综合分 = coverage × 0.35 + share × 0.35 + position × 0.30
 * - 差距 > 40 分标记为 high priority
 * - 差距 20-40 分标记为 medium
 * - 差距 < 20 分不标记
 */
export class MockScanner {
  /**
   * 执行发现扫描
   * @param entity 实体名称
   * @param matchConfidences SIE 匹配到的场景及置信度 Map<scenarioId, confidence>
   */
  scan(
    entity: string,
    matchConfidences: Map<string, number>,
  ): {
    scenarios: DiscoveryScenario[];
    coverage: number;
    share: number;
    position: number;
  } {
    const allScenarios = scenarioStore.listScenarios();
    const scenarios: DiscoveryScenario[] = [];

    // 累计覆盖率用于计算最终分数
    let totalCoverageScore = 0;
    let matchedCount = 0;
    let totalConfidence = 0;

    for (const scenario of allScenarios) {
      const confidence = matchConfidences.get(scenario.id) ?? 0;
      const isMatched = confidence > 0;

      // 覆盖率：匹配场景 60-90%，未匹配场景 0-30%
      const coverageScore = isMatched
        ? deterministicRandom(entity, allScenarios.indexOf(scenario), 60, 90)
        : deterministicRandom(entity, allScenarios.indexOf(scenario) + 100, 0, 30);

      scenarios.push({
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        industryId: scenario.industryId,
        entityCoverage: isMatched,  // 实体是否参与此场景
        coverageScore,
        confidence,
        trend: randomTrend(entity, allScenarios.indexOf(scenario)),
      });

      if (isMatched) {
        totalCoverageScore += coverageScore;
        matchedCount++;
        totalConfidence += confidence;
      }
    }

    // 计算三维度分数
    const avgMatchedConfidence = matchedCount > 0 ? totalConfidence / matchedCount : 0;
    const avgCoverage = matchedCount > 0 ? totalCoverageScore / matchedCount : 0;

    // Discovery Coverage：匹配场景的平均覆盖率
    const coverage = Math.round(avgCoverage);

    // Recommendation Share：置信度 × 覆盖率 / 1.0 归一化
    const share = Math.round(Math.min(100, avgMatchedConfidence * avgCoverage * 1.1));

    // Position Score：整体覆盖比例 + 平均置信度加权
    const coverageRatio = matchedCount / Math.max(1, allScenarios.length);
    const position = Math.round(Math.min(100, coverageRatio * 70 + avgMatchedConfidence * 30));

    return { scenarios, coverage, share, position };
  }
}

/** Singleton */
export const mockScanner = new MockScanner();
