/**
 * BatchMatchingService — 批量匹配编排引擎
 *
 * 职责：编排 P4-01 匹配引擎，执行批量候选人匹配 + 排名 + 持久化
 * 设计原则：
 *   - 不复制 P4-01 Score 逻辑 — 只调用
 *   - 只负责编排：加载候选人池 → 逐人匹配 → 排名 → 写回
 *   - 单条匹配失败不中断整体流程
 *
 * ⚠️ Batch Matching ≠ Matching。Batch 是编排，Matching 是计算。
 */

import { prisma } from '../../../utils/index.js';
import { talentMatchingService, JobRequirementData } from './talent-matching.service.js';
import { rankingService } from './ranking.service.js';
import { batchJobRepository } from '../repositories/batch-job.repository.js';
import { talentMatchResultRepository } from '../repositories/talent-match-result.repository.js';

// ============================================================
// Types
// ============================================================

export interface BatchMatchInput {
  enterpriseId: string;
  jobRequirementId: string;
  threshold?: number;
  maxResults?: number;
  filters?: {
    location?: string;
    minEducation?: string;
  };
}

export interface BatchMatchResult {
  batchId: string;
  status: 'COMPLETED' | 'FAILED';
  totalCandidates: number;
  processedCount: number;
  matchedCount: number;
  results: RankedMatchResult[];
  errorMessage?: string;
}

export interface RankedMatchResult {
  rank: number;
  matchResultId: string;
  candidateId: string;
  profileId: string;
  matchScore: number;
  rankingScore: number;
  rankingVersion: string;
  breakdown: {
    matchScore: number;
    evidenceConfidence: number;
    freshness: number;
  };
  matchedSkills: any[];
  missingSkills: any[];
}

// ============================================================
// Constants
// ============================================================

const V1_CANDIDATE_LIMIT = 100; // V1 同步执行上限

// ============================================================
// Batch Matching Service
// ============================================================

