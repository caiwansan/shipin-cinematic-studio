import type {
  OptimizationExecutionDTO,
  VerificationJobDTO,
  VerificationResultDTO,
  VerificationCompareDTO,
  VerificationHistoryDTO,
} from '../contracts/verification.contract';
import type { PublishingRecordDTO } from '../contracts/publishing.contract';
import type { GrowthMemoryDTO, LearningSignalDTO, GrowthKnowledgeDTO } from '../contracts/growth.contract';

// ========== Verification Repository Interface ==========
export interface VerificationRepository {
  createExecution(data: Partial<OptimizationExecutionDTO>): Promise<OptimizationExecutionDTO>;
  getExecution(id: string): Promise<OptimizationExecutionDTO | null>;
  updateExecution(id: string, data: Partial<OptimizationExecutionDTO>): Promise<OptimizationExecutionDTO>;
  listExecutions(projectId: string, limit?: number, offset?: number): Promise<OptimizationExecutionDTO[]>;

  createJob(data: Partial<VerificationJobDTO>): Promise<VerificationJobDTO>;
  getJob(id: string): Promise<VerificationJobDTO | null>;
  getJobByExecutionId(executionId: string): Promise<VerificationJobDTO | null>;
  updateJob(id: string, data: Partial<VerificationJobDTO>): Promise<VerificationJobDTO>;

  createResult(data: Partial<VerificationResultDTO>): Promise<VerificationResultDTO>;
  getResult(executionId: string): Promise<VerificationResultDTO | null>;
  findHistory(projectId: string, limit?: number, offset?: number): Promise<VerificationHistoryDTO[]>;

  compare(beforeExecutionId: string, afterExecutionId: string): Promise<VerificationCompareDTO | null>;
}

// ========== Publishing Repository Interface ==========
export interface PublishingRepository {
  createRecord(data: Partial<PublishingRecordDTO>): Promise<PublishingRecordDTO>;
  getRecord(id: string): Promise<PublishingRecordDTO | null>;
  updateRecord(id: string, data: Partial<PublishingRecordDTO>): Promise<PublishingRecordDTO>;
  listRecords(projectId: string, limit?: number, offset?: number): Promise<PublishingRecordDTO[]>;
  getLatestByPlatform(projectId: string, platform: string): Promise<PublishingRecordDTO | null>;
}

// ========== Growth Repository Interface ==========
export interface GrowthRepository {
  getMemory(industry: string, brandType: string | undefined, optimizationType: string): Promise<GrowthMemoryDTO | null>;
  upsertMemory(data: Partial<GrowthMemoryDTO> & { industry: string; optimizationType: string }): Promise<GrowthMemoryDTO>;
  listMemories(industry?: string, limit?: number): Promise<GrowthMemoryDTO[]>;

  createSignal(data: Partial<LearningSignalDTO>): Promise<LearningSignalDTO>;
  listSignals(industry?: string, optimizationType?: string, limit?: number): Promise<LearningSignalDTO[]>;

  createKnowledge(data: Partial<GrowthKnowledgeDTO>): Promise<GrowthKnowledgeDTO>;
  listKnowledge(industry?: string, optimizationType?: string, limit?: number): Promise<GrowthKnowledgeDTO[]>;
}
