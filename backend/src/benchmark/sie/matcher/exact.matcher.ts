/**
 * SIE — Scenario Intelligence Engine
 * Exact Matcher — 完全匹配 naturalExpression
 *
 * 匹配策略：
 * - 对每个 Scenario.intents[n].naturalExpressions[n] 执行 normalize 后的完全匹配
 * - 匹配成功时置信度 1.0
 * - 原 `scenario-matcher.ts` 的 Exact Match 逻辑迁移至此
 */

import { Matcher, DiscoveryContext, MatcherScenario, PipelineResult, MATCHER_PRIORITIES } from './matcher.interface';
import { normalize, uniqueChars } from './normalize';

export class ExactMatcher implements Matcher {
  readonly name = 'ExactMatcher';
  readonly priority = MATCHER_PRIORITIES.EXACT;

  match(context: DiscoveryContext, scenario: MatcherScenario): PipelineResult | null {
    const { normalized } = context;

    for (const intent of scenario.intents) {
      for (const expr of intent.naturalExpressions) {
        if (normalized === normalize(expr)) {
          return {
            raw: context.brandName,
            normalized,
            matched: true,
            scenarioId: scenario.id,
            industryId: scenario.industryId,
            confidence: 1.0,
            matchedKey: expr,
            matchedType: 'exact',
            matcherName: this.name,
            reason: `完全匹配: "${expr}"`,
          };
        }
      }
    }

    return null;
  }
}
