// ════════════════════════════════════════════════════════════
// Public Manifest API — SEO-visible endpoints for search engines
// ════════════════════════════════════════════════════════════
// These routes serve the public/publication layer directly.
// Only published manifests are exposed.
// ════════════════════════════════════════════════════════════

import { FastifyInstance } from 'fastify';
import { manifestRepository } from './manifest-repository';

export function registerPublicManifestRoutes(app: FastifyInstance) {
  // ── GET /api/v1/public/knowledge/:type/:slug — Get published manifest ──
  app.get('/api/v1/public/knowledge/:type/:slug', async (request, reply) => {
    const { type, slug } = request.params as any;

    const record = await manifestRepository.findBySlug(slug, 'published');
    if (!record || record.type !== type) {
      return reply.status(404).send({ error: 'Not found' });
    }

    return { success: true, manifest: record.manifest };
  });

  // ── GET /api/v1/public/knowledge/search — Search published manifests ──
  app.get('/api/v1/public/knowledge/search', async (request, reply) => {
    const { q } = request.query as any;
    if (!q) {
      return reply.status(400).send({ error: 'Query required' });
    }

    const records = await manifestRepository.findAll({ status: 'published' });
    const qLower = q.toLowerCase();
    const results = records.filter(r =>
      r.name.toLowerCase().includes(qLower) ||
      r.manifest.content.summary.toLowerCase().includes(qLower) ||
      JSON.stringify(r.manifest.content).toLowerCase().includes(qLower)
    ).slice(0, 20);

    return {
      success: true,
      data: results.map(r => ({
        slug: r.slug,
        type: r.type,
        name: r.name,
        url: `/knowledge/${r.type}/${r.slug}`,
        summary: r.manifest.content.summary,
        updatedAt: r.updatedAt,
      })),
    };
  });
}
