/**
 * SIE — Scenario Intelligence Engine
 * ScenarioMatcher — Rule-Based Matching Engine
 *
 * P0-T004 — Scenario Intelligence Engine (Rule-Based)
 *
 * 匹配策略（按优先级）：
 * 1. Exact Match — 完全匹配 naturalExpression（置信度 1.0）
 * 2. Keyword Match — 关键词命中（基于多关键词累积评分）
 * 3. Intent Match — 意图描述方向匹配（兜底策略）
 *
 * 评分模型：
 * - 每个匹配到 Scenario 的关键词贡献分数
 * - 分数 = len(keyword)^1.5 × 0.04
 * - 短关键词（2字）贡献约 0.11，长关键词（6字）贡献约 0.59
 * - 同时匹配多个不同关键词有额外加分
 * - 累积分数上限 0.85 + 多样性加分
 *
 * 不依赖任何 AI / Embedding / 向量数据库 / LLM。
 */

import { MatchResult, MatchType } from './types';
import { getKeywords } from './keyword-map';
import { scenarioStore } from '../scenario/scenario-store';

/** 最低置信度阈值 */
const MIN_CONFIDENCE = 0.3;

/** 空输入或过短输入的字符数上限 */
const MIN_INPUT_LENGTH = 2;

export class ScenarioMatcher {
  /**
   * 单条匹配 — 返回置信度最高的结果
   */
  match(raw: string): MatchResult {
    const results = this.computeAllMatches(raw);
    const best = results.reduce((a, b) => (a.confidence >= b.confidence ? a : b));

    if (best.confidence < MIN_CONFIDENCE) {
      return {
        raw,
        normalized: best.normalized,
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
   * Top-K 匹配 — 返回置信度最高的 K 条结果
   */
  matchTopK(raw: string, k: number): MatchResult[] {
    const results = this.computeAllMatches(raw);
    return results
      .filter((r) => r.confidence >= MIN_CONFIDENCE)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, k);
  }

  /**
   * 批量匹配
   */
  batchMatch(raws: string[]): MatchResult[] {
    return raws.map((raw) => this.match(raw));
  }

  // ── Private ──────────────────────────────────────────────────────

  private computeAllMatches(raw: string): MatchResult[] {
    const normalized = this.normalize(raw);
    const scenarios = scenarioStore.listScenarios();

    if (!normalized || normalized.length < MIN_INPUT_LENGTH) {
      return [{
        raw,
        normalized,
        matched: false,
        scenarioId: null,
        industryId: null,
        confidence: 0,
        matchedKey: null,
        matchedType: 'none' as MatchType,
      }];
    }

    return scenarios.map((s) => this.matchSingleScenario(raw, normalized, s));
  }

  /**
   * 对单个 Scenario 执行匹配
   */
  private matchSingleScenario(
    raw: string,
    normalized: string,
    scenario: {
      id: string;
      industryId: string;
      description: string;
      intents: { description: string; naturalExpressions: string[] }[];
    },
  ): MatchResult {
    // ── 1. Exact Match ──
    for (const intent of scenario.intents) {
      for (const expr of intent.naturalExpressions) {
        if (normalized === this.normalize(expr)) {
          return {
            raw, normalized,
            matched: true,
            scenarioId: scenario.id,
            industryId: scenario.industryId,
            confidence: 1.0,
            matchedKey: expr,
            matchedType: 'exact',
          };
        }
      }
    }

    // ── 2. Keyword Match — 多关键词累积评分 ──
    const keywords = getKeywords(scenario.id);
    const matchedKeywords: { keyword: string; score: number }[] = [];

    for (const keyword of keywords) {
      if (keyword.length < 2) continue;
      if (normalized.includes(keyword)) {
        const score = this.keywordScore(keyword);
        matchedKeywords.push({ keyword, score });
      }
    }

    if (matchedKeywords.length > 0) {
      const sorted = matchedKeywords.sort((a, b) => b.score - a.score);
      const totalScore = matchedKeywords.reduce((sum, m) => sum + m.score, 0);
      const diversityBonus = Math.min(0.12, (matchedKeywords.length - 1) * 0.04);
      const confidence = Math.min(0.95, Math.min(totalScore, 0.88) + diversityBonus);

      return {
        raw, normalized,
        matched: true,
        scenarioId: scenario.id,
        industryId: scenario.industryId,
        confidence,
        matchedKey: sorted[0].keyword,
        matchedType: 'keyword',
      };
    }

    // ── 3. Intent Match (兜底) ──
    const inputChars = this.uniqueChars(normalized);
    if (inputChars.length < 4) {
      return {
        raw, normalized,
        matched: false,
        scenarioId: scenario.id,
        industryId: scenario.industryId,
        confidence: 0,
        matchedKey: null,
        matchedType: 'none',
      };
    }

    let bestOverlapChars = '';
    let bestOverlapCount = 0;

    for (const intent of scenario.intents) {
      const descChars = this.uniqueChars(this.normalize(intent.description));
      const overlap = inputChars.filter((ch) => descChars.includes(ch));
      if (overlap.length > bestOverlapCount) {
        bestOverlapCount = overlap.length;
        bestOverlapChars = overlap.join('');
      }
    }

    if (bestOverlapCount >= 4) {
      const confidence = Math.min(0.30, 0.20 + (bestOverlapCount - 3) * 0.025);
      return {
        raw, normalized,
        matched: true,
        scenarioId: scenario.id,
        industryId: scenario.industryId,
        confidence,
        matchedKey: bestOverlapChars,
        matchedType: 'intent',
      };
    }

    return {
      raw, normalized,
      matched: false,
      scenarioId: scenario.id,
      industryId: scenario.industryId,
      confidence: 0,
      matchedKey: null,
      matchedType: 'none',
    };
  }

  /**
   * 关键词评分：len^1.5 × 0.06
   * 2字 → 0.170, 3字 → 0.312, 4字 → 0.480, 5字 → 0.671, 6字 → 0.882
   */
  private keywordScore(keyword: string): number {
    return Math.pow(keyword.length, 1.5) * 0.06;
  }

  /**
   * 归一化
   */
  private normalize(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
      .trim();
  }

  /**
   * 提取去重中文字符
   */
  private uniqueChars(text: string): string[] {
    return [...new Set(text.split('').filter((ch) => /[\u4e00-\u9fa5]/.test(ch)))];
  }
}

/** Singleton instance */
export const scenarioMatcher = new ScenarioMatcher();
