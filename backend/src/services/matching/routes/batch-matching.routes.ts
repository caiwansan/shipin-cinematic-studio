/**
 * Batch Matching Routes
 * 批量匹配 + 排名 API
 *
 * 5 个端点：
 *   POST   /api/job/match/batch              触发批量匹配
 *   GET    /api/job/match/batch/:id           查询 Batch Job 状态
 *   GET    /api/job/match/batch/:id/results   获取排名后的匹配结果
 *   GET    /api/job/match/batch/list          列出企业的 Batch Jobs
 *   DELETE /api/job/match/batch/:id           取消/删除 Batch Job
 */

import type { FastifyInstance } from 'fastify';
import { batchMatchingService } from '../services/batch-matching.service.js';
import { batchJobRepository } from '../repositories/batch-job.repository.js';
import { talentMatchResultRepository } from '../repositories/talent-match-result.repository.js';
import { matchEvidenceRepository } from '../repositories/match-evidence.repository.js';
import { prisma } from '../../../utils/index.js';
import { getEnterpriseContext } from '../../../repositories/recruitment/enterprise-member.repository.js';

export async function batchMatchingRoutes(app: FastifyInstance) {

  // ============================================================
  // POST /api/job/match/batch — 触发批量匹配
  // ============================================================
  app.post('/job/match/batch', {
    preHandler: app.authenticate,
  }, async (request, reply) => {
    const user = request.user as any;
    const body = request.body as any;

    // 校验必填字段
    if (!body.jobRequirementId) {
      return reply.status(400).send({ error: 'jobRequirementId is required' });
    }

    // 验证企业权限 — 加载岗位要求并检查 enterpriseId
    const requirement = await prisma.jobRequirementProfile.findUnique({
      where: { id: body.jobRequirementId },
    });
    if (!requirement) {
      return reply.status(404).send({ error: 'Job requirement not found' });
    }

    // 获取用户的 enterpriseId（Sprint-03D: 双模型桥接）
    const ctx = await getEnterpriseContext(user.id);
    if (!ctx) {
      return reply.status(403).send({ error: 'Not an enterprise member' });
    }

    // 企业隔离：只能匹配自己企业的岗位
    if (requirement.enterpriseId !== ctx.enterpriseId) {
      return reply.status(404).send({ error: 'Job requirement not found' });
    }

    try {
      const result = await batchMatchingService.executeBatch({
        enterpriseId: ctx.enterpriseId,
        jobRequirementId: body.jobRequirementId,
        threshold: body.threshold,
        maxResults: body.maxResults,
        filters: body.filters,
      });

      if (result.status === 'FAILED') {
        return reply.status(400).send({
          error: result.errorMessage || 'Batch matching failed',
          batchId: result.batchId,
        });
      }

      return reply.status(200).send(result);
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // ============================================================
  // GET /api/job/match/batch/:id — 查询 Batch Job 状态
  // ============================================================
  app.get('/job/match/batch/:id', {
    preHandler: app.authenticate,
  }, async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as any;

    const job = await batchJobRepository.findById(id);
    if (!job) {
      return reply.status(404).send({ error: 'Batch job not found' });
    }

    // 权限检查（Sprint-03D: 双模型桥接）
    const ctx = await getEnterpriseContext(user.id);
    if (!ctx || job.enterpriseId !== ctx.enterpriseId) {
      return reply.status(404).send({ error: 'Batch job not found' });
    }

    const status = await batchMatchingService.getBatchStatus(id);
    return reply.status(200).send(status);
  });

  // ============================================================
  // GET /api/job/match/batch/:id/results — 获取排名后的匹配结果
  // ============================================================
  app.get('/job/match/batch/:id/results', {
    preHandler: app.authenticate,
  }, async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as any;
    const query = request.query as any;

    const job = await batchJobRepository.findById(id);
    if (!job) {
      return reply.status(404).send({ error: 'Batch job not found' });
    }

    // 权限检查（Sprint-03D: 双模型桥接）
    const ctx = await getEnterpriseContext(user.id);
    if (!ctx || job.enterpriseId !== ctx.enterpriseId) {
      return reply.status(404).send({ error: 'Batch job not found' });
    }

    // 获取该 jobRequirementId 下所有匹配结果（按 rank 排序）
    const matchResults = await talentMatchResultRepository.listByJobRequirement(
      job.jobRequirementId,
      undefined,
      job.maxResults,
    );

    // 加载证据链
    const resultsWithEvidence = await Promise.all(
      matchResults.map(async (r) => {
        const evidence = await matchEvidenceRepository.listByMatchResult(r.id);
        return {
          id: r.id,
          rank: r.rank,
          candidateId: r.candidateId,
          profileId: r.profileId,
          score: r.score,
          rankingVersion: r.rankingVersion,
          breakdown: r.breakdown,
          matchedSkills: r.matchedSkills,
          missingSkills: r.missingSkills,
          skillGap: r.skillGap,
          riskFlags: r.riskFlags,
          evidence: evidence.map((e: any) => ({
            evidenceType: e.evidenceType,
            claim: e.claim,
            sourceType: e.sourceType,
            sourceId: e.sourceId,
            confidence: e.confidence,
          })),
        };
      }),
    );

    return reply.status(200).send({
      batchId: id,
      jobRequirementId: job.jobRequirementId,
      status: job.status,
      totalCandidates: job.totalCandidates,
      matchedCount: job.matchedCount,
      rankingVersion: job.rankingVersion,
      results: resultsWithEvidence,
    });
  });

  // ============================================================
  // GET /api/job/match/batch/list — 列出企业的 Batch Jobs
  // ============================================================
  app.get('/job/match/batch/list', {
    preHandler: app.authenticate,
  }, async (request, reply) => {
    const user = request.user as any;

    // Sprint-03D: 双模型桥接
    const ctx = await getEnterpriseContext(user.id);
    if (!ctx) {
      return reply.status(403).send({ error: 'Not an enterprise member' });
    }

    const jobs = await batchMatchingService.listBatchJobs(ctx.enterpriseId);
    return reply.status(200).send({ jobs });
  });

  // ============================================================
  // DELETE /api/job/match/batch/:id — 取消/删除 Batch Job
  // ============================================================
  app.delete('/job/match/batch/:id', {
    preHandler: app.authenticate,
  }, async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as any;

    const job = await batchJobRepository.findById(id);
    if (!job) {
      return reply.status(404).send({ error: 'Batch job not found' });
    }

    // 权限检查（Sprint-03D: 双模型桥接）
    const ctx = await getEnterpriseContext(user.id);
    if (!ctx || job.enterpriseId !== ctx.enterpriseId) {
      return reply.status(404).send({ error: 'Batch job not found' });
    }

    await batchJobRepository.delete(id);
    return reply.status(200).send({ message: 'Batch job deleted' });
  });
}
