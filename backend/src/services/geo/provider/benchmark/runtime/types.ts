import type { ReplayRecord } from '../../../runtime/replay/types';
import type { GoldenEntry, Gap } from '../../../runtime/golden/types';

// ── 评估分数类型 ──
export type ScoreCategory = 'coverage' | 'evidence_quality' | 'knowledge_recall' | 'entity_accuracy' | 'recommendation_quality' | 'hallucination' | 'citation_quality' | 'structure_completeness' | 'consistency';

export type BandLevel = 'Excellent' | 'Good' | 'Fair' | 'Weak' | 'Poor';

// ── 多维评分 ──
export interface DimensionScore {
  category: ScoreCategory;
  score: number;         // 0-100
  weight: number;        // 0-1，总分加权用
}

export interface EvaluationScores {
  overall: number;       // 0-100
  coverage: number;
  evidence: number;
  knowledge: number;
  entity: number;
  recommendation: number;
  hallucination: number;
  citation: number;
  completeness: number;
  consistency: number;
  dimensions: DimensionScore[];
}

// ── 扣分解释 ──
export interface Explainability {
  category: string;
  expected: string;
  actual: string;
  reason: string;
  impact: 'high' | 'medium' | 'low';
  fixRecommendation: string;
}

// ── Calibration Candidate ──
export interface CalibrationCandidate {
  provider: string;
  scenario: string;
  intent: string;
  gap: Gap;
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
  suggestedAction: 'adjust_prompt' | 'add_knowledge' | 'update_dataset' | 'change_provider';
}

// ── 完整评估报告 ──
export interface EvaluationReport {
  reportId: string;
  replayId: string;
  goldenEntry: GoldenEntry;
  evaluatedAt: string;
  scores: EvaluationScores;
  band: BandLevel;
  gaps: Gap[];
  explainability: Explainability[];
  calibrationCandidates: CalibrationCandidate[];
  raw: {
    golden: GoldenEntry;
    replay: ReplayRecord;
  };
}

// ── 批量评估结果 ──
export interface BatchEvaluationResult {
  totalReplays: number;
  evaluated: number;
  skipped: number;
  reports: EvaluationReport[];
  summary: {
    averageOverall: number;
    bandDistribution: Record<BandLevel, number>;
    topGaps: { type: string; count: number }[];
  };
}
