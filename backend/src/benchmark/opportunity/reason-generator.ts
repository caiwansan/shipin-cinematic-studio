/**
 * Reason Generator — 规则化原因生成器
 *
 * P0-T006 — Opportunity Engine (First Edition)
 *
 * 根据场景特征（覆盖率、趋势、行业竞争等）生成优化原因。
 * 纯规则引擎，无 AI 调用。
 */

import { DiscoveryScenario } from '../discovery/types';

/**
 * 生成原因
 *
 * 规则（≥8 条）：
 * 1. 覆盖率低 + 高需求 → "该场景用户需求强烈，但实体信息覆盖不足"
 * 2. 趋势下降 → "该场景发现趋势正在下降，需要立即干预"
 * 3. 覆盖率中低 + 竞争对手覆盖好 → "行业中同类实体在此场景表现更好"
 * 4. 覆盖率极低（<10）→ "该场景几乎未被覆盖，存在重大信息缺失"
 * 5. 覆盖率中等（40-60）+ 趋势下降 → "中等覆盖但呈下降趋势，需巩固以防止进一步流失"
 * 6. 高覆盖率但需求持续增长 → "当前覆盖较好，但用户需求增速超过覆盖提升速度"
 * 7. 品牌类场景覆盖率低 → "品牌信息缺失影响用户认知和信任建立"
 * 8. 购买/决策类场景覆盖率低 → "直接影响用户购买决策转化"
 * 9. 趋势稳定 + 覆盖率 low → "长期覆盖不足，稳定需求场景中的短板"
 * 10. 历史数据对比中发现整体低于同行业 → "低于行业平均水平，存在系统性提升空间"
 */
export function generateReason(
  scenario: DiscoveryScenario,
  competitorCount: number,
  matchedIntentCount: number,
): string {
  const { coverageScore, trend, scenarioId, industryId } = scenario;
  const gap = 100 - coverageScore;

  // 规则 4: 覆盖率极低（< 10）
  if (coverageScore < 10) {
    return '该场景几乎未被覆盖，存在重大信息缺失';
  }

  // 规则 1: 覆盖率低 + 高需求
  if (coverageScore < 30 && matchedIntentCount > 3) {
    return '该场景用户需求强烈，但实体信息覆盖不足';
  }

  // 规则 2: 趋势下降
  if (trend === 'down' && coverageScore < 50) {
    return '该场景发现趋势正在下降，需要立即干预';
  }

  // 规则 3: 覆盖率中低 + 竞争对手覆盖好
  if (coverageScore < 50 && competitorCount > 3) {
    return '行业中同类实体在此场景表现更好';
  }

  // 规则 5: 中等覆盖 + 趋势下降
  if (coverageScore >= 40 && coverageScore <= 60 && trend === 'down') {
    return '中等覆盖但呈下降趋势，需巩固以防止进一步流失';
  }

  // 规则 7: 品牌类场景覆盖率低
  if (industryId === 'brand' && coverageScore < 50) {
    return '品牌信息缺失影响用户认知和信任建立';
  }

  // 规则 8: 购买/决策类场景覆盖率低
  if ((scenarioId.includes('purchase') || scenarioId.includes('booking') || scenarioId === 'product-comparison') && coverageScore < 50) {
    return '直接影响用户购买决策转化';
  }

  // 规则 9: 稳定趋势 + 覆盖率 low
  if (trend === 'stable' && coverageScore < 40) {
    return '长期覆盖不足，稳定需求场景中的短板';
  }

  // 规则 10: 低于行业水平（大差距）
  if (gap > 70) {
    return '低于行业平均水平，存在系统性提升空间';
  }

  // 规则 6: 高覆盖但还有改进空间
  if (coverageScore >= 70 && matchedIntentCount > 3) {
    return '当前覆盖较好，但用户需求增速超过覆盖提升速度';
  }

  // 兜底
  return `"${scenario.scenarioName}" 场景覆盖率为 ${coverageScore}%，存在 ${gap} 分的提升空间`;
}
