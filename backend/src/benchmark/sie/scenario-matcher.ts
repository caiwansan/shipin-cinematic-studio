/**
 * SIE — Scenario Intelligence Engine
 * ScenarioMatcher — Legacy Adapter
 *
 * P2-T002-SIE-01: 保留原始接口签名作为兼容层，内部委托给 Matcher Pipeline。
 *
 * 旧代码调用 `scenarioMatcher.matchTopK(raw, k)` 将自动转为 Pipeline 执行。
 * 新的调用方建议直接使用 `defaultPipeline`。
 *
 * 匹配策略（由 Pipeline 决定）：
 * 1. Exact Match — 完全匹配 naturalExpression（置信度 1.0）
 * 2. Keyword Match — 关键词命中（基于多关键词累积评分）
 *
 * Sprint 3 后增加：
 * 3. Industry Intent — 基于行业的关键词映射
 * 4. Brand Profile — 基于品牌描述/官网的模糊匹配
 *
 * 不依赖任何 AI / Embedding / 向量数据库 / LLM。
 */

import { MatchResult } from './types';
import { defaultPipeline } from './matcher';
import { normalize } from './matcher/normalize';

/** 最低置信度阈值 */
const MIN_CONFIDENCE = 0.3;

export class ScenarioMatcher {
  /**
   * 单条匹配 — 返回置信度最高的结果
   */
  match(raw: string): MatchResult {
    const context = {
      brandName: raw,
      normalized: normalize(raw),
    };
    const results = defaultPipeline.executeAll(context);
    const best = results.reduce((a, b) => (a.confidence >= b.confidence ? a : b));

    if (best.confidence < MIN_CONFIDENCE) {
      return {
        raw,
        normalized: context.normalized,
        matched: false,
        scenarioId: null,
        industryId: null,
        confidence: 0,
        matchedKey: null,
        matchedType: 'none',
      };
    }
    return best;
  }

  /**
   * Top-K 匹配
   */
  matchTopK(raw: string, k: number): MatchResult[] {
    const context = {
      brandName: raw,
      normalized: normalize(raw),
    };
    return defaultPipeline.matchTopK(context, k);
  }

  /**
   * 批量匹配
   */
  batchMatch(raws: string[]): MatchResult[] {
    return raws.map((raw) => this.match(raw));
  }
}

/** Singleton instance */
export const scenarioMatcher = new ScenarioMatcher();
