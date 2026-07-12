// ============================================================
// GEO Showcase Route — AI Visibility Showcase API
// GET /api/v1/geo/showcase
// RC1-T005: Mission Dashboard — AI Visibility Showcase
// ============================================================

import { FastifyInstance } from 'fastify';
import { getShowcaseData } from '../showcase/showcase.service.js';

export default async function geoShowcaseRoutes(fastify: FastifyInstance) {
  // GET /api/v1/geo/showcase — AI Visibility Showcase aggregated data
  fastify.get(
    '/api/v1/geo/showcase',
    { preHandler: [] },
    async (_request, reply) => {
      try {
        const data = await getShowcaseData();
        return { success: true, data };
      } catch (err: any) {
        fastify.log.error(err, 'Showcase data fetch failed');
        return reply.status(500).send({ success: false, error: err.message });
      }
    },
  );
}
