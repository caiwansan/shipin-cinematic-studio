/**
 * SIE — Scenario Intelligence Engine
 * Industry Matcher — 基于行业的场景匹配
 *
 * P2-T002-SIE-03: IndustryMatcher
 *
 * 匹配策略：
 * - 读取 DiscoveryContext.industry
 * - 查询 Industry Intent Registry 获取对应场景
 * - 有精确 industry 匹配时返回 baseline 置信度
 * - 无精确匹配时，尝试从 profileTokens 中的别名匹配
 *
 * 这是 Pipeline 中的"候选扩展层"（Candidate Expansion），
 * 置信度低于 Exact/Natural Matcher，高于 BrandProfileMatcher。
 */

import { Matcher, DiscoveryContext, MatcherScenario, PipelineResult, MATCHER_PRIORITIES } from './matcher.interface';
import { getIndustryEntry, industryIntentRegistry } from '../industry-intent-registry';

export class IndustryMatcher implements Matcher {
  readonly name = 'IndustryMatcher';
  readonly priority = MATCHER_PRIORITIES.INDUSTRY_INTENT;

  match(context: DiscoveryContext, scenario: MatcherScenario): PipelineResult | null {
    // 策略 1：精确 industry 匹配
    const industryId = context.industry?.trim().toLowerCase();
    if (industryId) {
      const entry = getIndustryEntry(industryId);
      if (entry) {
        const scenarioRef = entry.scenarios.find((s) => s.id === scenario.id);
        if (scenarioRef) {
          const confidence = Math.min(1.0, entry.weight * (scenarioRef.weight ?? 1.0));
          return {
            raw: context.brandName,
            normalized: context.normalized,
            matched: true,
            scenarioId: scenario.id,
            industryId: entry.parentIndustry || industryId,
            confidence: Math.round(confidence * 100) / 100,
            matchedKey: industryId,
            matchedType: 'intent',
            matcherName: this.name,
            reason: `行业匹配: industry=${industryId}, ${scenarioRef.reason || ''}`,
          };
        }
      }
    }

    // 策略 2：profileTokens 别名匹配（兜底）
    // 当 industry 字段为空或 registry 中未找到时，尝试从 profileTokens 匹配
    if (context.profileTokens && context.profileTokens.length > 0) {
      for (const token of context.profileTokens) {
        const lowerToken = token.toLowerCase().trim();
        for (const [entryId, entry] of Object.entries(industryIntentRegistry)) {
          if (lowerToken === entryId.toLowerCase()) {
            const scenarioRef = entry.scenarios.find((s) => s.id === scenario.id);
            if (scenarioRef) {
              const confidence = Math.min(1.0, entry.weight * 0.8 * (scenarioRef.weight ?? 1.0));
              return {
                raw: context.brandName,
                normalized: context.normalized,
                matched: true,
                scenarioId: scenario.id,
                industryId: entryId,
                confidence: Math.round(confidence * 100) / 100,
                matchedKey: token,
                matchedType: 'intent',
                matcherName: this.name,
                reason: `行业别名匹配: token="${token}" → industry=${entryId}, ${scenarioRef.reason || ''}`,
              };
            }
          }
          // 检查 entry 的别名
          if (entry.aliases) {
            for (const alias of entry.aliases) {
              if (lowerToken === alias.toLowerCase()) {
                const scenarioRef = entry.scenarios.find((s) => s.id === scenario.id);
                if (scenarioRef) {
                  const confidence = Math.min(1.0, entry.weight * 0.7 * (scenarioRef.weight ?? 1.0));
                  return {
                    raw: context.brandName,
                    normalized: context.normalized,
                    matched: true,
                    scenarioId: scenario.id,
                    industryId: entryId,
                    confidence: Math.round(confidence * 100) / 100,
                    matchedKey: alias,
                    matchedType: 'intent',
                    matcherName: this.name,
                    reason: `行业别名匹配: token="${token}" → alias="${alias}" → industry=${entryId}, ${scenarioRef.reason || ''}`,
                  };
                }
              }
            }
          }
        }
      }
    }

    return null;
  }
}
