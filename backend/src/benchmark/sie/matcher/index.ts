/**
 * SIE — Scenario Intelligence Engine
 * Matcher Pipeline — Entry Point
 */

export { MatcherPipeline } from './pipeline';
export { ExactMatcher } from './exact.matcher';
export { NaturalExpressionMatcher } from './natural.matcher';
export { IndustryMatcher } from './industry.matcher';
export { BrandProfileMatcher } from './brand-profile.matcher';
export { normalize, uniqueChars } from './normalize';
export type {
  Matcher,
  DiscoveryContext,
  MatcherScenario,
  PipelineResult,
} from './matcher.interface';
export { MATCHER_PRIORITIES } from './matcher.interface';

import { MatcherPipeline } from './pipeline';
import { ExactMatcher } from './exact.matcher';
import { NaturalExpressionMatcher } from './natural.matcher';
import { IndustryMatcher } from './industry.matcher';
import { BrandProfileMatcher } from './brand-profile.matcher';

/**
 * 创建默认 Pipeline（含所有已实现 Matcher）
 *
 * 优先级顺序：
 * 1. ExactMatcher (100) — 完全匹配，高置信度
 * 2. NaturalExpressionMatcher (200) — 关键词累积评分
 * 3. IndustryMatcher (400) — 基于行业匹配
 * 4. BrandProfileMatcher (500) — 基于品牌画像兜底
 * 5. EmbeddingMatcher (预留，600)
 */
export function createDefaultPipeline(): MatcherPipeline {
  const pipeline = new MatcherPipeline();
  pipeline.registerAll([
    new ExactMatcher(),
    new NaturalExpressionMatcher(),
    new IndustryMatcher(),
    new BrandProfileMatcher(),
  ]);
  return pipeline;
}

/** 全局默认 Pipeline 单例 */
export const defaultPipeline = createDefaultPipeline();
