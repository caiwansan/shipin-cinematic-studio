/**
 * Discovery Service — 主服务
 *
 * P0-T005 — AI Discovery Lab MVP
 * P0-T006 — Opportunity Engine (First Edition) — 接入 OpportunityService
 *
 * 接收 entity → SIE 场景匹配 → Mock 发现扫描 → 生成报告
 */

import { DiscoveryReport } from './types';
import { Opportunity, opportunityService } from '../opportunity';
import { scenarioMatcher } from '../sie/scenario-matcher';
import { scenarioStore } from '../scenario/scenario-store';
import { mockScanner } from './mock-scanner';

/**
 * DiscoveryService — 实体发现评估服务
 */
export class DiscoveryService {
  /**
   * 对实体执行完整发现评估
   * @param entity 实体名称（如 "昆仑镜AI"）
   * @returns DiscoveryReport
   */
  async evaluateEntity(entity: string): Promise<DiscoveryReport> {
    // Step 1: SIE 匹配 — 获取 Top-K 场景及置信度
    const allScenarios = scenarioStore.listScenarios();
    const matchResults = scenarioMatcher.matchTopK(entity, allScenarios.length);

    // 构建 scenarioId → confidence / intent count 映射
    const matchConfidences = new Map<string, number>();
    const matchedIntentCounts = new Map<string, number>();

    for (const result of matchResults) {
      if (result.scenarioId && result.matched) {
        matchConfidences.set(result.scenarioId, result.confidence);
        // 模拟 intent 匹配数：匹配到的场景至少有 1 条 intent 匹配
        // 高 confidence 场景意味着更多 intent 匹配
        matchedIntentCounts.set(
          result.scenarioId,
          result.confidence > 0.8 ? 4 : result.confidence > 0.5 ? 2 : 1,
        );
      }
    }

    // Step 2: Mock 发现扫描
    const { scenarios, coverage, share, position } = mockScanner.scan(entity, matchConfidences);

    // Step 3: 计算 ADI 综合分 (coverage × 0.35 + share × 0.35 + position × 0.30)
    const adi = Math.round(coverage * 0.35 + share * 0.35 + position * 0.30);

    // Step 4: 使用 OpportunityService 识别优化机会（替代硬编码）
    const opportunities: import('./types').DiscoveryOpportunity[] =
      opportunityService.generateOpportunities(
        scenarios,
        matchConfidences,
        matchedIntentCounts,
      );

    // Step 5: 组装报告
    const report: DiscoveryReport = {
      id: `dr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      entityId: `entity-${entity.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-')}`,
      entityName: entity,
      adi,
      dimensions: { coverage, share, position },
      scenarios,
      opportunities,
      generatedAt: new Date().toISOString(),
    };

    return report;
  }
}

/** Singleton */
export const discoveryService = new DiscoveryService();
