import type { ReplayRecord } from '../../../runtime/replay/types';
import type { GoldenEntry, Gap, EvaluationScenario } from '../../../runtime/golden/types';
import type { EvaluationReport, EvaluationScores, BandLevel, DimensionScore, Explainability, CalibrationCandidate } from './types';
import { goldenDataset } from '../../../runtime/golden/dataset-loader';
import { resolveScenario } from '../../../runtime/golden/scenario-resolver';
import { evidenceRegistry } from './evidence/evidence-registry';
import { evaluateEvidenceQuality } from './evidence/evidence-quality-engine';

function generateReportId(): string {
  return `eval_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// 分数 → Band
function scoreToBand(score: number): BandLevel {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Weak';
  return 'Poor';
}

// 计算覆盖率分数
function calcCoverage(replay: ReplayRecord, golden: GoldenEntry): { score: number; gaps: Gap[] } {
  const gaps: Gap[] = [];
  const findingCount = replay.result.findings.length;
  const expectedCount = golden.expectedFindings;

  let score = 100;
  if (findingCount < expectedCount) {
    score = Math.max(0, (findingCount / expectedCount) * 100);
    gaps.push({
      type: 'missing_evidence',
      description: `预期 ${expectedCount} 条发现，实际 ${findingCount} 条`,
      severity: findingCount === 0 ? 'high' : 'medium',
      affectedField: 'findings',
      suggestion: `增强 Prompt 以覆盖更多发现维度`,
    });
  }
  return { score: Math.round(score), gaps };
}

// 可配置的置信度容忍阈值（后续可改为配置文件加载）
const CONFIDENCE_TOLERANCE = 0.10;

// 计算置信度分数（带噪声容忍区间）
function calcConfidence(replay: ReplayRecord, golden: GoldenEntry): { score: number; gaps: Gap[] } {
  const gaps: Gap[] = [];
  const actualConfidence = replay.result.confidence;
  const expectedConfidence = golden.expectedConfidence;

  let score = 100;

  // 计算绝对偏差
  const deviation = Math.abs(actualConfidence - expectedConfidence);

  // 如果在容忍区间内 → 不扣分，不产生 Gap
  if (deviation <= CONFIDENCE_TOLERANCE) {
    return { score: 100, gaps: [] };
  }

  // 超出容忍区间 → 按比例扣分
  const ratio = Math.min(actualConfidence, expectedConfidence) / Math.max(actualConfidence, expectedConfidence);
  score = Math.max(0, Math.round(ratio * 100));

  gaps.push({
    type: 'wrong_band',
    description: `置信度偏差 ${(deviation * 100).toFixed(0)}% 超出容忍区间 ±${(CONFIDENCE_TOLERANCE * 100).toFixed(0)}%。模型输出 ${(actualConfidence * 100).toFixed(0)}%，Expected ${(expectedConfidence * 100).toFixed(0)}%`,
    severity: deviation > 0.25 ? 'high' : 'medium',
    affectedField: 'confidence',
    suggestion: actualConfidence < expectedConfidence
      ? '提供更多高质量的知识源以提升置信度'
      : '模型过于自信，需增加约束条件',
  });

  return { score, gaps };
}

// 计算证据质量（五维模型）
function calcEvidenceQuality(replay: ReplayRecord): { score: number; gaps: Gap[] } {
  const gaps: Gap[] = [];

  // 将 evidence 注册到 Registry
  const evidenceEntries = (replay.result.evidence || []).map((e) => {
    return evidenceRegistry.register({
      provider: replay.provider,
      source: e.source || 'unknown',
      content: (e as any).content || e.text || '',
      confidence: (e as any).confidence || 0.5,
      capturedAt: (e as any).accessedAt || replay.timestamp || new Date().toISOString(),
      snapshotVersion: replay.snapshotVersion,
      knowledgeVersion: (replay as any).knowledgeVersion,
      replayIds: [replay.replayId],
    });
  });

  // 使用 Quality 引擎评分（五维模型）
  const quality = evaluateEvidenceQuality(evidenceEntries);

  if (quality.scores.overall < 60) {
    gaps.push({
      type: 'missing_evidence',
      description: `证据质量评分 ${quality.scores.overall}/100: ${quality.explainability.recommendations.slice(0, 2).join('; ')}`,
      severity: quality.scores.overall < 40 ? 'high' : 'medium',
      affectedField: 'evidence',
      suggestion: quality.explainability.recommendations[0] || '改进证据质量',
    });
  }

  return { score: quality.scores.overall, gaps };
}

// 主要评估函数
export async function evaluateReplay(replay: ReplayRecord): Promise<EvaluationReport> {
  // 1. 关联 Golden Dataset
  const allEntries = goldenDataset.getAll();
  const scenario = resolveScenario(replay);
  const entry = allEntries.find(e => e.scenario === scenario.scenarioId) || allEntries[0] || {
    id: 'default',
    scenario: 'general',
    intent: 'general_qa',
    expectedBand: 'Good',
    expectedFindings: 2,
    expectedConfidence: 0.5,
  };

  // 2. 各维度评分
  const coverageResult = calcCoverage(replay, entry);
  const confidenceResult = calcConfidence(replay, entry);
  const evidenceResult = calcEvidenceQuality(replay);

  // 3. 聚合
  const gaps: Gap[] = [
    ...coverageResult.gaps,
    ...confidenceResult.gaps,
    ...evidenceResult.gaps,
  ];

  const dimensions: DimensionScore[] = [
    { category: 'coverage', score: coverageResult.score, weight: 0.25 },
    { category: 'evidence_quality', score: evidenceResult.score, weight: 0.20 },
    { category: 'knowledge_recall', score: replay.result.findings.length > 0 ? 60 : 20, weight: 0.15 },
    { category: 'entity_accuracy', score: entry.expectedConfidence > 0.5 ? 70 : 30, weight: 0.10 },
    { category: 'recommendation_quality', score: 50, weight: 0.10 },
    { category: 'hallucination', score: 90, weight: 0.05 },
    { category: 'citation_quality', score: replay.result.citations.length > 0 ? 80 : 20, weight: 0.05 },
    { category: 'structure_completeness', score: 80, weight: 0.05 },
    { category: 'consistency', score: 70, weight: 0.05 },
  ];

  // 加权总分
  const overall = Math.round(
    dimensions.reduce((sum, d) => sum + (d.score * d.weight), 0) /
    dimensions.reduce((sum, d) => sum + d.weight, 0)
  );

  const scores = {
    overall,
    coverage: coverageResult.score,
    evidence: evidenceResult.score,
    knowledge: replay.result.findings.length > 0 ? 60 : 20,
    entity: entry.expectedConfidence > 0.5 ? 70 : 30,
    recommendation: 50,
    hallucination: 90,
    citation: replay.result.citations.length > 0 ? 80 : 20,
    completeness: 80,
    consistency: 70,
    dimensions,
  };

  const band = scoreToBand(overall);

  // 4. Explainability
  const explainability: Explainability[] = gaps.map(g => ({
    category: g.type,
    expected: g.suggestion ? `预期: 高质量结果` : '预期: 完美结果',
    actual: g.description,
    reason: g.description,
    impact: g.severity,
    fixRecommendation: g.suggestion || '优化 Provider 策略',
  }));

  // 5. Calibration Candidates
  const calibrationCandidates: CalibrationCandidate[] = gaps.map(g => ({
    provider: replay.provider,
    scenario: entry.scenario,
    intent: entry.intent,
    gap: g,
    severity: g.severity,
    recommendation: g.suggestion || '无自动建议',
    suggestedAction: g.type === 'missing_evidence' ? 'adjust_prompt' :
                     g.type === 'wrong_band' ? 'add_knowledge' :
                     g.type === 'missing_signal' ? 'adjust_prompt' :
                     'change_provider',
  }));

  return {
    reportId: generateReportId(),
    replayId: replay.replayId,
    goldenEntry: entry,
    evaluatedAt: new Date().toISOString(),
    scores,
    band,
    gaps,
    explainability,
    calibrationCandidates,
    raw: { golden: entry, replay },
  };
}
