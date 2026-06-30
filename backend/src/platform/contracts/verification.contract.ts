// 验证执行 DTO
export interface OptimizationExecutionDTO {
  id: string;
  projectId: string;
  optimizationType: string;
  executionStatus: string;
  triggerSource: string;
  beforeSnapshotId?: string;
  afterSnapshotId?: string;
  verificationVersion?: string;
  geoScoreVersion?: string;
  verificationStatus?: string;
  beforeScore?: number;
  afterScore?: number;
  scoreDelta?: number;
  changedDimensions?: string[];
  beforeDimensions?: Record<string, any>;
  afterDimensions?: Record<string, any>;
  industry?: string;
  brandType?: string;
  startedAt: Date;
  completedAt?: Date;
  verifiedAt?: Date;
}

// 验证作业 DTO
export interface VerificationJobDTO {
  id: string;
  executionId: string;
  status: string;
  retryCount: number;
  maxRetries: number;
  lockedBy?: string;
  lockedAt?: Date;
  lastError?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// 验证结果 DTO
export interface VerificationResultDTO {
  id: string;
  projectId: string;
  executionId: string;
  isImprovement: boolean;
  deltaWhenVerified: number;
  verifiedAt: Date;
  rawEvidence?: Record<string, any>;
  details?: Record<string, any>;
}

// Compare 结果
export interface VerificationCompareDTO {
  beforeScore: number;
  afterScore: number;
  delta: number;
  beforeDimensions: Record<string, any>;
  afterDimensions: Record<string, any>;
  changedDimensions: string[];
  verificationVersion: string;
  geoScoreVersion: string;
}

// 历史记录
export interface VerificationHistoryDTO {
  execution: OptimizationExecutionDTO;
  delta: number;
  isImprovement: boolean;
  verifiedAt: Date;
}
