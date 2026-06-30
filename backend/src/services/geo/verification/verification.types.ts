import type { OptimizationExecutionDTO, VerificationJobDTO, VerificationResultDTO, VerificationCompareDTO, VerificationHistoryDTO } from '../../../platform/contracts/verification.contract';

// Job status enum
export const JobStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRYING: 'retrying',
  CANCELLED: 'cancelled',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

// Trigger source
export const TriggerSource = {
  MANUAL: 'manual',
  EXECUTOR: 'executor',
  MONITOR: 'monitor',
  SCHEDULER: 'scheduler',
  API: 'api',
} as const;
export type TriggerSource = (typeof TriggerSource)[keyof typeof TriggerSource];

// Verification status
export const VerificationStatus = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const;
export type VerificationStatus = (typeof VerificationStatus)[keyof typeof VerificationStatus];

// Confidence levels
export const Confidence = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;
export type Confidence = (typeof Confidence)[keyof typeof Confidence];

// Verification context
export interface VerificationContext {
  executionId: string;
  projectId: string;
  optimizationType: string;
  triggerSource: string;
  beforeSnapshotId?: string;
  beforeScore?: number;
  beforeDimensions?: Record<string, any>;
  verificationVersion: string;
  geoScoreVersion: string;
  policyVersion: string;
}

// Verification request
export interface VerificationRequest {
  executionId: string;
  projectId: string;
  optimizationType: string;
  triggerSource?: string;
}

// Verification evidence
export interface EvidenceRecord {
  dimension: string;
  before: number;
  after: number;
  delta: number;
  status: 'improved' | 'declined' | 'unchanged';
  confidence: string;
  reason?: string;
}

// Compare result
export interface CompareResult {
  beforeExecutionId: string;
  afterExecutionId: string;
  beforeScore: number;
  afterScore: number;
  delta: number;
  beforeDimensions: Record<string, any>;
  afterDimensions: Record<string, any>;
  changedDimensions: string[];
  evidence: EvidenceRecord[];
  verificationVersion: string;
  geoScoreVersion: string;
}

// Job runner interface
export interface VerificationJobRunner {
  enqueue(executionId: string): Promise<{ executionId: string; status: string }>;
  cancel(executionId: string): Promise<void>;
  retry(executionId: string): Promise<{ executionId: string; status: string }>;
  resume(executionId: string): Promise<{ executionId: string; status: string }>;
  getStatus(executionId: string): Promise<string>;
}

// Re-export DTOs for convenience
export type {
  OptimizationExecutionDTO,
  VerificationJobDTO,
  VerificationResultDTO,
  VerificationCompareDTO,
  VerificationHistoryDTO,
};
