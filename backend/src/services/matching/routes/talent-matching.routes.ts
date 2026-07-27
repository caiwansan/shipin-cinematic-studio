// ============================================================
// TalentMatchingRoutes — 人才匹配 API
// 职责：提供岗位要求管理、匹配搜索、结果查询、证据链查询
// 设计原则：企业 API 不暴露 Candidate 原始数据
// ============================================================

import type { FastifyInstance } from 'fastify';
import { jobRequirementRepository } from '../repositories/job-requirement.repository.js';
import { talentMatchResultRepository } from '../repositories/talent-match-result.repository.js';
import { matchEvidenceRepository } from '../repositories/match-evidence.repository.js';
import { talentMatchingService } from '../services/talent-matching.service.js';
import { prisma } from '../../../utils/index.js';
import { getEnterpriseContext } from '../../../repositories/recruitment/enterprise-member.repository.js';

export async function talentMatchingRoutes(app: FastifyInstance) {

  // ── 获取企业岗位要求列表 ──────────────────────────
  app.get('/job/match/requirements', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).id;

    try {
      const ctx = await getEnterpriseContext(userId);
      if (!ctx) {
        return reply.status(403).send({ error: 'User is not associated with an enterprise' });
      }

      const requirements = await jobRequirementRepository.listByEnterprise(ctx.enterpriseId);
      return { total: requirements.length, requirements };
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // ── 创建岗位要求 ────────────────────────────────────
  app.post('/job/match/requirements', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).id;
    const body = request.body as any;

    if (!body.jobTitle) {
      return reply.status(400).send({ error: 'jobTitle is required' });
    }
    if (!body.requiredSkills || !Array.isArray(body.requiredSkills)) {
      return reply.status(400).send({ error: 'requiredSkills must be an array' });
    }

    try {
      // 获取企业 ID（Sprint-03D: 双模型桥接）
      const ctx = await getEnterpriseContext(userId);
      const enterpriseId = ctx?.enterpriseId;
      if (!enterpriseId) {
        return reply.status(403).send({ error: 'User is not associated with an enterprise' });
      }

      const requirement = await jobRequirementRepository.create({
        enterpriseId,
        jobTitle: body.jobTitle,
        jobDescription: body.jobDescription,
        requiredSkills: body.requiredSkills,
        preferredSkills: body.preferredSkills,
        experienceMin: body.experienceMin,
        experienceMax: body.experienceMax,
        educationMin: body.educationMin,
        preferredMajors: body.preferredMajors,
        industries: body.industries,
        employmentType: body.employmentType,
        location: body.location,
        remoteOption: body.remoteOption,
        salaryMin: body.salaryMin,
        salaryMax: body.salaryMax,
        weights: body.weights,
      });

      return requirement;
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // ── 获取岗位要求详情 ──────────────────────────────
  app.get('/job/match/requirements/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const requirement = await jobRequirementRepository.getById(id);
      if (!requirement) {
        return reply.status(404).send({ error: 'Requirement not found' });
      }
      return requirement;
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // ── 更新岗位要求 ────────────────────────────────────
  app.put('/job/match/requirements/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    try {
      const existing = await jobRequirementRepository.getById(id);
      if (!existing) {
        return reply.status(404).send({ error: 'Requirement not found' });
      }

      const requirement = await jobRequirementRepository.update(id, {
        jobTitle: body.jobTitle,
        jobDescription: body.jobDescription,
        requiredSkills: body.requiredSkills,
        preferredSkills: body.preferredSkills,
        experienceMin: body.experienceMin,
        experienceMax: body.experienceMax,
        educationMin: body.educationMin,
        preferredMajors: body.preferredMajors,
        industries: body.industries,
        employmentType: body.employmentType,
        location: body.location,
        remoteOption: body.remoteOption,
        salaryMin: body.salaryMin,
        salaryMax: body.salaryMax,
        weights: body.weights,
        status: body.status,
      });

      return requirement;
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // ── 搜索匹配候选人 ─────────────────────────────────
  app.post('/job/match/search', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = request.body as any;
    const { requirementId, minScore, limit, offset } = body;

    if (!requirementId) {
      return reply.status(400).send({ error: 'requirementId is required' });
    }

    try {
      // 1. 获取当前用户的企业 ID
      const userId = (request.user as any).id;
      const ctx = await getEnterpriseContext(userId);
      if (!ctx) {
        return reply.status(403).send({ error: 'User is not associated with an enterprise' });
      }

      // 2. 获取岗位要求
      const requirement = await jobRequirementRepository.getById(requirementId);
      if (!requirement) {
        return reply.status(404).send({ error: 'Requirement not found' });
      }

      // 3. 权限校验：requirement 必须属于当前用户的企业
      if (requirement.enterpriseId !== ctx.enterpriseId) {
        return reply.status(404).send({ error: 'Requirement not found' });
      }

      // 4. 获取所有已匹配的结果
      let matchResults = await talentMatchResultRepository.listByJobRequirement(
        requirementId,
        minScore,
        limit || 20,
      );

      // 3. 如果结果为空，自动触发匹配计算
      if (matchResults.length === 0) {
        // 获取所有 CareerProfile
        const profiles = await prisma.careerProfile.findMany({
          select: { id: true },
        });

        if (profiles.length > 0) {
          const matchResultsList = await talentMatchingService.matchBatch(
            profiles.map((p) => p.id),
            {
              id: requirement.id,
              requiredSkills: requirement.requiredSkills,
              preferredSkills: requirement.preferredSkills,
              experienceMin: requirement.experienceMin,
              experienceMax: requirement.experienceMax,
              educationMin: requirement.educationMin,
              preferredMajors: requirement.preferredMajors,
              industries: requirement.industries,
              location: requirement.location,
              remoteOption: requirement.remoteOption,
              weights: requirement.weights,
            },
          );

          // 重新查询持久化后的结果
          matchResults = await talentMatchResultRepository.listByJobRequirement(
            requirementId,
            minScore,
            limit || 20,
          );
        }
      }

      // 4. 组装响应

      // 3. 组装响应（不暴露 Candidate 原始数据）
      const results = await Promise.all(
        matchResults.map(async (mr, idx) => {
          // 获取 Candidate Card 投影
          const card = await prisma.candidateCard.findUnique({
            where: { profileId: mr.profileId },
          });

          return {
            rank: offset ? offset + idx + 1 : idx + 1,
            candidateId: mr.candidateId,
            score: mr.score,
            breakdown: mr.breakdown,
            headline: card?.headline || null,
            currentCompany: card?.currentCompany || null,
            currentTitle: card?.currentTitle || null,
            currentCity: card?.currentCity || null,
            yearsExperience: card?.yearsExperience || 0,
            matchedSkills: mr.matchedSkills,
            missingSkills: mr.missingSkills,
            skillGap: mr.skillGap,
            riskFlags: mr.riskFlags,
            reasoning: mr.reasoning,
            matchVersion: mr.matchVersion,
            createdAt: mr.createdAt,
          };
        }),
      );

      return {
        total: results.length,
        requirement: {
          id: requirement.id,
          jobTitle: requirement.jobTitle,
          status: requirement.status,
        },
        results,
      };
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // ── 获取匹配结果详情 ──────────────────────────────
  app.get('/job/match/results/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await talentMatchingService.getMatchResultWithEvidence(id);
      if (!result) {
        return reply.status(404).send({ error: 'Match result not found' });
      }

      // 获取 Candidate Card 投影
      const card = await prisma.candidateCard.findUnique({
        where: { profileId: result.profileId },
      });

      return {
        ...result,
        candidate: {
          headline: card?.headline || null,
          currentCompany: card?.currentCompany || null,
          currentTitle: card?.currentTitle || null,
          currentCity: card?.currentCity || null,
          yearsExperience: card?.yearsExperience || 0,
          skillTags: card?.skillTags || [],
        },
      };
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // ── 获取证据链 ─────────────────────────────────────
  app.get('/job/match/evidence/:resultId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { resultId } = request.params as { resultId: string };

    try {
      const evidence = await matchEvidenceRepository.listByMatchResult(resultId);
      return { resultId, evidence, total: evidence.length };
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // ── 获取某岗位的所有匹配结果 ──────────────────────
  app.get('/job/match/requirements/:id/results', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as any;
    const minScore = query.minScore ? parseInt(query.minScore) : undefined;
    const limit = query.limit ? parseInt(query.limit) : 50;

    try {
      const results = await talentMatchResultRepository.listByJobRequirement(id, minScore, limit);
      return {
        total: results.length,
        results: results.map((r, idx) => ({
          ...r,
          rank: idx + 1,
        })),
      };
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });
}
