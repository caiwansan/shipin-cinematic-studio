// ============================================================
// Candidate Skill API — 技能图谱
// 路径：/api/job/skills
// 认证：JWT（app.authenticate）
// ============================================================

import { FastifyInstance } from 'fastify';
import { skillRepository, careerProfileRepository } from '../repositories/index.js';

export default async function candidateSkillRoutes(app: FastifyInstance) {

  // ── GET /api/job/skills — 获取当前用户技能列表 ──
  app.get('/api/job/skills', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const profile = await careerProfileRepository.getByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: '档案不存在', message: '请先创建职业档案' });
      }

      const skills = await skillRepository.listByProfileId(profile.id);
      return { skills };
    } catch (error: any) {
      request.log.error({ error }, 'Failed to fetch skills');
      return reply.status(500).send({ error: '获取技能列表失败', message: error.message });
    }
  });

  // ── POST /api/job/skills — 添加技能 ──
  app.post('/api/job/skills', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const body = request.body || {};

      const profile = await careerProfileRepository.getByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: '档案不存在', message: '请先创建职业档案' });
      }

      const { skillName, category, level, confidence, source } = body;
      if (!skillName) {
        return reply.status(400).send({ error: '缺少必填字段', message: 'skillName 为必填' });
      }

      // 查找或创建技能词表
      const skill = await skillRepository.findOrCreate({ name: skillName, category });
      if (!skill) {
        return reply.status(500).send({ error: '创建技能失败' });
      }

      // 附加到人才
      const candidateSkill = await skillRepository.attachSkill({
        profileId: profile.id,
        skillId: skill.id,
        level,
        confidence,
        source: source ?? 'user',
      });

      return reply.status(201).send({ skill: { ...candidateSkill, skillName: skill.name, skillCategory: skill.category } });
    } catch (error: any) {
      request.log.error({ error }, 'Failed to add skill');
      return reply.status(500).send({ error: '添加技能失败', message: error.message });
    }
  });

  // ── PUT /api/job/skills/:id — 更新技能等级/置信度 ──
  app.put('/api/job/skills/:id', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const { id } = request.params as any;
      const body = request.body || {};

      const profile = await careerProfileRepository.getByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: '档案不存在' });
      }

      const existing = await skillRepository.getCandidateSkill(id);
      if (!existing || existing.profileId !== profile.id) {
        return reply.status(404).send({ error: '技能不存在' });
      }

      const updated = await skillRepository.updateCandidateSkill(id, {
        level: body.level,
        confidence: body.confidence,
      }, body.source);

      return { skill: updated };
    } catch (error: any) {
      request.log.error({ error }, 'Failed to update skill');
      return reply.status(500).send({ error: '更新技能失败', message: error.message });
    }
  });

  // ── DELETE /api/job/skills/:id — 移除技能 ──
  app.delete('/api/job/skills/:id', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const { id } = request.params as any;

      const profile = await careerProfileRepository.getByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: '档案不存在' });
      }

      const existing = await skillRepository.getCandidateSkill(id);
      if (!existing || existing.profileId !== profile.id) {
        return reply.status(404).send({ error: '技能不存在' });
      }

      await skillRepository.detachSkill(profile.id, existing.skillId);
      return { success: true };
    } catch (error: any) {
      request.log.error({ error }, 'Failed to remove skill');
      return reply.status(500).send({ error: '移除技能失败', message: error.message });
    }
  });

  // ── POST /api/job/skills/:id/evidence — 添加技能证据 ──
  app.post('/api/job/skills/:id/evidence', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const { id } = request.params as any;
      const body = request.body || {};

      const profile = await careerProfileRepository.getByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: '档案不存在' });
      }

      const existing = await skillRepository.getCandidateSkill(id);
      if (!existing || existing.profileId !== profile.id) {
        return reply.status(404).send({ error: '技能不存在' });
      }

      const { evidenceType, refId, description, metadata } = body;
      if (!evidenceType) {
        return reply.status(400).send({ error: '缺少必填字段', message: 'evidenceType 为必填' });
      }

      const evidence = await skillRepository.addEvidence({
        candidateSkillId: id,
        evidenceType,
        refId,
        description,
        metadata,
      });

      return reply.status(201).send({ evidence });
    } catch (error: any) {
      request.log.error({ error }, 'Failed to add evidence');
      return reply.status(500).send({ error: '添加证据失败', message: error.message });
    }
  });

  // ── GET /api/job/skills/:id/evidence — 获取技能证据链 ──
  app.get('/api/job/skills/:id/evidence', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const { id } = request.params as any;

      const profile = await careerProfileRepository.getByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: '档案不存在' });
      }

      const existing = await skillRepository.getCandidateSkill(id);
      if (!existing || existing.profileId !== profile.id) {
        return reply.status(404).send({ error: '技能不存在' });
      }

      const evidence = await skillRepository.listEvidence(id);
      return { skill: existing, evidence };
    } catch (error: any) {
      request.log.error({ error }, 'Failed to fetch evidence');
      return reply.status(500).send({ error: '获取证据链失败', message: error.message });
    }
  });
}
