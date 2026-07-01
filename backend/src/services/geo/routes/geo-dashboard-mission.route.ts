// ============================================================
// GEO Dashboard Mission Route — REST API
// GET /api/geo/dashboard/mission — 获取 Dashboard Mission 数据
// ============================================================

import { FastifyInstance } from 'fastify';
import { WorkflowEngine } from '../workflow/engine.js';
import { DashboardMissionService } from '../workflow/service.js';
import { geoProjectRepository } from '../repositories/geo-project.repository.js';

export default async function geoDashboardMissionRoutes(fastify: FastifyInstance) {
  const workflowEngine = new WorkflowEngine();
  const missionService = new DashboardMissionService(
    workflowEngine,
    geoProjectRepository,
  );

  // GET /api/geo/dashboard/mission — 获取 Dashboard Mission 数据
  fastify.get(
    '/api/geo/dashboard/mission',
    { preHandler: [] },
    async (request, reply) => {
      const user = request.user as any;
      const userId = user?.id || 'anonymous';

      try {
        const mission = await missionService.getDashboardMission(userId);
        return { success: true, data: mission };
      } catch (err: any) {
        fastify.log.error(err, 'Dashboard mission failed');
        return reply.status(500).send({ success: false, error: err.message });
      }
    },
  );
}
