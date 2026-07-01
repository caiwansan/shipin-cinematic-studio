/**
 * SIE — Scenario Intelligence Engine
 * Type Definitions
 *
 * P0-T004 — Scenario Intelligence Engine (Rule-Based)
 */

/** 匹配类型 */
export type MatchType = 'exact' | 'keyword' | 'intent' | 'none';

/** 单条匹配结果 */
export interface MatchResult {
  /** 原始输入 */
  raw: string;
  /** 归一化后的输入 */
  normalized: string;
  /** 是否匹配到 Scenario */
  matched: boolean;
  /** 匹配到的 Scenario ID（未匹配则为 null） */
  scenarioId: string | null;
  /** 匹配到的行业 ID（未匹配则为 null） */
  industryId: string | null;
  /** 匹配置信度 (0-1) */
  confidence: number;
  /** 匹配到的关键词/表达 */
  matchedKey: string | null;
  /** 匹配类型 */
  matchedType: MatchType;
}

/** Top-K 匹配请求 */
export interface MatchTopKRequest {
  raw: string;
  k: number;
}

/** Scenario → keywords 映射条目 */
export interface KeywordEntry {
  scenarioId: string;
  keywords: string[];
}
