// ============================================================
// JobUnderstandingRoutes — JD 结构化 API
// 职责：提供 JD → JobRequirementProfile 的提取接口
// 红线：不进入匹配决策链，不暴露 Candidate 数据
// ============================================================

import type { FastifyInstance } from 'fastify';
import { jobUnderstandingService, JobUnderstandingError } from '../services/job-understanding.service.js';
import { prisma } from '../../../utils/index.js';
import { getEnterpriseContext } from '../../../repositories/recruitment/enterprise-member.repository.js';

export async function jobUnderstandingRoutes(app: FastifyInstance) {

  // ── 从 JD 提取结构化要求并持久化 ──
  app.post('/job/match/requirements/extract', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = request.body as any;

    try {
      // 获取当前用户的企业 ID
      const userId = (request.user as any).id;
      const ctx = await getEnterpriseContext(userId);
      if (!ctx) {
        return reply.status(403).send({ error: 'User is not associated with an enterprise' });
      }

      const result = await jobUnderstandingService.extractAndSave({
        enterpriseId: ctx.enterpriseId,
        jobTitle: body.jobTitle,
        jobDescription: body.jobDescription,
        department: body.department,
        location: body.location,
        salaryMin: body.salaryMin,
        salaryMax: body.salaryMax,
        employmentType: body.employmentType,
        language: body.language || 'zh',
      });

      return result;
    } catch (e: any) {
      if (e instanceof JobUnderstandingError) {
        return reply.status(e.statusCode).send({ error: e.message });
      }
      console.error(`[JobUnderstandingRoute] Error: ${e.message}`);
      return reply.status(500).send({ error: 'Job understanding failed' });
    }
  });

  // ── 校验模式：只提取不持久化 ──
  app.post('/job/match/requirements/validate', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = request.body as any;

    try {
      const userId = (request.user as any).id;
      const ctx = await getEnterpriseContext(userId);

      const result = await jobUnderstandingService.extractOnly({
        enterpriseId: member?.enterpriseId,
        jobTitle: body.jobTitle,
        jobDescription: body.jobDescription,
        department: body.department,
        location: body.location,
        salaryMin: body.salaryMin,
        salaryMax: body.salaryMax,
        employmentType: body.employmentType,
        language: body.language || 'zh',
      });

      return result;
    } catch (e: any) {
      if (e instanceof JobUnderstandingError) {
        return reply.status(e.statusCode).send({ error: e.message });
      }
      console.error(`[JobUnderstandingRoute] Error: ${e.message}`);
      return reply.status(500).send({ error: 'Validation failed' });
    }
  });

  // ── 获取技能词表 ──
  app.get('/job/match/skills/vocabulary', { preHandler: [app.authenticate] }, async (_request, reply) => {
    try {
      const skills = await jobUnderstandingService.getSkillVocabulary();
      return { total: skills.length, skills };
    } catch (e: any) {
      console.error(`[JobUnderstandingRoute] Error: ${e.message}`);
      return reply.status(500).send({ error: 'Failed to load skill vocabulary' });
    }
  });
}
