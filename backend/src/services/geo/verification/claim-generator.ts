// ============================================================
// P0-T006: Claim Generator
// 根据 before/after/delta 自动生成 VerificationClaim[]
// ============================================================

import type { VerificationClaim } from './types';
import { generateClaimId, evidenceGradeToNumber } from './types';

interface BeforeAfterInput {
  adi: number;
  aiPresenceScore: number;
  visibilityCount: number;
  averageKnowledge: number;
  evidenceGrade: 'A' | 'B' | 'C' | 'D' | 'N/A';
}

interface DeltaInput {
  adi: number;
  aiPresenceScore: number;
  visibilityCount: number;
  averageKnowledge: number;
  evidenceGradeDelta: number;
}

/**
 * 生成 claims 列表
 * - 每项 delta ≠ 0 生成一个 claim
 * - delta > 0 → type = 'improvement'
 * - delta < 0 → type = 'regression'
 * - delta = 0 → type = 'unchanged'
 * - 根据证据数量计算 confidence
 */
export function generateClaims(
  before: BeforeAfterInput,
  after: BeforeAfterInput,
  delta: DeltaInput,
  evidenceIdMap?: Record<string, string[]>
): VerificationClaim[] {
  const claims: VerificationClaim[] = [];

  // ── ADI Claim ──
  claims.push(createClaim('ADI', before.adi, after.adi, delta.adi, evidenceIdMap));

  // ── AI Presence Score Claim ──
  claims.push(createClaim('AI Presence Score', before.aiPresenceScore, after.aiPresenceScore, delta.aiPresenceScore, evidenceIdMap));

  // ── Visibility Count ──
  const visDelta = after.visibilityCount - before.visibilityCount;
  claims.push(createClaim('Visibility Count', before.visibilityCount, after.visibilityCount, visDelta, evidenceIdMap));

  // ── Average Knowledge ──
  claims.push(createClaim('Knowledge Quality', before.averageKnowledge, after.averageKnowledge, delta.averageKnowledge, evidenceIdMap));

  // ── Evidence Grade Claim ──
  const beforeGradeNum = evidenceGradeToNumber(before.evidenceGrade);
  const afterGradeNum = evidenceGradeToNumber(after.evidenceGrade);
  const gradeDelta = afterGradeNum - beforeGradeNum;
  if (gradeDelta !== 0) {
    claims.push(createClaim('Evidence Grade', beforeGradeNum, afterGradeNum, gradeDelta, evidenceIdMap, `${after.evidenceGrade} (${gradeDelta > 0 ? '+' : ''}${gradeDelta} level)`));
  }

  return claims;
}

function createClaim(
  metric: string,
  beforeValue: number,
  afterValue: number,
  rawDelta: number,
  evidenceIdMap?: Record<string, string[]>,
  customSummary?: string
): VerificationClaim {
  const delta = rawDelta;
  let type: 'improvement' | 'regression' | 'unchanged';
  if (delta > 0) type = 'improvement';
  else if (delta < 0) type = 'regression';
  else type = 'unchanged';

  const sign = delta > 0 ? '+' : '';
  const summary = customSummary || `${metric} ${sign}${delta}`;

  // 计算 confidence: 如果有 evidence 引用则更高
  const evidenceIds = evidenceIdMap?.[metric.toLowerCase()] || [];
  const baseConfidence = delta !== 0 ? 70 : 95;
  const evidenceBonus = Math.min(25, evidenceIds.length * 5);
  const confidence = Math.min(100, baseConfidence + evidenceBonus);

  return {
    id: generateClaimId(),
    type,
    metric,
    beforeValue,
    afterValue,
    delta,
    summary,
    evidence: evidenceIds,
    confidence,
  };
}
