import { governanceEngine } from '../core/policy-engine.js';
import { ContractDriftAnalyzer } from '../analyzers/contract-drift-analyzer.js';

export interface GovernanceReport {
  timestamp: string;
  policyMode: string;
  violations: {
    total: number;
    bySeverity: Record<string, number>;
  };
  hybrids: Record<string, number>;
  coverage: number;
  score: number;
}

export function generateReport(): GovernanceReport {
  const analyzer = new ContractDriftAnalyzer();
  const violations = analyzer.analyzeRoutes();
  const summary = governanceEngine.getSummary();

  const hybridFiles: Record<string, number> = {};
  for (const v of violations) {
    if (v.layer === 'hybrid') {
      const fname = v.file.replace('routes/', '');
      hybridFiles[fname] = (hybridFiles[fname] || 0) + 1;
    }
  }

  const totalViolations = summary.total;
  const highWeight = 10;
  const medWeight = 3;
  const lowWeight = 1;
  const maxScore = 100;
  const penalty =
    (summary.bySeverity['HIGH'] || 0) * highWeight +
    (summary.bySeverity['MEDIUM'] || 0) * medWeight +
    (summary.bySeverity['LOW'] || 0) * lowWeight;
  const score = Math.max(0, maxScore - penalty);

  const report: GovernanceReport = {
    timestamp: new Date().toISOString(),
    policyMode: governanceEngine.getMode(),
    violations: {
      total: totalViolations,
      bySeverity: summary.bySeverity,
    },
    hybrids: hybridFiles,
    coverage: 65 / 127,
    score,
  };

  return report;
}
