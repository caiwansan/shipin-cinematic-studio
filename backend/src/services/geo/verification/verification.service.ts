import { PrismaClient } from '@prisma/client';
import { VerificationEngine } from './verification-engine';
import type { VerificationRequest, CompareResult } from './verification.types';
import type { OptimizationExecutionDTO, VerificationResultDTO, VerificationHistoryDTO } from '../../../platform/contracts/verification.contract';

export class VerificationService {
  private engine: VerificationEngine;

  constructor(prisma: PrismaClient, engine?: VerificationEngine) {
    this.engine = engine || new VerificationEngine(prisma);
  }

  // Run verification
  async run(request: VerificationRequest): Promise<{ executionId: string; jobStatus: string }> {
    return this.engine.submit(request);
  }

  // Get execution details
  async getExecution(executionId: string): Promise<OptimizationExecutionDTO | null> {
    return this.engine.getRepository().getExecution(executionId);
  }

  // Get verification result
  async getResult(executionId: string): Promise<VerificationResultDTO | null> {
    return this.engine.getResult(executionId);
  }

  // Compare two executions
  async compare(beforeExecutionId: string, afterExecutionId: string): Promise<CompareResult | null> {
    return this.engine.compare(beforeExecutionId, afterExecutionId);
  }

  // Get history for a project
  async getHistory(projectId: string, limit = 20, offset = 0): Promise<VerificationHistoryDTO[]> {
    return this.engine.getHistory(projectId, limit, offset);
  }

  // Get job status
  async getJobStatus(executionId: string): Promise<string> {
    return this.engine.getJobStatus(executionId);
  }

  // List executions for a project
  async listExecutions(projectId: string, limit = 20, offset = 0): Promise<OptimizationExecutionDTO[]> {
    return this.engine.getRepository().listExecutions(projectId, limit, offset);
  }

  // Get repository for direct queries (used by route evidence endpoint)
  getRepository() {
    return this.engine.getRepository();
  }
}
