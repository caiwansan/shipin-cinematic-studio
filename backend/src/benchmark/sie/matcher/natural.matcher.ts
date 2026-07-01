/**
 * SIE — Scenario Intelligence Engine
 * Natural Expression Matcher — 多关键词累积评分匹配
 *
 * 匹配策略：
 * - 对每个 Scenario 的关键词列表执行包含匹配
 * - 多关键词累积评分，匹配不同关键词有额外多样性加分
 * - 置信度上限 0.95
 *
 * 评分模型：
 * - 每个关键词贡献 score = len^1.5 × 0.06
 * - 2字 → 0.170, 3字 → 0.312, 4字 → 0.480, 5字 → 0.671, 6字 → 0.882
 * - 同时匹配多个不同关键词有额外加分（最多 +0.12）
 * - 累积分数上限 0.85 + 多样性加分
 *
 * 原 `scenario-matcher.ts` 的 Keyword Match 逻辑迁移至此。
 */

import { Matcher, DiscoveryContext, MatcherScenario, PipelineResult, MATCHER_PRIORITIES } from './matcher.interface';
import { getKeywords } from '../keyword-map';
import { normalize } from './normalize';

/** 关键词评分：len^1.5 × 0.06 */
function keywordScore(keyword: string): number {
  return Math.pow(keyword.length, 1.5) * 0.06;
}

export class NaturalExpressionMatcher implements Matcher {
  readonly name = 'NaturalExpressionMatcher';
  readonly priority = MATCHER_PRIORITIES.NATURAL_EXPRESSION;

  match(context: DiscoveryContext, scenario: MatcherScenario): PipelineResult | null {
    const { normalized } = context;
    const keywords = getKeywords(scenario.id);
    const matchedKeywords: { keyword: string; score: number }[] = [];

    for (const keyword of keywords) {
      if (keyword.length < 2) continue;
      if (normalized.includes(keyword)) {
        const score = keywordScore(keyword);
        matchedKeywords.push({ keyword, score });
      }
    }

    if (matchedKeywords.length === 0) return null;

    const sorted = matchedKeywords.sort((a, b) => b.score - a.score);
    const totalScore = matchedKeywords.reduce((sum, m) => sum + m.score, 0);
    const diversityBonus = Math.min(0.12, (matchedKeywords.length - 1) * 0.04);
    const confidence = Math.min(0.95, Math.min(totalScore, 0.88) + diversityBonus);

    return {
      raw: context.brandName,
      normalized,
      matched: true,
      scenarioId: scenario.id,
      industryId: scenario.industryId,
      confidence,
      matchedKey: sorted[0].keyword,
      matchedType: 'keyword',
      matcherName: this.name,
      reason: `关键词匹配: ${matchedKeywords.map((k) => k.keyword).join(', ')}`,
    };
  }
}
