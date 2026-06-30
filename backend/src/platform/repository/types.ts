// Domain types only — no Prisma imports
import type {
  OptimizationExecutionDTO,
  VerificationJobDTO,
  VerificationResultDTO,
} from '../contracts/verification.contract';
import type {
  PublishingRecordDTO,
} from '../contracts/publishing.contract';
import type {
  GrowthMemoryDTO,
  LearningSignalDTO,
  GrowthKnowledgeDTO,
} from '../contracts/growth.contract';

// Re-export to avoid confusion
export type VerOptimizationExecution = OptimizationExecutionDTO;
export type VerJob = VerificationJobDTO;
export type VerResult = VerificationResultDTO;
export type PubRecord = PublishingRecordDTO;
export type GrowMemory = GrowthMemoryDTO;
export type LearnSignal = LearningSignalDTO;
export type GrowKnowledge = GrowthKnowledgeDTO;
