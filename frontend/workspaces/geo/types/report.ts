/**
 * Deliverable Report — Frontend Type Definitions
 *
 * Mirrors backend/src/benchmark/deliverable/types.ts
 */

export interface ExecutiveSummary {
  currentAdi: number;
  adiChange: number;
  completionRate: number;
  topOpportunities: number;
  overallHealth: 'good' | 'fair' | 'poor';
  confidence: number;
}

export interface ScenarioScore {
  name: string;
  score: number;
  trend: string;
}

export interface Findings {
  industry: string;
  entityName: string;
  coverageCount: number;
  totalScenarios: number;
  topScenarios: ScenarioScore[];
  bottomScenarios: ScenarioScore[];
}

export interface OpportunityItem {
  scenarioId: string;
  scenarioName: string;
  gap: number;
  priority: string;
  expectedAdiGain: number;
  suggestion: string;
}

export interface Opportunities {
  high: number;
  medium: number;
  low: number;
  totalExpectedGain: number;
  items: OpportunityItem[];
}

export interface ActionItem {
  title: string;
  status: string;
  expectedImpact: number;
  actualImpact: number | null;
}

export interface Actions {
  total: number;
  completed: number;
  inProgress: number;
  skipped: number;
  pending: number;
  estimatedGain: number;
  actualGain: number;
  items: ActionItem[];
}

export interface BreakdownItem {
  label: string;
  contribution: number;
}

export interface RemainingIssue {
  scenario: string;
  gap: number;
  priority: string;
}

export interface Verification {
  beforeAdi: number;
  afterAdi: number;
  deltaAdi: number;
  improvementRate: number;
  breakdown: BreakdownItem[];
  remainingIssues: RemainingIssue[];
}

export interface RecommendationItem {
  scenarioId: string;
  scenarioName: string;
  gap: number;
  priority: string;
  expectedAdiGain: number;
}

export interface DeliverableReport {
  id: string;
  projectId: string;
  projectName: string;
  generatedAt: string;
  executiveSummary: ExecutiveSummary;
  findings: Findings;
  opportunities: Opportunities;
  actions: Actions;
  verification: Verification | null;
  nextRecommendations: RecommendationItem[];
}
