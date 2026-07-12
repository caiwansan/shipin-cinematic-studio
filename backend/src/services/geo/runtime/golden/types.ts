import type { ReplayRecord } from '../replay/types';

// Dataset 条目
export interface GoldenEntry {
  id: string;
  industry?: string;
  scenario: string;           // 场景 ID
  intent: string;              // 意图
  expectedBand: string;        // Excellent / Good / Fair / Weak / Poor
  expectedFindings: number;
  expectedConfidence: number;  // 0-1
  tags?: string[];
}

export interface EvaluationScenario {
  scenarioId: string;
  industry: string;
  intent: string;
  requirements: {
    minFindings: number;
    minConfidence: number;
    requiredEvidence: string[];
  };
}

// 评测结果
export interface EvaluationResult {
  replayId: string;
  replay: ReplayRecord;
  scenario: EvaluationScenario;
  passed: boolean;
  precision: number;
  recall: number;
  evidenceCoverage: number;
  bandAccuracy: number;
  confidence: number;
  errors: string[];
  timestamp: string;
}

// Gap 分析
export interface Gap {
  type: 'missing_evidence' | 'wrong_band' | 'missing_signal' | 'prompt_issue' | 'context_issue' | 'provider_limitation';
  description: string;
  severity: 'high' | 'medium' | 'low';
  affectedField?: string;
  suggestion?: string;
}
