// ============================================================
// P0-T006: GEO Verification Routes — Brands API
// POST /api/geo/brands/:id/verify — 运行 Verification
// GET  /api/geo/brands/:id/verifications — 获取历史
// GET  /api/geo/brands/:id/verifications/:vid — 获取单条历史详情
// ============================================================

import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { VerificationEngine } from '../verification/engine';

const prisma = new PrismaClient();

export async function geoVerificationRoutes(app: FastifyInstance) {
  const engine = new VerificationEngine(prisma);

  // POST /api/geo/brands/:id/verify — 运行 Verification
  app.post('/api/geo/brands/:id/verify', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const { id } = req.params as any;
      const { beforeSnapshotId } = (req.body || {}) as any;

      if (!id) {
        return reply.status(400).send({ success: false, error: 'Brand ID required' });
      }

      const result = await engine.verify(id, beforeSnapshotId);
      return { success: true, data: result };
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // GET /api/geo/brands/:id/verifications — 获取历史
  app.get('/api/geo/brands/:id/verifications', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const { id } = req.params as any;
      if (!id) {
        return reply.status(400).send({ success: false, error: 'Brand ID required' });
      }

      const history = await engine.getHistory(id);
      return { success: true, data: history };
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // GET /api/geo/brands/:id/verifications/:vid — 获取单条历史详情
  app.get('/api/geo/brands/:id/verifications/:vid', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const { id, vid } = req.params as any;
      if (!id || !vid) {
        return reply.status(400).send({ success: false, error: 'Brand ID and Verification ID required' });
      }

      const result = await engine.getVerification(vid);
      if (!result || result.projectId !== id) {
        return reply.status(404).send({ success: false, error: 'Verification not found' });
      }
      return { success: true, data: result };
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
}
