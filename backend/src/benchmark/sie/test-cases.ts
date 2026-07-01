/**
 * SIE — Scenario Intelligence Engine
 * Test Cases (≥ 20, covering exact/keyword/intent/no-match/multi-match/edge)
 *
 * P0-T004 — Scenario Intelligence Engine (Rule-Based)
 *
 * Each test case defines: raw input, expected match behavior.
 *
 * 覆盖策略：
 * - Exact match × 3: 命中某个 naturalExpression
 * - Keyword match × 6: 通过关键词命中 Scenario
 * - Intent match × 3: 通过意图方向命中
 * - No match × 3: 完全不匹配的场景
 * - Multi-match × 3: 一个输入可能匹配多个 Scenario
 * - Edge cases × 3: 空字符串、特殊字符、短输入
 */

import { MatchType } from './types';

export interface TestCase {
  /** 测试名称 */
  name: string;
  /** 原始输入 */
  raw: string;
  /** 期望匹配的 Scenario ID（null = 不匹配） */
  expectedScenarioId: string | null;
  /** 期望的匹配类型 */
  expectedType: MatchType;
  /** 允许的最低置信度 */
  minConfidence: number;
  /** 期望匹配到的关键词（可选） */
  expectedKeyContains?: string;
}

export const testCases: TestCase[] = [
  // ── Exact Match (×3) ─────────────────────────────────────────────
  {
    name: 'exact-1: brand-discovery naturalExpression',
    raw: '我想了解一下这个品牌的背景故事',
    expectedScenarioId: 'brand-discovery',
    expectedType: 'exact',
    minConfidence: 1.0,
  },
  {
    name: 'exact-2: hotel-location naturalExpression',
    raw: '这家酒店的位置方便吗？离市中心远不远？',
    expectedScenarioId: 'hotel-location',
    expectedType: 'exact',
    minConfidence: 1.0,
  },
  {
    name: 'exact-3: shop-trust naturalExpression',
    raw: '这家店铺靠谱吗？会不会是假的？',
    expectedScenarioId: 'shop-trust',
    expectedType: 'exact',
    minConfidence: 1.0,
  },

  // ── Keyword Match (×6) ──────────────────────────────────────────
  {
    name: 'keyword-1: brand-comparison via "品牌对比" / "哪个更好"',
    raw: '帮我对比一下耐克和阿迪达斯的区别',
    expectedScenarioId: 'brand-comparison',
    expectedType: 'keyword',
    minConfidence: 0.3,
  },
  {
    name: 'keyword-2: product-safety via "安全认证"',
    raw: '这个产品有没有安全认证',
    expectedScenarioId: 'product-safety',
    expectedType: 'keyword',
    minConfidence: 0.3,
  },
  {
    name: 'keyword-3: restaurant-ambiance via "餐厅环境" / "氛围"',
    raw: '这家餐厅的环境氛围怎么样',
    expectedScenarioId: 'restaurant-ambiance',
    expectedType: 'keyword',
    minConfidence: 0.3,
  },
  {
    name: 'keyword-4: hotel-suitability via "适合"',
    raw: '带小孩去这家酒店住是否适合',
    expectedScenarioId: 'hotel-suitability',
    expectedType: 'keyword',
    minConfidence: 0.3,
  },
  {
    name: 'keyword-5: product-alternative via "替代品"',
    raw: '有没有什么替代品可以买',
    expectedScenarioId: 'product-alternative',
    expectedType: 'keyword',
    minConfidence: 0.3,
  },
  {
    name: 'keyword-6: shop-service via "售后服务"',
    raw: '这家店的售后服务处理快不快',
    expectedScenarioId: 'shop-service',
    expectedType: 'keyword',
    minConfidence: 0.3,
  },

  // ── Intent Match (×3) ───────────────────────────────────────────
  {
    name: 'intent-1: brand-positioning via description overlap (市场/定位)',
    raw: '这个牌子的市场定位是怎么样的',
    expectedScenarioId: 'brand-positioning',
    expectedType: 'keyword',
    minConfidence: 0.3,
  },
  {
    name: 'intent-2: restaurant-cuisine via description overlap (菜品/口味)',
    raw: '他们家的菜品口味有什么特点',
    expectedScenarioId: 'restaurant-cuisine',
    expectedType: 'keyword',
    minConfidence: 0.3,
  },
  {
    name: 'intent-3: shop-reputation via description overlap (整体/评价)',
    raw: '这家店的整体评价是怎么样的',
    expectedScenarioId: 'shop-reputation',
    expectedType: 'keyword',
    minConfidence: 0.3,
  },

  // ── No Match (×3) ───────────────────────────────────────────────
  {
    name: 'no-match-1: totally irrelevant (weather)',
    raw: '今天的天气真好啊',
    expectedScenarioId: null,
    expectedType: 'none',
    minConfidence: 0,
  },
  {
    name: 'no-match-2: technical jargon (quantum physics)',
    raw: '量子力学薛定谔方程怎么推导',
    expectedScenarioId: null,
    expectedType: 'none',
    minConfidence: 0,
  },
  {
    name: 'no-match-3: greeting',
    raw: '你好请问有什么可以帮助你的吗',
    expectedScenarioId: null,
    expectedType: 'none',
    minConfidence: 0,
  },

  // ── Multi-Match (×3) — Top-K 验证 ─────────────────────────────
  {
    name: 'multi-match-1: "对比一下" matches product-comparison',
    raw: '对比一下这两款产品哪个更好',
    expectedScenarioId: 'product-comparison',
    expectedType: 'keyword',
    minConfidence: 0.3,
  },
  {
    name: 'multi-match-2: "性价比" matches product-purchase',
    raw: '这家酒店的性价比高不高',
    expectedScenarioId: 'hotel-value',
    expectedType: 'keyword',
    minConfidence: 0.3,
  },
  {
    name: 'multi-match-3: "口碑" matches shop-reputation or restaurant-recommendation',
    raw: '这家店的口碑怎么样',
    expectedScenarioId: 'shop-reputation',
    expectedType: 'keyword',
    minConfidence: 0.3,
  },

  // ── Edge Cases (×3) ─────────────────────────────────────────────
  {
    name: 'edge-1: empty string',
    raw: '',
    expectedScenarioId: null,
    expectedType: 'none',
    minConfidence: 0,
  },
  {
    name: 'edge-2: special characters only',
    raw: '！@#￥%……&*（）',
    expectedScenarioId: null,
    expectedType: 'none',
    minConfidence: 0,
  },
  {
    name: 'edge-3: very short input (single char)',
    raw: '好',
    expectedScenarioId: null,
    expectedType: 'none',
    minConfidence: 0,
  },
];

/** Multi-match test cases for Top-K validation */
export function getMultiMatchCases(): { name: string; raw: string; expectedInTop2: string[] }[] {
  return [
    {
      name: 'multi-match-topk-1: "对比一下" includes product-comparison and brand-comparison',
      raw: '对比一下这两款产品哪个更好',
      expectedInTop2: ['product-comparison', 'brand-comparison'],
    },
    {
      name: 'multi-match-topk-2: "口碑" includes shop-reputation and potentially others',
      raw: '这家店的口碑怎么样',
      expectedInTop2: ['shop-reputation'],
    },
    {
      name: 'multi-match-topk-3: "性价比" includes hotel-value and product-purchase',
      raw: '这家酒店的性价比高不高',
      expectedInTop2: ['product-purchase', 'hotel-value'],
    },
  ];
}
