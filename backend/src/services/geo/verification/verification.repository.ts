import { PrismaClient } from '@prisma/client';
import type { VerificationRepository } from '../../../platform/repository';
import type {
  OptimizationExecutionDTO,
  VerificationJobDTO,
  VerificationResultDTO,
  VerificationCompareDTO,
  VerificationHistoryDTO,
} from '../../../platform/contracts/verification.contract';

export class PrismaVerificationRepository implements VerificationRepository {
  constructor(private prisma: PrismaClient) {}

  async createExecution(data: Partial<OptimizationExecutionDTO>): Promise<OptimizationExecutionDTO> {
    const result = await this.prisma.optimizationExecution.create({
      data: {
        id: data.id,
        projectId: data.projectId!,
        optimizationType: data.optimizationType!,
        executionStatus: data.executionStatus || 'pending',
        triggerSource: data.triggerSource || 'manual',
        beforeSnapshotId: data.beforeSnapshotId,
        afterSnapshotId: data.afterSnapshotId,
        verificationVersion: data.verificationVersion,
        geoScoreVersion: data.geoScoreVersion,
        verificationStatus: data.verificationStatus,
        beforeScore: data.beforeScore,
        afterScore: data.afterScore,
        scoreDelta: data.scoreDelta,
        changedDimensions: data.changedDimensions || [],
        beforeDimensions: data.beforeDimensions || undefined,
        afterDimensions: data.afterDimensions || undefined,
        industry: data.industry,
        brandType: data.brandType,
        startedAt: data.startedAt || new Date(),
      },
    });
    return this.toOptimizationExecutionDTO(result);
  }

  async getExecution(id: string): Promise<OptimizationExecutionDTO | null> {
    const result = await this.prisma.optimizationExecution.findUnique({ where: { id } });
    return result ? this.toOptimizationExecutionDTO(result) : null;
  }

  async updateExecution(id: string, data: Partial<OptimizationExecutionDTO>): Promise<OptimizationExecutionDTO> {
    const result = await this.prisma.optimizationExecution.update({
      where: { id },
      data: {
        executionStatus: data.executionStatus,
        verificationStatus: data.verificationStatus,
        afterSnapshotId: data.afterSnapshotId,
        afterScore: data.afterScore,
        scoreDelta: data.scoreDelta,
        changedDimensions: data.changedDimensions || undefined,
        afterDimensions: data.afterDimensions || undefined,
        verificationVersion: data.verificationVersion,
        geoScoreVersion: data.geoScoreVersion,
        completedAt: data.completedAt,
        verifiedAt: data.verifiedAt,
      },
    });
    return this.toOptimizationExecutionDTO(result);
  }

  async listExecutions(projectId: string, limit = 20, offset = 0): Promise<OptimizationExecutionDTO[]> {
    const results = await this.prisma.optimizationExecution.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return results.map(r => this.toOptimizationExecutionDTO(r));
  }

  async createJob(data: Partial<VerificationJobDTO>): Promise<VerificationJobDTO> {
    const result = await this.prisma.verificationJob.create({
      data: {
        id: data.id,
        executionId: data.executionId!,
        status: data.status || 'pending',
        retryCount: data.retryCount || 0,
        maxRetries: data.maxRetries || 3,
        lockedBy: data.lockedBy,
        lockedAt: data.lockedAt,
        lastError: data.lastError,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
      },
    });
    return this.toVerificationJobDTO(result);
  }

  async getJob(id: string): Promise<VerificationJobDTO | null> {
    const result = await this.prisma.verificationJob.findUnique({ where: { id } });
    return result ? this.toVerificationJobDTO(result) : null;
  }

  async getJobByExecutionId(executionId: string): Promise<VerificationJobDTO | null> {
    const result = await this.prisma.verificationJob.findUnique({ where: { executionId } });
    return result ? this.toVerificationJobDTO(result) : null;
  }

  async updateJob(id: string, data: Partial<VerificationJobDTO>): Promise<VerificationJobDTO> {
    const result = await this.prisma.verificationJob.update({
      where: { id },
      data: {
        status: data.status,
        retryCount: data.retryCount,
        lockedBy: data.lockedBy,
        lockedAt: data.lockedAt,
        lastError: data.lastError,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
      },
    });
    return this.toVerificationJobDTO(result);
  }

