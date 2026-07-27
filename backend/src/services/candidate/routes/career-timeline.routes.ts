// ============================================================
// CareerTimelineRoutes — 职业成长事件流 API
// 职责：管理 CareerTimelineEvent 的追加、查询、Correction 链
// 设计原则：DP-P3-04 Append-only，不允许 Update / Delete
// ============================================================

import type { FastifyInstance } from 'fastify';
import { careerTimelineService } from '../services/career-timeline.service.js';
import { careerTimelineRepository } from '../repositories/career-timeline.repository.js';

export async function careerTimelineRoutes(app: FastifyInstance) {

  // ── 获取完整时间线 ─────────────────────────────────
  app.get('/api/job/timeline', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).id;
    const { eventType, limit, offset } = request.query as {
      eventType?: string;
      limit?: string;
      offset?: string;
    };

    const { prisma } = await import('../../../utils/index.js');
    const profile = await prisma.careerProfile.findUnique({ where: { userId } });
    if (!profile) {
      return reply.status(404).send({ error: 'Career profile not found' });
    }

    try {
      if (eventType) {
        const events = await careerTimelineRepository.listByEventType(profile.id, eventType);
        return { events, total: events.length };
      }

      const result = await careerTimelineService.queryTimeline({
        profileId: profile.id,
        eventType,
        limit: limit !== undefined ? parseInt(limit, 10) : undefined,
        offset: offset !== undefined ? parseInt(offset, 10) : undefined,
      });
      return result;
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // ── 获取完整时间线（含 Correction 标记）────────────
  app.get('/api/job/timeline/full', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).id;

    const { prisma } = await import('../../../utils/index.js');
    const profile = await prisma.careerProfile.findUnique({ where: { userId } });
    if (!profile) {
      return reply.status(404).send({ error: 'Career profile not found' });
    }

    try {
      const result = await careerTimelineService.getFullTimeline(profile.id);
      return result;
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // ── 追加事件 ──────────────────────────────────────
  app.post('/api/job/timeline/events', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).id;
    const {
      eventType, title, description, organization,
      occurredAt, granularity, relatedSkillNames, metadata,
    } = request.body as Record<string, any>;

    if (!eventType || !title || !occurredAt) {
      return reply.status(400).send({ error: 'eventType, title, occurredAt are required' });
    }

    const { prisma } = await import('../../../utils/index.js');
    const profile = await prisma.careerProfile.findUnique({ where: { userId } });
    if (!profile) {
      return reply.status(404).send({ error: 'Career profile not found' });
    }

    try {
      const event = await careerTimelineService.appendEvent({
        profileId: profile.id,
        eventType,
        title,
        description: description || null,
        organization: organization || null,
        occurredAt: new Date(occurredAt),
        granularity: granularity || 'day',
        relatedSkillNames: relatedSkillNames || [],
        metadata: metadata || null,
        source: 'user',
      });

      return reply.status(201).send(event);
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // ── 获取单条事件详情 ──────────────────────────────
  app.get('/api/job/timeline/events/:eventId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string };

    try {
      const result = await careerTimelineService.getEventWithCorrections(eventId);
      if (!result.event) {
        return reply.status(404).send({ error: 'Event not found' });
      }
      return result;
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // ── 追加 Correction ──────────────────────────────
  app.post('/api/job/timeline/corrections', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).id;
    const {
      originalEventId, eventType, title, description,
      organization, occurredAt, granularity,
      relatedSkillNames, metadata,
    } = request.body as Record<string, any>;

    if (!originalEventId || !eventType || !title || !occurredAt) {
      return reply.status(400).send({ error: 'originalEventId, eventType, title, occurredAt are required' });
    }

    const { prisma } = await import('../../../utils/index.js');
    const profile = await prisma.careerProfile.findUnique({ where: { userId } });
    if (!profile) {
      return reply.status(404).send({ error: 'Career profile not found' });
    }

    try {
      const correction = await careerTimelineService.appendCorrection(
        profile.id,
        {
          originalEventId,
          eventType,
          title,
          description: description || undefined,
          organization: organization || undefined,
          occurredAt: new Date(occurredAt),
          granularity: granularity || undefined,
          relatedSkillNames: relatedSkillNames || undefined,
          metadata: metadata || undefined,
          source: 'user_correction',
        }
      );

      return reply.status(201).send(correction);
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // ── 获取事件统计 ──────────────────────────────────
  app.get('/api/job/timeline/stats', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).id;

    const { prisma } = await import('../../../utils/index.js');
    const profile = await prisma.careerProfile.findUnique({ where: { userId } });
    if (!profile) {
      return reply.status(404).send({ error: 'Career profile not found' });
    }

    try {
      const stats = await careerTimelineService.getEventStats(profile.id);
      return { stats };
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });
}
