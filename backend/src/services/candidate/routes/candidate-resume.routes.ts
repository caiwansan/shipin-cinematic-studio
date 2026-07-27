// ============================================================
// Candidate Resume API — 简历管理
// 路径：/api/job/resumes
// 认证：JWT（app.authenticate）
// ============================================================

import { FastifyInstance } from 'fastify';
import { candidateResumeRepository, careerProfileRepository } from '../repositories/index.js';

export default async function candidateResumeRoutes(app: FastifyInstance) {

  // ── GET /api/job/resumes — 获取当前用户所有简历 ──
  app.get('/api/job/resumes', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const profile = await careerProfileRepository.getByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: '档案不存在', message: '请先创建职业档案' });
      }

      const resumes = await candidateResumeRepository.listByProfileId(profile.id);
      return { resumes };
    } catch (error: any) {
      request.log.error({ error }, 'Failed to fetch resumes');
      return reply.status(500).send({ error: '获取简历列表失败', message: error.message });
    }
  });

  // ── GET /api/job/resumes/:id — 获取单份简历 ──
  app.get('/api/job/resumes/:id', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const { id } = request.params as any;

      const profile = await careerProfileRepository.getByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: '档案不存在' });
      }

      const resume = await candidateResumeRepository.getById(id);
      if (!resume || resume.profileId !== profile.id) {
        return reply.status(404).send({ error: '简历不存在' });
      }

      return { resume };
    } catch (error: any) {
      request.log.error({ error }, 'Failed to fetch resume');
      return reply.status(500).send({ error: '获取简历失败', message: error.message });
    }
  });

  // ── POST /api/job/resumes — 创建简历版本 ──
  app.post('/api/job/resumes', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const body = request.body || {};

      const profile = await careerProfileRepository.getByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: '档案不存在', message: '请先创建职业档案' });
      }

      const { name, language, targetRole, contentJson, sourceResumeId } = body;
      if (!name) {
        return reply.status(400).send({ error: '缺少必填字段', message: 'name 为必填' });
      }

      const resume = await candidateResumeRepository.create({
        profileId: profile.id,
        name,
        language: language ?? 'zh',
        targetRole,
        contentJson: contentJson ?? {},
        generatedBy: sourceResumeId ? 'ai' : 'user',
        sourceResumeId,
      });

      return reply.status(201).send({ resume });
    } catch (error: any) {
      request.log.error({ error }, 'Failed to create resume');
      return reply.status(500).send({ error: '创建简历失败', message: error.message });
    }
  });

  // ── PATCH /api/job/resumes/:id/default — 设置默认简历 ──
  app.patch('/api/job/resumes/:id/default', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const { id } = request.params as any;

      const profile = await careerProfileRepository.getByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: '档案不存在' });
      }

      const resume = await candidateResumeRepository.getById(id);
      if (!resume || resume.profileId !== profile.id) {
        return reply.status(404).send({ error: '简历不存在' });
      }

      await candidateResumeRepository.setDefault(id, profile.id);
      return { success: true, id, isDefault: true };
    } catch (error: any) {
      request.log.error({ error }, 'Failed to set default resume');
      return reply.status(500).send({ error: '设置默认简历失败', message: error.message });
    }
  });

  // ── DELETE /api/job/resumes/:id — 归档简历（软删除）──
  app.delete('/api/job/resumes/:id', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const { id } = request.params as any;

      const profile = await careerProfileRepository.getByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: '档案不存在' });
      }

      const resume = await candidateResumeRepository.getById(id);
      if (!resume || resume.profileId !== profile.id) {
        return reply.status(404).send({ error: '简历不存在' });
      }

      await candidateResumeRepository.archive(id);
      return { success: true, id, status: 'archived' };
    } catch (error: any) {
      request.log.error({ error }, 'Failed to archive resume');
      return reply.status(500).send({ error: '归档简历失败', message: error.message });
    }
  });

  // ── GET /api/job/resumes/:id/derived — 获取派生链 ──
  app.get('/api/job/resumes/:id/derived', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const { id } = request.params as any;

      const profile = await careerProfileRepository.getByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: '档案不存在' });
      }

      const resume = await candidateResumeRepository.getById(id);
      if (!resume || resume.profileId !== profile.id) {
        return reply.status(404).send({ error: '简历不存在' });
      }

      const derived = await candidateResumeRepository.getDerivedChain(id);
      return { source: resume, derived };
    } catch (error: any) {
      request.log.error({ error }, 'Failed to fetch derived chain');
      return reply.status(500).send({ error: '获取派生链失败', message: error.message });
    }
  });
}
