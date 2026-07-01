/**
 * SIE — Scenario Intelligence Engine
 * Matcher Pipeline — 按优先级执行各 Matcher
 *
 * 工作方式：
 * 1. 对所有 Scenario，按注册的 Matcher 顺序执行
 * 2. 每个 Matcher 按优先级从高到低逐个尝试
 * 3. 第一个返回 matched=true 的结果即为最终匹配
 * 4. 所有 Matcher 都返回 null → No Match
 *
 * Pipeline 本身是单例，Matcher 通过 register() 注册。
 * Matcher 的执行顺序由 MATCHER_PRIORITIES 决定（数字越小越优先）。
 */

import { scenarioStore } from '../../scenario/scenario-store';
import { MatchResult } from '../types';
import {
  DiscoveryContext,
  Matcher,
  MatcherScenario,
  PipelineResult,
} from './matcher.interface';

export class MatcherPipeline {
  private matchers: Matcher[] = [];

  /**
   * 注册一个 Matcher（按优先级排序插入）
   */
  register(matcher: Matcher): void {
    this.matchers.push(matcher);
    this.matchers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 批量注册 Matcher（确保顺序正确）
   */
  registerAll(matchers: Matcher[]): void {
    for (const m of matchers) {
      this.register(m);
    }
  }

  /**
   * 获取已注册的 Matcher 列表
   */
  getRegisteredMatchers(): Matcher[] {
    return [...this.matchers];
  }

  /**
   * 执行 Pipeline — 对所有 Scenario 执行匹配
   *
   * @param context DiscoveryContext
   * @returns 每个 Scenario 的匹配结果（PipelineResult[]，兼容 MatchResult）
   */
  executeAll(context: DiscoveryContext): PipelineResult[] {
    const scenarios = this.loadScenarios();
    const results: PipelineResult[] = [];

    for (const scenario of scenarios) {
      // 跳过归一化后过短的输入
      if (!context.normalized || context.normalized.length < 2) {
        results.push(this.noMatch(context, scenario, '输入过短'));
        continue;
      }

      let matched = false;
      for (const matcher of this.matchers) {
        const result = matcher.match(context, scenario);
        if (result !== null && result.matched) {
          results.push(result);
          matched = true;
          break;
        }
      }

      if (!matched) {
        results.push(this.noMatch(context, scenario, undefined));
      }
    }

    return results;
  }

  /**
   * Top-K 匹配 — 返回置信度最高的 K 条结果
   */
  matchTopK(context: DiscoveryContext, k: number): PipelineResult[] {
    const results = this.executeAll(context);
    return results
      .filter((r) => r.matched)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, k);
  }

  // ── Private ──

  private noMatch(context: DiscoveryContext, scenario: MatcherScenario, reason?: string): PipelineResult {
    return {
      raw: context.brandName,
      normalized: context.normalized,
      matched: false,
      scenarioId: scenario.id,
      industryId: scenario.industryId,
      confidence: 0,
      matchedKey: null,
      matchedType: 'none',
      reason: reason || '所有 Matcher 均未匹配',
    };
  }

  private loadScenarios(): MatcherScenario[] {
    const scenarios = scenarioStore.listScenarios();
    return scenarios.map((s) => ({
      id: s.id,
      industryId: s.industryId,
      name: s.name,
      description: s.description,
      intents: s.intents.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        naturalExpressions: i.naturalExpressions,
      })),
    }));
  }
}
