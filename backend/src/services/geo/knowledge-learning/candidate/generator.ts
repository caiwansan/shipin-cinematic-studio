// ============================================================
// Candidate Generator — 自动判断 Replay → Candidate
// GEO-RC3 Epic B2: Production Replay Learning
// ============================================================

import type { ReplayCandidate } from '../types';
import { candidateStore } from './store';
import { replayStore } from '../../runtime/replay/store';
import { DEFAULT_CANDIDATE_THRESHOLDS } from '../types';
import type { CandidateThresholds } from '../types';

// 当前使用的阈值（可通过 setThresholds 覆盖）
let currentThresholds: CandidateThresholds = { ...DEFAULT_CANDIDATE_THRESHOLDS };

/**
 * 设置自定义阈值（可用于外部配置覆盖）
 */
export function setCandidateThresholds(thresholds: Partial<CandidateThresholds>): void {
  currentThresholds = { ...currentThresholds, ...thresholds };
}

/**
 * 重置为默认阈值
 */
export function resetCandidateThresholds(): void {
  currentThresholds = { ...DEFAULT_CANDIDATE_THRESHOLDS };
}

/**
 * 获取当前阈值配置
 */
export function getCandidateThresholds(): CandidateThresholds {
  return { ...currentThresholds };
}

/**
 * 判断 Replay 结果是否需要转为 Candidate。
 * 符合阈值条件则自动创建 Candidate 记录并返回。
 *
 * @param replayId - Replay 记录 ID
 * @param evaluationResult - Evaluation Engine 给出的评测结果
 * @returns 创建的 Candidate 或 null（不符合条件）
 */
export function generateCandidate(
  replayId: string,
  evaluationResult: {
    overall: number;
    band: string;
    confidence: number;
    evidenceScore: number;
    gaps: any[];
  }
): ReplayCandidate | null {
  const { overall, band, confidence, evidenceScore } = evaluationResult;

  // 候选资格判断
  if (overall < currentThresholds.minScore) {
    return null;  // 低分不转为 Candidate
  }
  if (confidence < currentThresholds.minConfidence) {
    return null;  // 置信度太低不转
  }
  if (evidenceScore < currentThresholds.minEvidenceScore) {
    return null;  // 证据质量低不转
  }

  // 获取 Replay 记录获取 provider 信息
  const replay = replayStore.get(replayId);
  if (!replay) return null;

  // 构建 reason
  const reasons: string[] = [];
  if (overall >= 80) reasons.push(`高质量输出 (${overall}/100)`);
  if (confidence >= 0.8) reasons.push('置信度充足');
  if (evidenceScore >= 70) reasons.push('证据质量优良');

  // 自动识别分类（从 replay context 中提取）
  const categories: string[] = ['general'];
  if (overall >= 80) categories.push('high_quality');
  if ((evaluationResult.gaps?.length || 0) === 0) categories.push('zero_gap');

  const candidate: Omit<ReplayCandidate, 'candidateId' | 'createdAt' | 'updatedAt'> = {
    replayId,
    provider: replay.provider,
    providerVersion: replay.model || 'default',
    score: overall,
    band,
    confidence,
    evidenceScore,
    status: 'new',
    reason: reasons.join('；'),
    categories,
    meta: {
      gapCount: evaluationResult.gaps?.length || 0,
      gaps: evaluationResult.gaps || [],
      snapshotHash: replay.snapshotHash,
    },
  };

  return candidateStore.create(candidate);
}
