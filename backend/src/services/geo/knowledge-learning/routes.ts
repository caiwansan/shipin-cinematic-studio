// ============================================================
// Knowledge Learning Routes — Fastify API
// GEO-RC3 Epic B2: Production Replay Learning
// ============================================================

import { FastifyInstance } from 'fastify';
import { candidateStore } from './candidate/store';
import { reviewQueue } from './review/queue';
import { promotionEngine } from './promotion/engine';
import { learningDashboard } from './dashboard/stats';
import { reviewApi } from './review/api';

export function registerLearningRoutes(app: FastifyInstance) {
  // GET /api/v1/geo/learning/candidates
  app.get('/api/v1/geo/learning/candidates', async (request, reply) => {
    const { status } = request.query as any;
    const candidates = candidateStore.getAll(status);
    return { success: true, data: candidates, total: candidates.length };
  });

  // GET /api/v1/geo/learning/candidates/:id
  app.get('/api/v1/geo/learning/candidates/:id', async (request, reply) => {
    const { id } = request.params as any;
    const candidate = candidateStore.getById(id);
    if (!candidate) return reply.status(404).send({ success: false, error: 'Candidate not found' });
    return { success: true, data: candidate };
  });

  // POST /api/v1/geo/learning/candidates/:id/review
  app.post('/api/v1/geo/learning/candidates/:id/review', async (request, reply) => {
    const { id } = request.params as any;
    const { action, comment } = request.body as any;
    if (!['approve', 'reject'].includes(action)) {
      return reply.status(400).send({ success: false, error: 'Action must be approve or reject' });
    }
    const result = reviewApi.submitReview(id, action, comment);
    if (!result || (result as any).error) {
      if (!result) return reply.status(404).send({ success: false, error: 'Candidate not found' });
      return reply.status(400).send({ success: false, error: (result as any).error });
    }
    return { success: true, data: result };
  });

  // POST /api/v1/geo/learning/candidates/:id/promote
  app.post('/api/v1/geo/learning/candidates/:id/promote', async (request, reply) => {
    const { id } = request.params as any;
    const log = promotionEngine.promote(id);
    if (!log) return reply.status(400).send({ success: false, error: 'Candidate must be approved before promotion' });
    return { success: true, data: log };
  });

  // GET /api/v1/geo/learning/promotions
  app.get('/api/v1/geo/learning/promotions', async (request, reply) => {
    const logs = promotionEngine.getLogs();
    return { success: true, data: logs, total: logs.length };
  });

  // GET /api/v1/geo/learning/dashboard
  app.get('/api/v1/geo/learning/dashboard', async (request, reply) => {
    const dashboard = learningDashboard.summary();
    return { success: true, data: dashboard };
  });

  // GET /api/v1/geo/learning/candidates/pending — 待审核列表
  app.get('/api/v1/geo/learning/candidates/pending', async (request, reply) => {
    const pending = reviewQueue.getPending();
    return { success: true, data: pending, total: pending.length };
  });
}
