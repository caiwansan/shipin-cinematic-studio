import type { ReplayRecord } from '../replay/types';
import type { EvaluationScenario } from './types';
import { goldenDataset } from './dataset-loader';

function extractIndustry(replay: ReplayRecord): string {
  // 从 Replay 的 findings 中提取 industry 信息
  const industryKeywords = ['AI', 'SaaS', 'E-commerce', 'Finance', 'Healthcare', 'Education', 'Entertainment'];
  for (const finding of replay.result.findings) {
    for (const keyword of industryKeywords) {
      if (finding.description.includes(keyword)) {
        return keyword;
      }
    }
  }
  return 'General';
}

export function resolveScenario(replay: ReplayRecord): EvaluationScenario {
  const industry = extractIndustry(replay);
  const datasetEntries = goldenDataset.getByIndustry(industry);

  // 如果没有匹配条目，用 General
  const entries = datasetEntries.length > 0 ? datasetEntries : goldenDataset.getAll();
  const entry = entries.length > 0 ? entries[0] : {
    id: 'default',
    scenario: 'general',
    intent: 'general_qa',
    expectedBand: 'Good',
    expectedFindings: 2,
    expectedConfidence: 0.5,
  };

  return {
    scenarioId: entry.scenario,
    industry,
    intent: entry.intent,
    requirements: {
      minFindings: entry.expectedFindings,
      minConfidence: entry.expectedConfidence,
      requiredEvidence: [],
    },
  };
}
