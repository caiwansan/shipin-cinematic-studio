// ============================================================
// GEO Walkthrough Route — REST API
// RC1-T003 — Progressive Walkthrough 状态查询与管理
// ============================================================

import { FastifyInstance } from 'fastify';
import { WalkthroughEngine } from '../walkthrough/engine.js';
import { UserProgressRepository } from '../walkthrough/repository.js';
import { WorkflowEngine } from '../workflow/engine.js';
import { geoProjectRepository } from '../repositories/geo-project.repository.js';

export default async function geoWalkthroughRoutes(fastify: FastifyInstance) {
  const repo = new UserProgressRepository();
  const workflowEngine = new WorkflowEngine();
  const walkthroughEngine = new WalkthroughEngine(repo, workflowEngine);

  // GET /api/geo/walkthrough/state — 获取当前 Walkthrough 状态
  fastify.get(
    '/api/geo/walkthrough/state',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as any;
      const userId = user.id;

      try {
        const projects = await geoProjectRepository.findMany({ userId, deletedAt: null });
        const state = await walkthroughEngine.getState(userId, projects);
        return { success: true, data: state };
      } catch (err: any) {
        request.log.error(err, 'Walkthrough state failed');
        return reply.status(500).send({ success: false, error: err.message });
      }
    },
  );

  // POST /api/geo/walkthrough/dismiss — 标记已关闭
  fastify.post(
    '/api/geo/walkthrough/dismiss',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as any;
      const userId = user.id;

      try {
        await walkthroughEngine.dismiss(userId);
        return { success: true };
      } catch (err: any) {
        return reply.status(500).send({ success: false, error: err.message });
      }
    },
  );

  // POST /api/geo/walkthrough/complete — 标记已完成
  fastify.post(
    '/api/geo/walkthrough/complete',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as any;
      const userId = user.id;

      try {
        await walkthroughEngine.complete(userId);
        return { success: true };
      } catch (err: any) {
        return reply.status(500).send({ success: false, error: err.message });
      }
    },
  );

  // POST /api/geo/walkthrough/restart — 重新开始
  fastify.post(
    '/api/geo/walkthrough/restart',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as any;
      const userId = user.id;

      try {
        const state = await walkthroughEngine.restart(userId);
        return { success: true, data: state };
      } catch (err: any) {
        return reply.status(500).send({ success: false, error: err.message });
      }
    },
  );
}
