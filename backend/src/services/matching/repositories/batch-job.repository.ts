/**
 * BatchJob Repository
 * 职责：批量匹配执行记录的 CRUD
 * 数据性质：Execution Record（非 Business Fact）
 */

import { prisma } from '../../../utils';
import { randomUUID } from 'crypto';

// ============================================================
// Types
// ============================================================

export interface CreateBatchJobInput {
  enterpriseId: string;
  jobRequirementId: string;
  threshold?: number;
  maxResults?: number;
  rankingVersion?: string;
}

export interface BatchJobDTO {
  id: string;
  enterpriseId: string;
  jobRequirementId: string;
  status: string;
  totalCandidates: number;
  processedCount: number;
  matchedCount: number;
  threshold: number;
  maxResults: number;
  rankingVersion: string;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Repository
// ============================================================

export const batchJobRepository = {

  async create(input: CreateBatchJobInput): Promise<BatchJobDTO> {
    const id = randomUUID();
    const job = await prisma.batchJob.create({
      data: {
        id,
        enterpriseId: input.enterpriseId,
        jobRequirementId: input.jobRequirementId,
        status: 'PENDING',
        threshold: input.threshold ?? 60,
        maxResults: input.maxResults ?? 20,
        rankingVersion: input.rankingVersion ?? 'v1',
      },
    });
    return job as BatchJobDTO;
  },

  async findById(id: string): Promise<BatchJobDTO | null> {
    const job = await prisma.batchJob.findUnique({
      where: { id },
    });
    return job as BatchJobDTO | null;
  },

  async findByEnterprise(enterpriseId: string): Promise<BatchJobDTO[]> {
    const jobs = await prisma.batchJob.findMany({
      where: { enterpriseId },
      orderBy: { createdAt: 'desc' },
    });
    return jobs as BatchJobDTO[];
  },

  async findByJobRequirement(jobRequirementId: string): Promise<BatchJobDTO[]> {
    const jobs = await prisma.batchJob.findMany({
      where: { jobRequirementId },
      orderBy: { createdAt: 'desc' },
    });
    return jobs as BatchJobDTO[];
  },

  async updateStatus(
    id: string,
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED',
    extra?: {
      totalCandidates?: number;
      processedCount?: number;
      matchedCount?: number;
      errorMessage?: string;
      startedAt?: Date;
      completedAt?: Date;
    },
  ): Promise<BatchJobDTO | null> {
    const job = await prisma.batchJob.update({
      where: { id },
      data: {
        status,
        ...extra,
      },
    });
    return job as BatchJobDTO | null;
  },

  async delete(id: string): Promise<void> {
    await prisma.batchJob.delete({
      where: { id },
    });
  },
};
