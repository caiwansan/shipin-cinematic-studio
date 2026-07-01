/**
 * Priority Rules — 优先级判定规则
 *
 * P0-T006 — Opportunity Engine (First Edition)
 *
 * 纯规则引擎，无 AI 调用。
 */

import { DiscoveryScenario } from '../discovery/types';

export type Priority = 'high' | 'medium' | 'low';

/**
 * 判定优先级
 *
 * 规则（≥6 条）：
 * 1. 覆盖率 < 20 → high
 * 2. 覆盖率 20-40 + 竞争对手多（confidence > 0.5）→ high
 * 3. 覆盖率 40-60 → medium
 * 4. 覆盖率 > 60 → low
 * 5. 趋势 down + 覆盖率 < 50 → high（正在恶化）
 * 6. 高需求（匹配到需求表达 > 3 条, 即 high confidence）→ 优先级提升一级
 */
export function determinePriority(
  scenario: DiscoveryScenario,
  competitorCount: number,
  matchedIntentCount: number,
): Priority {
  const { coverageScore, trend } = scenario;
  let base: Priority;

  // 规则 1: 覆盖率 < 20 → high
  if (coverageScore < 20) {
    base = 'high';
  }
  // 规则 2: 覆盖率 20-40 → high（如果对手多）
  else if (coverageScore >= 20 && coverageScore < 40) {
    base = competitorCount > 2 ? 'high' : 'medium';
  }
  // 规则 3: 覆盖率 40-60 → medium
  else if (coverageScore >= 40 && coverageScore <= 60) {
    base = 'medium';
  }
  // 规则 4: 覆盖率 > 60 → low
  else {
    base = 'low';
  }

  // 规则 5: 趋势 down + 覆盖率 < 50 → high（正在恶化）
  if (trend === 'down' && coverageScore < 50) {
    base = 'high';
  }

  // 规则 6: 高需求（匹配到需求表达 > 3 条）→ 优先级提升一级
  if (matchedIntentCount > 3) {
    base = elevatePriority(base);
  }

  return base;
}

/**
 * 将优先级提升一级（high 保持 high）
 */
function elevatePriority(p: Priority): Priority {
  if (p === 'low') return 'medium';
  if (p === 'medium') return 'high';
  return 'high';
}

/**
 * Effort 判定规则（≥2 条）
 *
 * 规则 1: "品牌历史"、"品牌定位"、"品牌发现"类场景 → easy（补充文本即可）
 * 规则 2: "产品安全"、"店铺信誉"、"品牌信任评估"类场景 → hard
 * 默认: medium
 */
export function determineEffort(scenarioId: string): 'easy' | 'medium' | 'hard' {
  // 规则 1: 文本补充类场景 → easy
  const easyScenarios = [
    'brand-history',
    'brand-positioning',
    'brand-discovery',
    'brand-comparison',
    'hotel-experience',
  ];

  // 规则 2: 需要实质内容验证 → hard
  const hardScenarios = [
    'product-safety',
    'shop-trust',
    'shop-reputation',
    'brand-trust',
    'product-purchase',
  ];

  if (easyScenarios.includes(scenarioId)) return 'easy';
  if (hardScenarios.includes(scenarioId)) return 'hard';
  return 'medium';
}
