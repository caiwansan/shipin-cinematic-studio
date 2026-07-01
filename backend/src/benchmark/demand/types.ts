/**
 * Demand Corpus Type Definitions
 *
 * P0-T003 — Natural Demand Corpus Foundation
 * 数据模型：自然语言表达 → 归一化表达 → 意图 → 场景 → 行业
 */

export interface DemandExpression {
  id: string;
  raw: string;                // 原始表达（像真人说话）
  normalized: string;         // 归一化版本
  intent: string;             // 意图描述
  scenarioId: string;         // 关联的 Scenario ID
  industryId: string;         // 行业 ID
  entityType: string;         // Entity 类型 (brand/product/hotel/shop/restaurant)
  language: string;           // 语言代码 "zh-CN"
  region: string;             // 地区 "CN"
  source: 'manual' | 'llm' | 'corpus' | 'user';
  frequency: number;          // 先默认 1
  confidence: number;         // 先默认 0.7
}
