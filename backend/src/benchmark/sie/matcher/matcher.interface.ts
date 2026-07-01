/**
 * SIE — Scenario Intelligence Engine
 * Matcher Pipeline — Interface & Types
 *
 * P2-T002-SIE-01: Matcher Pipeline Refactor
 *
 * 每个 Matcher 是一个独立的策略单元，注册到 Pipeline 按优先级依次执行。
 * 第一个返回 matched=true 的 Matcher 决定最终匹配结果。
 */

import { MatchResult, MatchType } from '../types';

/**
 * Discovery Context — 匹配的完整输入
 *
 * P2-T002-SIE-02: 统一输入模型，从 Project 数据生成。
 * 预留 aliases/tags/locale 为后续扩展。
 */
export interface DiscoveryContext {
  /** 品牌名（必需） */
  brandName: string;
  /** 归一化后的品牌名（由 DiscoveryContextBuilder 生成） */
  normalized: string;
  /** 行业标识 */
  industry?: string;
  /** 品牌描述 */
  description?: string;
  /** 官网 URL */
  website?: string;
  /** 别名（预留） */
  aliases?: string[];
  /** 标签（预留） */
  tags?: string[];
  /** 语言（预留） */
  locale?: string;
  /** Profile tokens — 从 brandName + industry + description + website 提取的匹配 Token（预留） */
  profileTokens?: string[];
}

/**
 * Matcher 优先级顺序（数字越小优先级越高）
 */
export const MATCHER_PRIORITIES = {
  EXACT: 100,
  NATURAL_EXPRESSION: 200,
  KEYWORD: 300,
  INDUSTRY_INTENT: 400,
  BRAND_PROFILE: 500,
  EMBEDDING: 600,
} as const;

/**
 * Matcher Pipeline 结果（扩展 MatchResult 增加 reason 和 matcherName）
 */
export interface PipelineResult extends MatchResult {
  /** 触发匹配的 Matcher 名称 */
  matcherName?: string;
  /** 匹配理由（用于 Explainability） */
  reason?: string;
  /** 配置信心（分数 0-100） */
  score?: number;
}

/**
 * Matcher 接口 — 所有 Matcher 必须实现
 */
export interface Matcher {
  /** Matcher 名称（唯一标识） */
  readonly name: string;
  /** 优先级（数字越小越优先） */
  readonly priority: number;
  /**
   * 执行匹配
   * @param context 发现上下文
   * @param scenario 目标 Scenario
   * @returns MatchResult | null（返回 null 表示不处理此 Scenario）
   */
  match(context: DiscoveryContext, scenario: MatcherScenario): PipelineResult | null;
}

/**
 * Pipeline 可见的 Scenario 简化接口
 */
export interface MatcherScenario {
  id: string;
  industryId: string;
  name: string;
  description: string;
  intents: {
    id: string;
    name: string;
    description: string;
    naturalExpressions: string[];
  }[];
}
