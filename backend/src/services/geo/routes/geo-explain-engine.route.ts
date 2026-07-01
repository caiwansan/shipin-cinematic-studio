// ============================================================
// GEO Explain Engine Route — RC1-T004 Explain Everywhere
// GET /api/geo/explain/:type/:id
//
// SSOT: All explain data comes from ExplainEngine via registered providers.
// No page-level explanation assembly.
// ============================================================

import { FastifyInstance } from 'fastify';
import { ExplainEngine, ExplainRegistry } from '../explain/index.js';

export async function geoExplainEngineRoutes(fastify: FastifyInstance) {
  // GET /api/geo/explain/:type/:id — 获取统一 Explain 数据
  fastify.get(
    '/api/geo/explain/:type/:id',
    { preHandler: [] },
    async (request, reply) => {
      const { type, id } = request.params as { type: string; id: string };

      const validTypes = ['discovery', 'recommendation', 'verification', 'presence'];
      if (!validTypes.includes(type)) {
        return reply.status(400).send({ success: false, error: `Invalid explain type: ${type}. Valid types: ${validTypes.join(', ')}` });
      }

      try {
        // Import project repo lazily to avoid circular deps
        const { geoProjectRepository } = await import('../repositories/geo-project.repository.js');

        const registry = new ExplainRegistry();

        // Lazy-load providers
        const { DiscoveryExplainProvider } = await import('../explain/providers/discovery.provider.js');
        const { RecommendationExplainProvider } = await import('../explain/providers/recommendation.provider.js');
        const { VerificationExplainProvider } = await import('../explain/providers/verification.provider.js');
        const { PresenceExplainProvider } = await import('../explain/providers/presence.provider.js');

        registry.register(new DiscoveryExplainProvider());
        registry.register(new RecommendationExplainProvider());
        registry.register(new VerificationExplainProvider());
        registry.register(new PresenceExplainProvider());

        const engine = new ExplainEngine(registry, geoProjectRepository as any);
        const result = await engine.explain(type, id);

        return reply.send({ success: true, data: result });
      } catch (err: any) {
        if (err.message?.includes('not found')) {
          return reply.status(404).send({ success: false, error: err.message });
        }
        return reply.status(500).send({ success: false, error: err.message || 'Explain Engine error' });
      }
    },
  );
}
