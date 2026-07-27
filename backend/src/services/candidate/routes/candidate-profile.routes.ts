// ============================================================
// Candidate Profile API — 求职者端
// 路径：/api/job/profile
// 认证：JWT（app.authenticate）
// ============================================================

import { FastifyInstance } from 'fastify';
import {
  careerProfileRepository,
  workExperienceRepository,
  educationRepository,
  skillRepository,
} from '../repositories/index.js';

export default async function candidateProfileRoutes(app: FastifyInstance) {

  // ── GET /api/job/profile — 获取当前用户职业档案 ──
  app.get('/api/job/profile', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const profile = await careerProfileRepository.getByUserId(userId);

      if (!profile) {
        return { profile: null, experiences: [], education: [], skills: [], resume: null };
      }

      const [experiences, education, skills] = await Promise.all([
        workExperienceRepository.listByProfileId(profile.id),
        educationRepository.listByProfileId(profile.id),
        skillRepository.listByProfileId(profile.id),
      ]);

      return { profile, experiences, education, skills };
    } catch (error: any) {
      request.log.error({ error }, 'Failed to fetch candidate profile');
      return reply.status(500).send({ error: '获取档案失败', message: error.message });
    }
  });

  // ── POST /api/job/profile — 创建职业档案 ──
  app.post('/api/job/profile', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const body = request.body || {};

      // 检查是否已有档案
      const exists = await careerProfileRepository.existsByUserId(userId);
      if (exists) {
        return reply.status(409).send({ error: '档案已存在', message: '每位用户只能创建一份职业档案' });
      }

      const { fullName, headline, bio, avatarUrl, email, phone, city, careerDirection, industry, yearsExperience, currentLevel } = body;
      if (!fullName) {
        return reply.status(400).send({ error: '缺少必填字段', message: 'fullName 为必填' });
      }

      const profile = await careerProfileRepository.create({
        userId,
        fullName,
        headline,
        bio,
        avatarUrl,
        email,
        phone,
        city,
        careerDirection,
        industry,
        yearsExperience,
        currentLevel,
      });

      return reply.status(201).send({ profile });
    } catch (error: any) {
      request.log.error({ error }, 'Failed to create candidate profile');
      return reply.status(500).send({ error: '创建档案失败', message: error.message });
    }
  });

  // ── PUT /api/job/profile — 更新基础档案 ──
  app.put('/api/job/profile', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const body = request.body || {};

      const profile = await careerProfileRepository.getByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: '档案不存在', message: '请先创建职业档案' });
      }

      const allowedFields = [
        'fullName', 'headline', 'bio', 'avatarUrl', 'email', 'phone',
        'city', 'careerDirection', 'industry', 'yearsExperience', 'currentLevel',
        'jobSeekingStatus', 'openToOpportunity', 'visibility',
      ];
      const updates: any = {};
      for (const key of allowedFields) {
        if (body[key] !== undefined) updates[key] = body[key];
      }

      const updated = await careerProfileRepository.update(profile.id, updates);
      return { profile: updated };
    } catch (error: any) {
      request.log.error({ error }, 'Failed to update candidate profile');
      return reply.status(500).send({ error: '更新档案失败', message: error.message });
    }
  });

  // ── POST /api/job/profile/experiences — 添加工作经历 ──
  app.post('/api/job/profile/experiences', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const body = request.body || {};

      const profile = await careerProfileRepository.getByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: '档案不存在' });
      }

      const { company, title, department, employmentType, startDate, endDate, isCurrent, location, description, achievements, skillsUsed } = body;
      if (!company || !title || !startDate) {
        return reply.status(400).send({ error: '缺少必填字段', message: 'company、title、startDate 为必填' });
      }

      const experience = await workExperienceRepository.create({
        profileId: profile.id,
        company,
        title,
        department,
        employmentType,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
        isCurrent,
        location,
        description,
        achievements,
        skillsUsed,
      });

      return reply.status(201).send({ experience });
    } catch (error: any) {
      request.log.error({ error }, 'Failed to add work experience');
      return reply.status(500).send({ error: '添加工作经历失败', message: error.message });
    }
  });

  // ── PUT /api/job/profile/experiences/:id — 更新工作经历 ──
  app.put('/api/job/profile/experiences/:id', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const { id } = request.params as any;
      const body = request.body || {};

      const profile = await careerProfileRepository.getByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: '档案不存在' });
      }

      const existing = await workExperienceRepository.getById(id);
      if (!existing || existing.profileId !== profile.id) {
        return reply.status(404).send({ error: '工作经历不存在' });
      }

      const updates: any = {};
      const allowedFields = ['company', 'title', 'department', 'employmentType', 'endDate', 'isCurrent', 'location', 'description', 'achievements', 'skillsUsed'];
      for (const key of allowedFields) {
        if (body[key] !== undefined) updates[key] = body[key];
      }
      if (body.startDate !== undefined) updates.startDate = new Date(body.startDate);

      const updated = await workExperienceRepository.update(id, updates);
      return { experience: updated };
    } catch (error: any) {
      request.log.error({ error }, 'Failed to update work experience');
      return reply.status(500).send({ error: '更新工作经历失败', message: error.message });
    }
  });

  // ── DELETE /api/job/profile/experiences/:id — 删除工作经历 ──
  app.delete('/api/job/profile/experiences/:id', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const { id } = request.params as any;

      const profile = await careerProfileRepository.getByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: '档案不存在' });
      }

      const existing = await workExperienceRepository.getById(id);
      if (!existing || existing.profileId !== profile.id) {
        return reply.status(404).send({ error: '工作经历不存在' });
      }

      await workExperienceRepository.delete(id);
      return { success: true };
    } catch (error: any) {
      request.log.error({ error }, 'Failed to delete work experience');
      return reply.status(500).send({ error: '删除工作经历失败', message: error.message });
    }
  });

  // ── POST /api/job/profile/education — 添加教育经历 ──
  app.post('/api/job/profile/education', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const body = request.body || {};

      const profile = await careerProfileRepository.getByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: '档案不存在' });
      }

      const { school, degree, major, startDate, endDate, gpa, description } = body;
      if (!school) {
        return reply.status(400).send({ error: '缺少必填字段', message: 'school 为必填' });
      }

      const edu = await educationRepository.create({
        profileId: profile.id,
        school,
        degree,
        major,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        gpa,
        description,
      });

      return reply.status(201).send({ education: edu });
    } catch (error: any) {
      request.log.error({ error }, 'Failed to add education');
      return reply.status(500).send({ error: '添加教育经历失败', message: error.message });
    }
  });

  // ── PUT /api/job/profile/education/:id — 更新教育经历 ──
  app.put('/api/job/profile/education/:id', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const { id } = request.params as any;
      const body = request.body || {};

      const profile = await careerProfileRepository.getByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: '档案不存在' });
      }

      const existing = await educationRepository.getById(id);
      if (!existing || existing.profileId !== profile.id) {
        return reply.status(404).send({ error: '教育经历不存在' });
      }

      const updates: any = {};
      const allowedFields = ['school', 'degree', 'major', 'endDate', 'gpa', 'description'];
      for (const key of allowedFields) {
        if (body[key] !== undefined) updates[key] = body[key];
      }
      if (body.startDate !== undefined) updates.startDate = new Date(body.startDate);

      const updated = await educationRepository.update(id, updates);
      return { education: updated };
    } catch (error: any) {
      request.log.error({ error }, 'Failed to update education');
      return reply.status(500).send({ error: '更新教育经历失败', message: error.message });
    }
  });

  // ── DELETE /api/job/profile/education/:id — 删除教育经历 ──
  app.delete('/api/job/profile/education/:id', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const { id } = request.params as any;

      const profile = await careerProfileRepository.getByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: '档案不存在' });
      }

      const existing = await educationRepository.getById(id);
      if (!existing || existing.profileId !== profile.id) {
        return reply.status(404).send({ error: '教育经历不存在' });
      }

      await educationRepository.delete(id);
      return { success: true };
    } catch (error: any) {
      request.log.error({ error }, 'Failed to delete education');
      return reply.status(500).send({ error: '删除教育经历失败', message: error.message });
    }
  });
}
