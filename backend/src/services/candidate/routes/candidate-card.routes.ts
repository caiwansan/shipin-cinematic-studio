// ============================================================
// CandidateCardRoutes — 人才卡片 API
// 职责：提供 Card 投影读取、可见性控制、AI 摘要
// 设计原则：Card = Projection，所有读取都经过 Projection Service
// ============================================================

import type { FastifyInstance } from 'fastify';
import { candidateCardRepository } from '../repositories/candidate-card.repository.js';
import { candidateCardProjectionService } from '../services/candidate-card-projection.service.js';

export async function candidateCardRoutes(app: FastifyInstance) {

  // ── 获取自己的 Card（完整视图）──────────────────────
  app.get('/api/job/card', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).id;

    // 通过 userId 找到 Career Profile
    const { prisma } = await import('../../../utils/index.js');
    const profile = await prisma.careerProfile.findUnique({ where: { userId } });
    if (!profile) {
      return reply.status(404).send({ error: 'Career profile not found' });
    }

    try {
      const card = await candidateCardProjectionService.getCard(profile.id, {
        viewer: 'owner',
      });
      return card;
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // ── 刷新 Card 投影 ─────────────────────────────────
  app.post('/api/job/card/refresh', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).id;

    const { prisma } = await import('../../../utils/index.js');
    const profile = await prisma.careerProfile.findUnique({ where: { userId } });
    if (!profile) {
      return reply.status(404).send({ error: 'Career profile not found' });
    }

    try {
      await candidateCardProjectionService.refreshProjection(profile.id);
      const card = await candidateCardProjectionService.getCard(profile.id, {
        viewer: 'owner',
      });
      return card;
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // ── 更新 Card 可见性 ──────────────────────────────
  app.patch('/api/job/card/visibility', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).id;
    const { visibility, hiddenFields } = request.body as {
      visibility: string;
      hiddenFields?: string[];
    };

    if (!visibility) {
      return reply.status(400).send({ error: 'visibility is required' });
    }

    const validVisibilities = ['private', 'public', 'enterprise_only'];
    if (!validVisibilities.includes(visibility)) {
      return reply.status(400).send({ error: `visibility must be one of: ${validVisibilities.join(', ')}` });
    }

    const { prisma } = await import('../../../utils/index.js');
    const profile = await prisma.careerProfile.findUnique({ where: { userId } });
    if (!profile) {
      return reply.status(404).send({ error: 'Career profile not found' });
    }

    try {
      const card = await candidateCardRepository.updateVisibility(profile.id, {
        visibility,
        hiddenFields,
      });
      return card;
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // ── 更新 Card 公开字段 ─────────────────────────────
  app.patch('/api/job/card/fields', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).id;
    const {
      headline, summary, skillTags,
      currentCity, currentCompany, currentTitle,
    } = request.body as Record<string, any>;

    const { prisma } = await import('../../../utils/index.js');
    const profile = await prisma.careerProfile.findUnique({ where: { userId } });
    if (!profile) {
      return reply.status(404).send({ error: 'Career profile not found' });
    }

    try {
      const card = await candidateCardRepository.updatePublicFields(profile.id, {
        headline,
        summary,
        skillTags,
        currentCity,
        currentCompany,
        currentTitle,
      });
      return card;
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // ── 获取 Card AI 摘要 ─────────────────────────────
  app.get('/api/job/card/summary', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).id;

    const { prisma } = await import('../../../utils/index.js');
    const profile = await prisma.careerProfile.findUnique({ where: { userId } });
    if (!profile) {
      return reply.status(404).send({ error: 'Career profile not found' });
    }

    try {
      const summary = await candidateCardProjectionService.generateSummary(profile.id);
      return summary;
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // ── 查看他人 Card（企业视图，带可见性过滤）─────────
  app.get('/api/job/card/:profileId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { profileId } = request.params as { profileId: string };

    try {
      const card = await candidateCardProjectionService.getCard(profileId, {
        viewer: 'enterprise',
      });

      // 记录浏览
      await candidateCardProjectionService.recordView(profileId);

      return card;
    } catch (e: any) {
      if (e.message?.includes('not found')) {
        return reply.status(404).send({ error: 'Card not found' });
      }
      return reply.status(500).send({ error: e.message });
    }
  });
}
