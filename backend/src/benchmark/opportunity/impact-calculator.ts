/**
 * Impact Calculator — Expected ADI Gain 计算
 *
 * P0-T006 — Opportunity Engine (First Edition)
 *
 * 纯规则引擎，无 AI 调用。
 */

import { Priority } from './priority-rules';

/**
 * 计算 Expected ADI Gain
 *
 * 规则（≥3 条）：
 * 1. 基线：gap × 0.15
 * 2. 如果 priority = high：baseline × 1.5
 * 3. 如果 effort = easy：baseline × 1.2
 */
export function calculateExpectedAdiGain(
  gap: number,
  priority: Priority,
  effort: 'easy' | 'medium' | 'hard',
): number {
  // 规则 1: 基线 = gap × 0.15
  let gain = gap * 0.15;

  // 规则 2: priority = high → ×1.5
  if (priority === 'high') {
    gain *= 1.5;
  }

  // 规则 3: effort = easy → ×1.2
  if (effort === 'easy') {
    gain *= 1.2;
  }

  // 保留一位小数
  return Math.round(gain * 10) / 10;
}
