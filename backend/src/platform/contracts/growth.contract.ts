export interface GrowthMemoryDTO {
  id: string;
  industry: string;
  brandType?: string;
  optimizationType: string;
  totalExecutions: number;
  successfulCount: number;
  failedCount: number;
  noChangeCount: number;
  totalDelta: number;
  averageDelta: number;
  successRate: number;
  sampleSize: number;
  confidence: string;
  aggregationVersion: string;
  lastUpdated: Date;
}

export interface LearningSignalDTO {
  id: string;
  source: string;
  signalType: string;
  originalValue: number;
  normalizedValue: number;
  weight: number;
  weightedValue: number;
  industry?: string;
  optimizationType?: string;
  reason?: string;
  executionId?: string;
  generatedAt: Date;
}

export interface GrowthKnowledgeDTO {
  id: string;
  industry: string;
  brandType?: string;
  optimizationType: string;
  insight: string;
  bestPractice?: string;
  commonFailure?: string;
  source?: string;
  sampleSize: number;
  averageDelta: number;
  createdAt: Date;
}