export const batchMatchingService = {

  /**
   * 执行批量匹配流程
   * 1. 创建 BatchJob 记录
   * 2. 加载岗位要求
   * 3. 加载候选人池
   * 4. 逐人调用 P4-01 匹配
   * 5. 执行排名
   * 6. 写回结果
   */
  async executeBatch(input: BatchMatchInput): Promise<BatchMatchResult> {
    const { enterpriseId, jobRequirementId, threshold = 60, maxResults = 20, filters } = input;

    // Step 1: 创建 BatchJob
    const batchJob = await batchJobRepository.create({
      enterpriseId,
      jobRequirementId,
      threshold,
      maxResults,
      rankingVersion: rankingService.getVersion(),
    });

    try {
      // Step 2: 校验岗位要求
      const requirement = await prisma.jobRequirementProfile.findUnique({
        where: { id: jobRequirementId },
      });
      if (!requirement) {
        throw new Error(`JobRequirement ${jobRequirementId} not found`);
      }
      if (requirement.status !== 'active' && requirement.status !== 'ai_extracted' && requirement.status !== 'validated') {
        throw new Error(`JobRequirement status=${requirement.status}, must be active/ai_extracted/validated`);
      }

      // Step 3: 加载候选人池
      const candidatePool = await this.loadCandidatePool(filters);
      if (candidatePool.length === 0) {
        await batchJobRepository.updateStatus(batchJob.id, 'COMPLETED', {
          totalCandidates: 0,
          processedCount: 0,
          matchedCount: 0,
          startedAt: new Date(),
          completedAt: new Date(),
        });
        return {
          batchId: batchJob.id,
          status: 'COMPLETED',
          totalCandidates: 0,
          processedCount: 0,
          matchedCount: 0,
          results: [],
        };
      }

      // V1 限制检查
      if (candidatePool.length > V1_CANDIDATE_LIMIT) {
        throw new Error(`Candidate pool size ${candidatePool.length} exceeds V1 limit ${V1_CANDIDATE_LIMIT}`);
      }

      // Step 4: 更新状态为 RUNNING
      await batchJobRepository.updateStatus(batchJob.id, 'RUNNING', {
        totalCandidates: candidatePool.length,
        startedAt: new Date(),
      });

      // Step 5: 构建 JobRequirementData（复用 P4-01 接口）
      const jobReqData: JobRequirementData = {
        id: requirement.id,
        requiredSkills: (requirement.requiredSkills as any[]) || [],
        preferredSkills: (requirement.preferredSkills as any[]) || [],
        experienceMin: requirement.experienceMin,
        experienceMax: requirement.experienceMax,
        educationMin: requirement.educationMin,
        preferredMajors: (requirement.preferredMajors as any[]) || [],
        industries: (requirement.industries as any[]) || [],
        location: requirement.location,
        remoteOption: requirement.remoteOption,
        weights: requirement.weights as any,
      };

      // Step 6: 调用 P4-01 批量匹配
      const matchResults = await talentMatchingService.matchBatch(candidatePool, jobReqData);

      // Step 7: 过滤低于阈值的
      const qualifiedResults = matchResults.filter((r) => r.score >= threshold);

      // Step 8: 获取持久化后的 matchResultIds
      // matchBatch 内部已持久化，需要查询 ID
      const savedResults = await talentMatchResultRepository.listByJobRequirement(jobRequirementId);

      // 过滤阈值 + 限制数量
      const qualifiedSaved = savedResults
        .filter((r) => r.score >= threshold)
        .slice(0, maxResults);

      // Step 9: 执行排名
      const rankedResults = await rankingService.rankResults(
        qualifiedSaved.map((r) => r.id),
      );

      // Step 10: 更新 BatchJob 完成状态
      await batchJobRepository.updateStatus(batchJob.id, 'COMPLETED', {
        totalCandidates: candidatePool.length,
        processedCount: matchResults.length,
        matchedCount: qualifiedResults.length,
        completedAt: new Date(),
      });

      // Step 11: 构建返回结果
      const finalResults: RankedMatchResult[] = rankedResults.map((r) => {
        const saved = qualifiedSaved.find((s) => s.id === r.matchResultId);
        return {
          rank: r.rank,
          matchResultId: r.matchResultId,
          candidateId: r.candidateId,
          profileId: r.profileId,
          matchScore: r.matchScore,
          rankingScore: r.rankingScore,
          rankingVersion: r.rankingVersion,
          breakdown: r.breakdown,
          matchedSkills: saved?.matchedSkills || [],
          missingSkills: saved?.missingSkills || [],
        };
      });

      return {
        batchId: batchJob.id,
        status: 'COMPLETED',
        totalCandidates: candidatePool.length,
        processedCount: matchResults.length,
        matchedCount: qualifiedResults.length,
        results: finalResults,
      };
    } catch (e: any) {
      // 失败时更新 BatchJob
      await batchJobRepository.updateStatus(batchJob.id, 'FAILED', {
        errorMessage: e.message?.substring(0, 500),
        completedAt: new Date(),
      });

      return {
        batchId: batchJob.id,
        status: 'FAILED',
        totalCandidates: 0,
        processedCount: 0,
        matchedCount: 0,
        results: [],
        errorMessage: e.message,
      };
    }
  },

  /**
   * 加载候选人池
   * 来源: CareerProfile (status=active)
   * 可选过滤: location, minEducation
   */
  async loadCandidatePool(filters?: BatchMatchInput['filters']): Promise<string[]> {
    const where: any = {};

    if (filters?.location) {
      where.currentCity = filters.location;
    }

    if (filters?.minEducation) {
      // 简化处理：通过 education 关联过滤
      where.educations = {
        some: {
          degree: { equals: filters.minEducation },
        },
      };
    }

    const profiles = await prisma.careerProfile.findMany({
      where,
      select: { id: true },
    });

    return profiles.map((p) => p.id);
  },

  /**
   * 查询 BatchJob 状态
   */
  async getBatchStatus(batchId: string) {
    const job = await batchJobRepository.findById(batchId);
    if (!job) return null;

    return {
      id: job.id,
      status: job.status,
      totalCandidates: job.totalCandidates,
      processedCount: job.processedCount,
      matchedCount: job.matchedCount,
      progress: job.totalCandidates > 0
        ? Math.round((job.processedCount / job.totalCandidates) * 100)
        : 0,
      errorMessage: job.errorMessage,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
    };
  },

  /**
   * 列出企业的 BatchJobs
   */
  async listBatchJobs(enterpriseId: string) {
    const jobs = await batchJobRepository.findByEnterprise(enterpriseId);
    return jobs.map((j) => ({
      id: j.id,
      jobRequirementId: j.jobRequirementId,
      status: j.status,
      totalCandidates: j.totalCandidates,
      matchedCount: j.matchedCount,
      createdAt: j.createdAt,
    }));
  },
};