  async createResult(data: Partial<VerificationResultDTO>): Promise<VerificationResultDTO> {
    const result = await this.prisma.verificationResult.create({
      data: {
        id: data.id,
        projectId: data.projectId!,
        executionId: data.executionId!,
        isImprovement: data.isImprovement!,
        deltaWhenVerified: data.deltaWhenVerified!,
        rawEvidence: data.rawEvidence || undefined,
        details: data.details || undefined,
      },
    });
    return this.toVerificationResultDTO(result);
  }

  async getResult(executionId: string): Promise<VerificationResultDTO | null> {
    const result = await this.prisma.verificationResult.findUnique({ where: { executionId } });
    return result ? this.toVerificationResultDTO(result) : null;
  }

  async findHistory(projectId: string, limit = 20, offset = 0): Promise<VerificationHistoryDTO[]> {
    const results = await this.prisma.verificationResult.findMany({
      where: { projectId },
      orderBy: { verifiedAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return Promise.all(results.map(async r => {
      const execution = await this.prisma.optimizationExecution.findUnique({ where: { id: r.executionId } });
      return {
        execution: execution ? this.toOptimizationExecutionDTO(execution) : null!,
        delta: r.deltaWhenVerified,
        isImprovement: r.isImprovement,
        verifiedAt: r.verifiedAt,
      };
    }));
  }

  async compare(beforeExecutionId: string, afterExecutionId: string): Promise<VerificationCompareDTO | null> {
    const before = await this.prisma.optimizationExecution.findUnique({ where: { id: beforeExecutionId } });
    const after = await this.prisma.optimizationExecution.findUnique({ where: { id: afterExecutionId } });
    if (!before || !after) return null;
    return {
      beforeScore: before.beforeScore || 0,
      afterScore: after.afterScore || 0,
      delta: after.scoreDelta || 0,
      beforeDimensions: before.beforeDimensions as Record<string, any> || {},
      afterDimensions: after.afterDimensions as Record<string, any> || {},
      changedDimensions: (after.changedDimensions as string[]) || [],
      verificationVersion: after.verificationVersion || 'unknown',
      geoScoreVersion: after.geoScoreVersion || 'unknown',
    };
  }

  // Private DTO converters
  private toOptimizationExecutionDTO(r: any): OptimizationExecutionDTO {
    return {
      id: r.id,
      projectId: r.projectId,
      optimizationType: r.optimizationType,
      executionStatus: r.executionStatus,
      triggerSource: r.triggerSource,
      beforeSnapshotId: r.beforeSnapshotId,
      afterSnapshotId: r.afterSnapshotId,
      verificationVersion: r.verificationVersion,
      geoScoreVersion: r.geoScoreVersion,
      verificationStatus: r.verificationStatus,
      beforeScore: r.beforeScore,
      afterScore: r.afterScore,
      scoreDelta: r.scoreDelta,
      changedDimensions: r.changedDimensions as string[],
      beforeDimensions: r.beforeDimensions as Record<string, any>,
      afterDimensions: r.afterDimensions as Record<string, any>,
      industry: r.industry,
      brandType: r.brandType,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      verifiedAt: r.verifiedAt,
    };
  }

  private toVerificationJobDTO(r: any): VerificationJobDTO {
    return {
      id: r.id,
      executionId: r.executionId,
      status: r.status,
      retryCount: r.retryCount,
      maxRetries: r.maxRetries,
      lockedBy: r.lockedBy,
      lockedAt: r.lockedAt,
      lastError: r.lastError,
      createdAt: r.createdAt,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
    };
  }

  private toVerificationResultDTO(r: any): VerificationResultDTO {
    return {
      id: r.id,
      projectId: r.projectId,
      executionId: r.executionId,
      isImprovement: r.isImprovement,
      deltaWhenVerified: r.deltaWhenVerified,
      verifiedAt: r.verifiedAt,
      rawEvidence: r.rawEvidence as Record<string, any>,
      details: r.details as Record<string, any>,
    };
  }
}
