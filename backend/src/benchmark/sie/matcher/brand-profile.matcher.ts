/**
 * SIE — Scenario Intelligence Engine
 * Brand Profile Matcher — 基于品牌画像的场景匹配
 *
 * P2-T002-SIE-03: BrandProfileMatcher
 *
 * 匹配策略：
 * - 最高 Pipeline 中最低优先级的 Matcher（兜底）
 * - 只消费 DiscoveryContext.profileTokens
 * - 对所有 Scenario 匹配 profileTokens 中的关键词重叠度
 * - 重叠度越高，置信度越高
 * - 置信度上限 0.45（确保不会覆盖 IndustryMatcher 的结果）
 *
 * 依赖：
 * - DiscoveryContextBuilder 已经生成 profileTokens
 * - keyword-map.ts 中的场景关键词
 *
 * 为什么置信度上限 0.45？
 * - Exact Matcher: 1.0
 * - Natural Matcher: 0.95
 * - Industry Matcher: ~0.7
 * - BrandProfile: ≤0.45（兜底，确保优先级不越位）
 */

import { Matcher, DiscoveryContext, MatcherScenario, PipelineResult, MATCHER_PRIORITIES } from './matcher.interface';
import { getKeywords } from '../keyword-map';
import { uniqueChars } from './normalize';

/** 最大置信度——低于所有高优先级 Matcher */
const MAX_CONFIDENCE = 0.45;

/** 最小 token 重叠数量 */
const MIN_TOKEN_OVERLAP = 1;

export class BrandProfileMatcher implements Matcher {
  readonly name = 'BrandProfileMatcher';
  readonly priority = MATCHER_PRIORITIES.BRAND_PROFILE;

  match(context: DiscoveryContext, scenario: MatcherScenario): PipelineResult | null {
    const tokens = context.profileTokens;
    if (!tokens || tokens.length === 0) return null;

    const keywords = getKeywords(scenario.id);
    if (keywords.length === 0) return null;

    // 计算 Token 与关键词的重叠
    const matchedTokens: string[] = [];
    const matchedKeywords: string[] = [];

    // Token 匹配关键词（归一化后）
    const normalizedTokens = tokens.map((t) => t.toLowerCase().trim());
    const normalizedKeywords = keywords.map((k) => {
      // keyword-map 里的关键词可能是中文，去掉空格
      return k.trim().toLowerCase().replace(/\s+/g, '');
    });

    for (const token of normalizedTokens) {
      for (const kw of normalizedKeywords) {
        // 精确匹配：token 包含 keyword 或 keyword 包含 token
        if (token.includes(kw) || kw.includes(token)) {
          if (token.length >= 2 || kw.length >= 2) {
            matchedTokens.push(token);
            matchedKeywords.push(kw);
            break;
          }
        }
      }
    }

    if (matchedTokens.length < MIN_TOKEN_OVERLAP) {
      return null;
    }

    // 去重
    const uniqueMatchedTokens = [...new Set(matchedTokens)];
    const uniqueMatchedKeywords = [...new Set(matchedKeywords)];

    // 置信度计算：基于重叠比例
    const overlapRatio = uniqueMatchedKeywords.length / Math.max(1, keywords.length);
    const confidence = Math.min(MAX_CONFIDENCE, 0.15 + overlapRatio * 0.35);

    return {
      raw: context.brandName,
      normalized: context.normalized,
      matched: true,
      scenarioId: scenario.id,
      industryId: scenario.industryId,
      confidence: Math.round(confidence * 100) / 100,
      matchedKey: uniqueMatchedTokens[0],
      matchedType: 'intent',
      matcherName: this.name,
      reason: `品牌画像匹配: tokens="${uniqueMatchedTokens.slice(0, 3).join(', ')}", keywords="${uniqueMatchedKeywords.slice(0, 3).join(', ')}"`,
    };
  }
}
